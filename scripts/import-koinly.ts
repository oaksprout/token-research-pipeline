/**
 * Import tax lot data from a Koinly CSV export.
 *
 * Usage:
 *   npx tsx scripts/import-koinly.ts path/to/koinly-export.csv
 *
 * Supports Koinly's "Transactions" export format with columns:
 *   Date, Type, Received Currency, Received Amount, Received Cost Basis,
 *   Sent Currency, Sent Amount, Sent Cost Basis, Fee Currency, Fee Amount,
 *   Fee Cost Basis, Gain, Net Worth Amount, Label, Description, TxHash
 *
 * Also supports Koinly's "Tax Lots" report if available.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db, closeDb } from '../src/db/client.js';
import { taxLots } from '../src/db/schema.js';

interface KoinlyRow {
  [key: string]: string;
}

function parseCSV(content: string): KoinlyRow[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"/, '').replace(/"$/, ''));
  const rows: KoinlyRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].match(/(".*?"|[^,]*),?/g)?.map((v) =>
      v.replace(/,$/, '').replace(/^"/, '').replace(/"$/, '').trim()
    ) ?? [];
    const row: KoinlyRow = {};
    headers.forEach((h, j) => { row[h] = values[j] ?? ''; });
    rows.push(row);
  }

  return rows;
}

function parseDate(dateStr: string): string {
  // Koinly dates: "2024-03-15 14:30:00 UTC" or "2024-03-15"
  const match = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : dateStr.slice(0, 10);
}

function parseNumber(val: string): number {
  if (!val || val === '-' || val === '') return 0;
  return parseFloat(val.replace(/,/g, '')) || 0;
}

async function importTransactions(rows: KoinlyRow[]) {
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const type = (row['Type'] ?? row['type'] ?? '').toLowerCase();

    // For buys/receives: create a tax lot
    if (['buy', 'receive', 'transfer', 'airdrop', 'mining', 'staking', 'reward'].includes(type)) {
      const symbol = (row['Received Currency'] ?? row['received_currency'] ?? '').toUpperCase();
      const amount = parseNumber(row['Received Amount'] ?? row['received_amount'] ?? '0');
      const costBasis = parseNumber(row['Received Cost Basis'] ?? row['received_cost_basis'] ?? '0');
      const date = parseDate(row['Date'] ?? row['date'] ?? '');
      const txHash = row['TxHash'] ?? row['txhash'] ?? row['tx_hash'] ?? '';

      if (!symbol || amount <= 0 || !date) {
        skipped++;
        continue;
      }

      await db.insert(taxLots).values({
        symbol,
        quantity: amount,
        costBasis,
        costPerUnit: amount > 0 ? costBasis / amount : 0,
        acquiredAt: date,
        disposedAt: null,
        proceeds: null,
        gainLoss: null,
        source: 'koinly_import',
        koinlyTxnId: txHash || null,
      });
      imported++;
    }

    // For sells/sends: create a disposed tax lot
    if (['sell', 'send', 'trade'].includes(type)) {
      const symbol = (row['Sent Currency'] ?? row['sent_currency'] ?? '').toUpperCase();
      const amount = parseNumber(row['Sent Amount'] ?? row['sent_amount'] ?? '0');
      const costBasis = parseNumber(row['Sent Cost Basis'] ?? row['sent_cost_basis'] ?? '0');
      const proceeds = parseNumber(row['Received Cost Basis'] ?? row['received_cost_basis'] ?? '0');
      const gain = parseNumber(row['Gain'] ?? row['gain'] ?? '0');
      const date = parseDate(row['Date'] ?? row['date'] ?? '');
      const txHash = row['TxHash'] ?? row['txhash'] ?? row['tx_hash'] ?? '';

      if (!symbol || amount <= 0 || !date) {
        skipped++;
        continue;
      }

      await db.insert(taxLots).values({
        symbol,
        quantity: amount,
        costBasis,
        costPerUnit: amount > 0 ? costBasis / amount : 0,
        acquiredAt: date, // approximation — Koinly matches lots internally
        disposedAt: date,
        proceeds,
        gainLoss: gain,
        source: 'koinly_import',
        koinlyTxnId: txHash || null,
      });
      imported++;
    }

    if (imported > 0 && imported % 100 === 0) {
      console.log(`[koinly] Imported ${imported} lots...`);
    }
  }

  return { imported, skipped };
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: npx tsx scripts/import-koinly.ts <path-to-koinly-csv>');
    process.exit(1);
  }

  const fullPath = resolve(csvPath);
  console.log(`[koinly] Reading ${fullPath}`);

  const content = readFileSync(fullPath, 'utf-8');
  const rows = parseCSV(content);
  console.log(`[koinly] Parsed ${rows.length} rows`);

  if (rows.length === 0) {
    console.error('[koinly] No rows found in CSV');
    process.exit(1);
  }

  // Show detected columns
  const cols = Object.keys(rows[0]);
  console.log(`[koinly] Columns: ${cols.join(', ')}`);

  const { imported, skipped } = await importTransactions(rows);
  console.log(`[koinly] Done — ${imported} lots imported, ${skipped} skipped`);

  await closeDb();
}

main().catch((err) => {
  console.error('[koinly] Failed:', err);
  process.exit(1);
});
