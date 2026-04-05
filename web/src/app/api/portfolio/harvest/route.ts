import { NextResponse } from 'next/server';
import { desc, eq, isNull } from 'drizzle-orm';
import { checkAuth, unauthorized } from '@/lib/auth';
import { db } from '@/db';
import { taxLots, tokenMetricsDaily } from '@/db/schema';

export async function GET(request: Request) {
  if (!checkAuth(request)) return unauthorized();

  // Get all open lots
  const openLots = await db
    .select()
    .from(taxLots)
    .where(isNull(taxLots.disposedAt));

  // Get latest prices
  const symbols = [...new Set(openLots.map((l) => l.symbol))];
  const priceMap = new Map<string, number>();
  for (const symbol of symbols) {
    const [row] = await db
      .select({ priceUsd: tokenMetricsDaily.priceUsd })
      .from(tokenMetricsDaily)
      .where(eq(tokenMetricsDaily.symbol, symbol))
      .orderBy(desc(tokenMetricsDaily.date))
      .limit(1);
    if (row?.priceUsd != null) {
      priceMap.set(symbol, row.priceUsd);
    }
  }

  const now = Date.now();

  // Only lots with unrealized losses
  const candidates = openLots
    .map((lot) => {
      const currentPrice = priceMap.get(lot.symbol) ?? 0;
      const currentValue = lot.quantity * currentPrice;
      const unrealizedGainLoss = currentValue - lot.costBasis;
      const holdingPeriodDays = Math.floor(
        (now - new Date(lot.acquiredAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const term = holdingPeriodDays < 365 ? 'short-term' : 'long-term';

      return {
        ...lot,
        currentPrice,
        currentValue,
        holdingPeriodDays,
        term,
        unrealizedGainLoss,
      };
    })
    .filter((lot) => lot.unrealizedGainLoss < 0)
    .sort((a, b) => a.unrealizedGainLoss - b.unrealizedGainLoss); // largest loss first

  const totalHarvestable = candidates.reduce((sum, c) => sum + Math.abs(c.unrealizedGainLoss), 0);

  return NextResponse.json({
    candidates,
    totalHarvestable,
    taxSavings20pct: totalHarvestable * 0.2,
    taxSavings40pct: totalHarvestable * 0.4,
  });
}
