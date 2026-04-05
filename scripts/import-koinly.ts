/**
 * Import tax lot data from Koinly's transaction CSV export.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/import-koinly.ts path/to/transactions.csv
 *
 * Koinly columns:
 *   ID, Date (UTC), Type, From Amount, From Currency,
 *   To Amount, To Currency, Net Worth Amount, Net Worth Currency,
 *   Net Value (read-only), TxHash, Description
 *
 * We create tax lots from:
 *   - deposits/rewards → acquisition lots (cost basis from Net Worth Amount)
 *   - trades (buy side) → acquisition lots
 *   - withdrawals/sends → disposal lots
 *   - trades (sell side) → disposal lots
 */

import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { db, closeDb } from '../src/db/client.js';
import { taxLots } from '../src/db/schema.js';
import { sql } from 'drizzle-orm';

function parseDate(dateStr: string): string {
  // "2023-03-24 18:26:18" → "2023-03-24"
  return dateStr.slice(0, 10);
}

function parseCurrency(raw: string): string {
  // "ETH;123" → "ETH"
  return (raw || '').split(';')[0].trim().toUpperCase();
}

function parseNum(val: string): number {
  if (!val || val === '') return 0;
  return parseFloat(val.replace(/,/g, '')) || 0;
}

// Tracked tokens we care about
const TRACKED = new Set([
  'BTC', 'ETH', 'SOL', 'ONDO', 'CFG', 'MPL', 'BUIDL',
  'HNT', 'RENDER', 'DIMO', 'VIRTUAL', 'TAO', 'OLAS',
  'TIA', 'AVAIL', 'STX', 'BABY', 'PROVE',
  'AAVE', 'LDO', 'UNI', 'MKR', 'ZORA',
]);

// Stablecoins to skip
const STABLES = new Set(['USD', 'USDC', 'USDT', 'DAI', 'BUSD', 'GBP', 'EUR', 'TUSD', 'GUSD', 'FRAX', 'LUSD', 'SUSD', 'UST', 'USDP', 'PYUSD']);

interface ParsedRow {
  id: string;
  date: string;
  type: string;
  fromAmount: number;
  fromCurrency: string;
  toAmount: number;
  toCurrency: string;
  netWorthAmount: number;
  netWorthCurrency: string;
  netValue: number;
  txHash: string;
  deleted: boolean;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: npx tsx scripts/import-koinly.ts <path-to-koinly-csv>');
    process.exit(1);
  }

  const fullPath = resolve(csvPath);
  console.log(`[koinly] Reading ${fullPath}`);

  // Clear existing koinly imports
  await db.delete(taxLots).where(sql`${taxLots.source} = 'koinly_import'`);
  console.log('[koinly] Cleared previous koinly imports');

  const rl = createInterface({ input: createReadStream(fullPath, 'utf-8') });
  let headers: string[] = [];
  let lineNum = 0;
  let imported = 0;
  let skipped = 0;
  const batch: Array<typeof taxLots.$inferInsert> = [];

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) {
      headers = parseCSVLine(line);
      continue;
    }

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });

    const parsed: ParsedRow = {
      id: row['ID (read-only)'] ?? '',
      date: parseDate(row['Date (UTC)'] ?? ''),
      type: (row['Type'] ?? '').toLowerCase(),
      fromAmount: parseNum(row['From Amount'] ?? ''),
      fromCurrency: parseCurrency(row['From Currency'] ?? ''),
      toAmount: parseNum(row['To Amount'] ?? ''),
      toCurrency: parseCurrency(row['To Currency'] ?? ''),
      netWorthAmount: parseNum(row['Net Worth Amount'] ?? ''),
      netWorthCurrency: parseCurrency(row['Net Worth Currency'] ?? ''),
      netValue: parseNum(row['Net Value (read-only)'] ?? ''),
      txHash: row['TxHash'] ?? '',
      deleted: (row['Deleted'] ?? '').toLowerCase() === 'true',
    };

    if (parsed.deleted || !parsed.date) { skipped++; continue; }

    // ─── Acquisitions (deposits, rewards, buy-side of trades) ────

    if (['deposit', 'transfer'].includes(parsed.type)) {
      const symbol = parsed.toCurrency;
      if (!symbol || STABLES.has(symbol) || parsed.toAmount <= 0) { skipped++; continue; }
      if (!TRACKED.has(symbol)) { skipped++; continue; }

      const costBasis = parsed.netWorthAmount || parsed.netValue || 0;
      batch.push({
        symbol,
        quantity: parsed.toAmount,
        costBasis,
        costPerUnit: parsed.toAmount > 0 ? costBasis / parsed.toAmount : 0,
        acquiredAt: parsed.date,
        disposedAt: null,
        proceeds: null,
        gainLoss: null,
        source: 'koinly_import',
        koinlyTxnId: parsed.id,
      });
      imported++;
    }

    if (parsed.type === 'trade') {
      // Buy side: what we received
      const buySymbol = parsed.toCurrency;
      if (buySymbol && !STABLES.has(buySymbol) && TRACKED.has(buySymbol) && parsed.toAmount > 0) {
        const costBasis = parsed.netWorthAmount || parsed.netValue || 0;
        batch.push({
          symbol: buySymbol,
          quantity: parsed.toAmount,
          costBasis,
          costPerUnit: parsed.toAmount > 0 ? costBasis / parsed.toAmount : 0,
          acquiredAt: parsed.date,
          disposedAt: null,
          proceeds: null,
          gainLoss: null,
          source: 'koinly_import',
          koinlyTxnId: parsed.id + '_buy',
        });
        imported++;
      }

      // Sell side: what we sent
      const sellSymbol = parsed.fromCurrency;
      if (sellSymbol && !STABLES.has(sellSymbol) && TRACKED.has(sellSymbol) && parsed.fromAmount > 0) {
        const proceeds = parsed.netWorthAmount || parsed.netValue || 0;
        batch.push({
          symbol: sellSymbol,
          quantity: parsed.fromAmount,
          costBasis: 0, // Koinly doesn't give per-txn cost basis in this format
          costPerUnit: 0,
          acquiredAt: parsed.date, // approximate
          disposedAt: parsed.date,
          proceeds,
          gainLoss: null,
          source: 'koinly_import',
          koinlyTxnId: parsed.id + '_sell',
        });
        imported++;
      }
    }

    if (parsed.type === 'withdrawal') {
      const symbol = parsed.fromCurrency;
      if (!symbol || STABLES.has(symbol) || parsed.fromAmount <= 0) { skipped++; continue; }
      if (!TRACKED.has(symbol)) { skipped++; continue; }

      // Withdrawals to own wallets are transfers, not disposals
      // But Koinly marks internal transfers as 'transfer' type
      // So withdrawals here are likely actual sends out
      batch.push({
        symbol,
        quantity: parsed.fromAmount,
        costBasis: parsed.netWorthAmount || parsed.netValue || 0,
        costPerUnit: parsed.fromAmount > 0 ? (parsed.netWorthAmount || parsed.netValue || 0) / parsed.fromAmount : 0,
        acquiredAt: parsed.date,
        disposedAt: parsed.date,
        proceeds: parsed.netWorthAmount || parsed.netValue || 0,
        gainLoss: null,
        source: 'koinly_import',
        koinlyTxnId: parsed.id,
      });
      imported++;
    }

    // Flush batch every 500
    if (batch.length >= 500) {
      await db.insert(taxLots).values(batch);
      batch.length = 0;
      console.log(`[koinly] Imported ${imported} lots so far (line ${lineNum})...`);
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    await db.insert(taxLots).values(batch);
  }

  console.log(`[koinly] Done — ${imported} lots imported, ${skipped} skipped, from ${lineNum - 1} rows`);

  // Summary by symbol
  const summary = await db.select({
    symbol: taxLots.symbol,
    count: sql<number>`count(*)`,
    totalQty: sql<number>`sum(${taxLots.quantity})`,
  }).from(taxLots).groupBy(taxLots.symbol).orderBy(sql`count(*) desc`);

  console.log('\n[koinly] Summary:');
  for (const s of summary) {
    console.log(`  ${s.symbol}: ${s.count} lots, ${s.totalQty?.toFixed(4)} total qty`);
  }

  await closeDb();
}

main().catch((err) => {
  console.error('[koinly] Failed:', err);
  process.exit(1);
});
