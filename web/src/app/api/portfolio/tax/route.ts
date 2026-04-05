import { NextResponse } from 'next/server';
import { desc, eq, isNull } from 'drizzle-orm';
import { checkAuth, unauthorized } from '@/lib/auth';
import { db } from '@/db';
import { taxLots, tokenMetricsDaily } from '@/db/schema';

export async function GET(request: Request) {
  if (!checkAuth(request)) return unauthorized();

  // Get all open lots (not disposed)
  const openLots = await db
    .select()
    .from(taxLots)
    .where(isNull(taxLots.disposedAt));

  // Get latest prices for each symbol
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
  let totalCostBasis = 0;
  let totalCurrentValue = 0;
  let totalUnrealizedGainLoss = 0;

  const lots = openLots.map((lot) => {
    const currentPrice = priceMap.get(lot.symbol) ?? 0;
    const currentValue = lot.quantity * currentPrice;
    const holdingPeriodDays = Math.floor(
      (now - new Date(lot.acquiredAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const term = holdingPeriodDays < 365 ? 'short-term' : 'long-term';
    const unrealizedGainLoss = currentValue - lot.costBasis;

    totalCostBasis += lot.costBasis;
    totalCurrentValue += currentValue;
    totalUnrealizedGainLoss += unrealizedGainLoss;

    return {
      ...lot,
      currentPrice,
      currentValue,
      holdingPeriodDays,
      term,
      unrealizedGainLoss,
    };
  });

  return NextResponse.json({
    lots,
    summary: {
      totalCostBasis,
      totalCurrentValue,
      totalUnrealizedGainLoss,
    },
  });
}
