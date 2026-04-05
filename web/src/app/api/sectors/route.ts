import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { checkAuth, unauthorized } from '@/lib/auth';
import { db } from '@/db';
import { llmAnalysisWeekly } from '@/db/schema';
import { getLatestSectorScores, getLatestTierRecommendations } from '@/lib/queries';

export async function GET(request: Request) {
  if (!checkAuth(request)) return unauthorized();

  const [sectors, tiers, llmRow] = await Promise.all([
    getLatestSectorScores(),
    getLatestTierRecommendations(),
    db
      .select()
      .from(llmAnalysisWeekly)
      .orderBy(desc(llmAnalysisWeekly.date))
      .limit(1)
      .then(([row]) => row ?? null),
  ]);

  let sectorAnalysis = null;
  if (llmRow?.sectorAnalysis) {
    try {
      sectorAnalysis = JSON.parse(llmRow.sectorAnalysis);
    } catch {
      sectorAnalysis = llmRow.sectorAnalysis;
    }
  }

  // Merge tiers into sectors by sector name
  const tierMap = new Map(tiers.map((t) => [t.sector, t]));
  const merged = sectors.map((s) => ({
    ...s,
    tier: tierMap.get(s.sector) ?? null,
  }));

  return NextResponse.json({
    sectors: merged,
    llmSectorAnalysis: sectorAnalysis,
  });
}
