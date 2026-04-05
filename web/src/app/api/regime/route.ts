import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { checkAuth, unauthorized } from '@/lib/auth';
import { db } from '@/db';
import { llmAnalysisWeekly } from '@/db/schema';
import { getLatestRegime, getLatestMarketData } from '@/lib/queries';

export async function GET(request: Request) {
  if (!checkAuth(request)) return unauthorized();

  const [regime, market, llmRow] = await Promise.all([
    getLatestRegime(),
    getLatestMarketData(),
    db
      .select()
      .from(llmAnalysisWeekly)
      .orderBy(desc(llmAnalysisWeekly.date))
      .limit(1)
      .then(([row]) => row ?? null),
  ]);

  let regimeAnalysis = null;
  if (llmRow?.regimeAnalysis) {
    try {
      regimeAnalysis = JSON.parse(llmRow.regimeAnalysis);
    } catch {
      regimeAnalysis = llmRow.regimeAnalysis;
    }
  }

  return NextResponse.json({
    regime,
    market,
    llmRegimeAnalysis: regimeAnalysis,
  });
}
