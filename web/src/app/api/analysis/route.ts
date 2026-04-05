import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { checkAuth, unauthorized } from '@/lib/auth';
import { db } from '@/db';
import { llmAnalysisWeekly } from '@/db/schema';

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

  const [row] = await db
    .select()
    .from(llmAnalysisWeekly)
    .orderBy(desc(llmAnalysisWeekly.date))
    .limit(1);

  if (!row) {
    return NextResponse.json({
      regimeAnalysis: null,
      sectorAnalysis: null,
      portfolioAnalysis: null,
    });
  }

  return NextResponse.json({
    date: row.date,
    regimeAnalysis: tryParse(row.regimeAnalysis),
    sectorAnalysis: tryParse(row.sectorAnalysis),
    portfolioAnalysis: tryParse(row.portfolioAnalysis),
  });
}
