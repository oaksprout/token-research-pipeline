import { and, eq, desc, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { sectorMetricsWeekly, sectorScoresWeekly } from '../db/schema.js';
import { loadSectors } from '../lib/config.js';
import { computeSectorScore } from './sectors.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function scoreSectors(): Promise<void> {
  const date = today();
  console.log(`[score_sectors] Starting for ${date}`);

  const sectorsConfig = loadSectors();

  for (const [sectorKey, sectorDef] of Object.entries(sectorsConfig.sectors)) {
    // 1. Read sector metrics for today
    const [metrics] = await db
      .select()
      .from(sectorMetricsWeekly)
      .where(
        and(
          eq(sectorMetricsWeekly.date, date),
          eq(sectorMetricsWeekly.sector, sectorKey),
        ),
      )
      .limit(1);

    if (!metrics) {
      console.warn(`[score_sectors] No metrics for ${sectorKey} on ${date}. Skipping.`);
      continue;
    }

    // 2. Read prior score from ~4 weeks ago
    const cutoff = dateNDaysAgo(28);
    const [priorRow] = await db
      .select({ scoreTotal: sectorScoresWeekly.scoreTotal })
      .from(sectorScoresWeekly)
      .where(
        and(
          eq(sectorScoresWeekly.sector, sectorKey),
          lte(sectorScoresWeekly.date, cutoff),
        ),
      )
      .orderBy(desc(sectorScoresWeekly.date))
      .limit(1);

    const priorScore4wAgo = priorRow?.scoreTotal ?? null;

    // 3. Leader tokens (populated after token scoring — empty for now)
    const leaderTokens = '';

    // 4. Compute sector score
    const result = computeSectorScore(
      {
        devCommitsProxy: metrics.devCommitsProxy,
        tvlChange30d: metrics.tvlChange30d,
        feeRevenue30d: metrics.feeRevenue30d,
        fundingTotal30d: metrics.fundingTotal30d,
        basketReturn7d: metrics.basketReturn7d,
        basketReturn30d: metrics.basketReturn30d,
        rsVsBtc30d: metrics.rsVsBtc30d,
        rsVsEth30d: metrics.rsVsEth30d,
      },
      sectorDef.structural_filters,
      priorScore4wAgo,
      leaderTokens,
    );

    // 5. Upsert to sector_scores_weekly
    await db
      .insert(sectorScoresWeekly)
      .values({
        date,
        sector: sectorKey,
        scoreTotal: result.scoreTotal,
        scoreDelta4w: result.scoreDelta4w,
        confidence: result.confidence,
        structuralFilter: result.structuralFilter,
        validation: result.validation,
        subDev: result.subDev,
        subUsage: result.subUsage,
        subFunding: result.subFunding,
        subNarrative: result.subNarrative,
        subRs: result.subRs,
        tierCandidate: result.tierCandidate,
        leaderTokens: result.leaderTokens,
      })
      .onConflictDoUpdate({
        target: [sectorScoresWeekly.date, sectorScoresWeekly.sector],
        set: {
          scoreTotal: result.scoreTotal,
          scoreDelta4w: result.scoreDelta4w,
          confidence: result.confidence,
          structuralFilter: result.structuralFilter,
          validation: result.validation,
          subDev: result.subDev,
          subUsage: result.subUsage,
          subFunding: result.subFunding,
          subNarrative: result.subNarrative,
          subRs: result.subRs,
          tierCandidate: result.tierCandidate,
          leaderTokens: result.leaderTokens,
        },
      });

    console.log(
      `[score_sectors] ${sectorKey}: ${result.tierCandidate} (${result.scoreTotal}, ${result.confidence})`,
    );
  }

  console.log(`[score_sectors] Done for ${date}`);
}
