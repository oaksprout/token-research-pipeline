import { desc, eq, and } from 'drizzle-orm';
import { db } from '@/db';
import {
  marketDaily,
  regimeScoresWeekly,
  sectorScoresWeekly,
  sectorMetricsWeekly,
  tokenScoresWeekly,
  tierRecommendationsWeekly,
  portfolioActionsWeekly,
  runLog,
  runTrace,
} from '@/db/schema';

export async function getLatestMarketData() {
  const [row] = await db.select().from(marketDaily).orderBy(desc(marketDaily.date)).limit(1);
  return row ?? null;
}

export async function getLatestRegime() {
  const [row] = await db.select().from(regimeScoresWeekly).orderBy(desc(regimeScoresWeekly.date)).limit(1);
  return row ?? null;
}

export async function getRegimeHistory(weeks = 12) {
  const rows = await db.select().from(regimeScoresWeekly).orderBy(desc(regimeScoresWeekly.date)).limit(weeks);
  return rows.reverse();
}

export async function getLatestSectorScores() {
  const [latest] = await db.select({ date: sectorScoresWeekly.date }).from(sectorScoresWeekly).orderBy(desc(sectorScoresWeekly.date)).limit(1);
  if (!latest) return [];
  return db.select().from(sectorScoresWeekly).where(eq(sectorScoresWeekly.date, latest.date)).orderBy(desc(sectorScoresWeekly.scoreTotal));
}

export async function getLatestTierRecommendations() {
  const [latest] = await db.select({ date: tierRecommendationsWeekly.date }).from(tierRecommendationsWeekly).orderBy(desc(tierRecommendationsWeekly.date)).limit(1);
  if (!latest) return [];
  return db.select().from(tierRecommendationsWeekly).where(eq(tierRecommendationsWeekly.date, latest.date));
}

export async function getLatestTokenScores(sector?: string) {
  const [latest] = await db.select({ date: tokenScoresWeekly.date }).from(tokenScoresWeekly).orderBy(desc(tokenScoresWeekly.date)).limit(1);
  if (!latest) return [];
  const base = db.select().from(tokenScoresWeekly).where(
    sector
      ? and(eq(tokenScoresWeekly.date, latest.date), eq(tokenScoresWeekly.sector, sector))
      : eq(tokenScoresWeekly.date, latest.date)
  );
  return base.orderBy(desc(tokenScoresWeekly.scoreTotal));
}

export async function getSectorDetail(sector: string) {
  const [latest] = await db.select({ date: sectorMetricsWeekly.date }).from(sectorMetricsWeekly).orderBy(desc(sectorMetricsWeekly.date)).limit(1);
  if (!latest) return null;
  const [metrics] = await db.select().from(sectorMetricsWeekly).where(and(eq(sectorMetricsWeekly.date, latest.date), eq(sectorMetricsWeekly.sector, sector))).limit(1);
  const [scores] = await db.select().from(sectorScoresWeekly).where(and(eq(sectorScoresWeekly.date, latest.date), eq(sectorScoresWeekly.sector, sector))).limit(1);
  const [tier] = await db.select().from(tierRecommendationsWeekly).where(and(eq(tierRecommendationsWeekly.date, latest.date), eq(tierRecommendationsWeekly.sector, sector))).limit(1);
  const tokens = await getLatestTokenScores(sector);
  return { metrics: metrics ?? null, scores: scores ?? null, tier: tier ?? null, tokens };
}

export async function getLatestPortfolioActions() {
  const [latest] = await db.select({ date: portfolioActionsWeekly.date }).from(portfolioActionsWeekly).orderBy(desc(portfolioActionsWeekly.date)).limit(1);
  if (!latest) return [];
  return db.select().from(portfolioActionsWeekly).where(eq(portfolioActionsWeekly.date, latest.date));
}

export async function getRecentRuns(limit = 50) {
  return db.select().from(runLog).orderBy(desc(runLog.startedAt)).limit(limit);
}

export async function getRunById(id: string) {
  const [run] = await db.select().from(runLog).where(eq(runLog.id, id)).limit(1);
  return run ?? null;
}

export async function getRunTraces(runId: string) {
  return db.select().from(runTrace).where(eq(runTrace.runId, runId)).orderBy(runTrace.timestamp);
}
