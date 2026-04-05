import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { checkAuth, unauthorized } from '@/lib/auth';
import { db } from '@/db';
import { llmAnalysisWeekly } from '@/db/schema';
import {
  getLatestMarketData,
  getLatestRegime,
  getLatestSectorScores,
  getLatestTierRecommendations,
  getLatestPortfolioActions,
  getLatestTokenScores,
} from '@/lib/queries';

function tryParse(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function GET(request: Request) {
  if (!checkAuth(request)) return unauthorized();

  const [market, regime, sectors, tiers, actions, tokens, analysisRow] = await Promise.all([
    getLatestMarketData(),
    getLatestRegime(),
    getLatestSectorScores(),
    getLatestTierRecommendations(),
    getLatestPortfolioActions(),
    getLatestTokenScores(),
    db
      .select()
      .from(llmAnalysisWeekly)
      .orderBy(desc(llmAnalysisWeekly.date))
      .limit(1)
      .then(([row]) => row ?? null),
  ]);

  const analysis = analysisRow
    ? {
        date: analysisRow.date,
        regimeAnalysis: tryParse(analysisRow.regimeAnalysis),
        sectorAnalysis: tryParse(analysisRow.sectorAnalysis),
        portfolioAnalysis: tryParse(analysisRow.portfolioAnalysis),
      }
    : null;

  return NextResponse.json({
    market,
    regime,
    sectors,
    tiers,
    actions,
    tokens,
    analysis,
  });
}
