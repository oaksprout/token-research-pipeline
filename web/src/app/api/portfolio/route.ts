import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import { desc, eq } from 'drizzle-orm';
import { checkAuth, unauthorized } from '@/lib/auth';
import { db } from '@/db';
import { tokenMetricsDaily } from '@/db/schema';

interface Holding {
  symbol: string;
  bucket: string;
  current_units: number;
  cost_basis_usd: number;
  thesis: string;
  thesis_status: string;
  invalidation: string;
  execution_exempt: boolean;
  can_add: boolean;
  pilot_target_pct: number | null;
  scale_target_pct: number | null;
  max_position_pct: number | null;
}

interface PortfolioYaml {
  last_updated: string;
  holdings: Holding[];
  targets: Record<string, unknown>;
}

function loadPortfolio(): PortfolioYaml | null {
  const candidates = [
    resolve(process.cwd(), 'portfolio.yaml'),
    resolve(process.cwd(), '..', 'portfolio.yaml'),
    '/app/portfolio.yaml',
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return yaml.load(readFileSync(p, 'utf8')) as PortfolioYaml;
    }
  }
  return null;
}

export async function GET(request: Request) {
  if (!checkAuth(request)) return unauthorized();

  const portfolio = loadPortfolio();
  const holdings = portfolio?.holdings ?? [];

  // Get latest date from tokenMetricsDaily
  const [latestRow] = await db
    .select({ date: tokenMetricsDaily.date })
    .from(tokenMetricsDaily)
    .orderBy(desc(tokenMetricsDaily.date))
    .limit(1);

  const latestDate = latestRow?.date;

  // Fetch current prices for all held symbols
  const priceMap = new Map<string, number>();
  if (latestDate) {
    const symbols = holdings.map((h) => h.symbol);
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
  }

  let totalValue = 0;
  const enrichedHoldings = holdings.map((h) => {
    const currentPrice = priceMap.get(h.symbol) ?? null;
    const currentValue = currentPrice != null ? h.current_units * currentPrice : null;
    const costBasisTotal = h.cost_basis_usd != null ? h.current_units * h.cost_basis_usd : null;
    const unrealizedPnl =
      currentValue != null && costBasisTotal != null ? currentValue - costBasisTotal : null;
    const unrealizedPnlPct =
      unrealizedPnl != null && costBasisTotal != null && costBasisTotal !== 0
        ? unrealizedPnl / costBasisTotal
        : null;

    if (currentValue != null) totalValue += currentValue;

    return {
      ...h,
      currentPrice,
      currentValue,
      costBasisTotal,
      unrealizedPnl,
      unrealizedPnlPct,
    };
  });

  return NextResponse.json({
    totalValue,
    holdings: enrichedHoldings,
    lastUpdated: portfolio?.last_updated ?? null,
  });
}
