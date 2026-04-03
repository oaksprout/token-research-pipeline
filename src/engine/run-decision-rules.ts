import { eq, and, desc, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  sectorScoresWeekly,
  tierRecommendationsWeekly,
  regimeScoresWeekly,
  tokenScoresWeekly,
} from '../db/schema.js';
import { loadSectors } from '../lib/config.js';
import { computeTierRecommendation, type Tier, type TierContext } from './decision-rules.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function applyDecisionRules(): Promise<void> {
  const date = today();
  console.log(`[decision_rules] Starting for ${date}`);

  const sectorsConfig = loadSectors();

  // Get current regime
  const [regime] = await db
    .select()
    .from(regimeScoresWeekly)
    .orderBy(desc(regimeScoresWeekly.date))
    .limit(1);

  const regimeLabel = regime?.label ?? 'stabilising';

  for (const sectorKey of Object.keys(sectorsConfig.sectors)) {
    // Get current sector score
    const [currentScore] = await db
      .select()
      .from(sectorScoresWeekly)
      .where(and(eq(sectorScoresWeekly.date, date), eq(sectorScoresWeekly.sector, sectorKey)))
      .limit(1);

    if (!currentScore) continue;

    // Get score history (last 4 weeks excluding today)
    const priorScores = await db
      .select({ scoreTotal: sectorScoresWeekly.scoreTotal, date: sectorScoresWeekly.date })
      .from(sectorScoresWeekly)
      .where(and(eq(sectorScoresWeekly.sector, sectorKey), lt(sectorScoresWeekly.date, date)))
      .orderBy(desc(sectorScoresWeekly.date))
      .limit(4);

    const scoreHistory = priorScores
      .filter((r) => r.scoreTotal != null)
      .map((r) => r.scoreTotal!)
      .reverse(); // oldest first
    scoreHistory.push(currentScore.scoreTotal ?? 0);

    // Get prior tier
    const [priorTierRow] = await db
      .select()
      .from(tierRecommendationsWeekly)
      .where(and(eq(tierRecommendationsWeekly.sector, sectorKey), lt(tierRecommendationsWeekly.date, date)))
      .orderBy(desc(tierRecommendationsWeekly.date))
      .limit(1);

    const currentTier: Tier = (priorTierRow?.proposedTier as Tier) ?? 'observe';

    // Count weeks at current tier
    const tierHistory = await db
      .select({ proposedTier: tierRecommendationsWeekly.proposedTier })
      .from(tierRecommendationsWeekly)
      .where(eq(tierRecommendationsWeekly.sector, sectorKey))
      .orderBy(desc(tierRecommendationsWeekly.date))
      .limit(10);

    let weeksAtCurrentTier = 0;
    for (const row of tierHistory) {
      if (row.proposedTier === currentTier) weeksAtCurrentTier++;
      else break;
    }

    // Get leader token for this sector
    const leaderTokens = await db
      .select()
      .from(tokenScoresWeekly)
      .where(and(eq(tokenScoresWeekly.date, date), eq(tokenScoresWeekly.sector, sectorKey)))
      .orderBy(desc(tokenScoresWeekly.scoreTotal))
      .limit(1);

    const leader = leaderTokens[0] ?? null;

    const ctx: TierContext = {
      sector: sectorKey,
      currentTier,
      sectorScore: currentScore.scoreTotal ?? 0,
      sectorScoreHistory: scoreHistory,
      structuralFilterPasses: currentScore.structuralFilter === 'pass',
      validationPasses: currentScore.validation === 'pass',
      leaderToken: leader?.symbol ?? null,
      leaderTokenScore: leader?.scoreTotal ?? null,
      regimeLabel,
      weeksAtCurrentTier,
    };

    const rec = computeTierRecommendation(ctx);

    await db
      .insert(tierRecommendationsWeekly)
      .values({
        date,
        sector: sectorKey,
        priorTier: rec.priorTier,
        proposedTier: rec.proposedTier,
        tierChanged: rec.tierChanged ? 1 : 0,
        changeReason: rec.changeReason,
        leaderToken: rec.leaderToken,
        leaderStatus: rec.leaderStatus,
      })
      .onConflictDoUpdate({
        target: [tierRecommendationsWeekly.date, tierRecommendationsWeekly.sector],
        set: {
          priorTier: rec.priorTier,
          proposedTier: rec.proposedTier,
          tierChanged: rec.tierChanged ? 1 : 0,
          changeReason: rec.changeReason,
          leaderToken: rec.leaderToken,
          leaderStatus: rec.leaderStatus,
        },
      });

    if (rec.tierChanged) {
      console.log(`[decision_rules] ${sectorKey}: ${rec.priorTier} → ${rec.proposedTier} (${rec.changeReason})`);
    }
  }

  console.log(`[decision_rules] Done for ${date}`);
}
