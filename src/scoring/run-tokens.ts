import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { tokenMetricsDaily, tokenScoresWeekly } from '../db/schema.js';
import { loadTokens } from '../lib/config.js';
import { computeTokenScore } from './tokens.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function scoreTokens(): Promise<void> {
  const date = today();
  console.log(`[score_tokens] Starting for ${date}`);

  const tokensConfig = loadTokens();

  // 1. Read all token_metrics_daily for today
  const todayMetrics = await db
    .select()
    .from(tokenMetricsDaily)
    .where(eq(tokenMetricsDaily.date, date));

  const metricsBySymbol = new Map(todayMetrics.map((r) => [r.symbol, r]));

  // 2. Get BTC and ETH 30d returns
  const btcRow = metricsBySymbol.get('BTC');
  const ethRow = metricsBySymbol.get('ETH');
  const btcReturn30d = btcRow?.priceChange30d ?? 0;
  const ethReturn30d = ethRow?.priceChange30d ?? 0;

  // 3. For each token: compute avg 7d volume, score, and collect results
  const results: Array<{
    symbol: string;
    sector: string | null;
    scoreTotal: number;
    subLiquidity: number;
    subRs: number;
    subStructure: number;
    subVolume: number;
    subValuation: number;
    candidateStatus: string;
  }> = [];

  for (const [symbol, tokenDef] of Object.entries(tokensConfig.tokens)) {
    const metrics = metricsBySymbol.get(symbol);
    if (!metrics) {
      console.log(`[score_tokens] No metrics for ${symbol}, skipping`);
      continue;
    }

    // Query last 7 days of volume for this symbol
    const last7Days = await db
      .select({ volume24h: tokenMetricsDaily.volume24h })
      .from(tokenMetricsDaily)
      .where(eq(tokenMetricsDaily.symbol, symbol))
      .orderBy(desc(tokenMetricsDaily.date))
      .limit(7);

    const volumes = last7Days
      .filter((r) => r.volume24h != null)
      .map((r) => r.volume24h!);

    const avgVolume7d =
      volumes.length > 0
        ? volumes.reduce((a, b) => a + b, 0) / volumes.length
        : null;

    const result = computeTokenScore({
      volume24h: metrics.volume24h ?? null,
      mcap: metrics.mcap ?? null,
      fdv: metrics.fdv ?? null,
      priceChange7d: metrics.priceChange7d ?? null,
      priceChange30d: metrics.priceChange30d ?? null,
      priceChange90d: metrics.priceChange90d ?? null,
      feeRevenue30d: null, // fee data is at sector level in v1
      btcReturn30d,
      ethReturn30d,
      avgVolume7d,
    });

    results.push({
      symbol,
      sector: tokenDef.sector,
      ...result,
    });
  }

  // 5. Group by sector, sort by scoreTotal desc, assign rankInSector
  const bySector = new Map<string, typeof results>();
  for (const r of results) {
    const key = r.sector ?? '__none__';
    if (!bySector.has(key)) bySector.set(key, []);
    bySector.get(key)!.push(r);
  }

  for (const group of bySector.values()) {
    group.sort((a, b) => b.scoreTotal - a.scoreTotal);
  }

  // 6. Upsert to tokenScoresWeekly
  for (const group of bySector.values()) {
    for (let i = 0; i < group.length; i++) {
      const r = group[i];
      const rankInSector = i + 1;

      await db
        .insert(tokenScoresWeekly)
        .values({
          date,
          symbol: r.symbol,
          sector: r.sector,
          scoreTotal: r.scoreTotal,
          rankInSector,
          subLiquidity: r.subLiquidity,
          subRs: r.subRs,
          subStructure: r.subStructure,
          subVolume: r.subVolume,
          subValuation: r.subValuation,
          candidateStatus: r.candidateStatus,
        })
        .onConflictDoUpdate({
          target: [tokenScoresWeekly.date, tokenScoresWeekly.symbol],
          set: {
            sector: r.sector,
            scoreTotal: r.scoreTotal,
            rankInSector,
            subLiquidity: r.subLiquidity,
            subRs: r.subRs,
            subStructure: r.subStructure,
            subVolume: r.subVolume,
            subValuation: r.subValuation,
            candidateStatus: r.candidateStatus,
          },
        });

      console.log(
        `[score_tokens] ${r.symbol}: ${r.scoreTotal} (${r.candidateStatus}, rank ${rankInSector} in ${r.sector ?? 'none'})`,
      );
    }
  }

  console.log(`[score_tokens] Done for ${date}`);
}
