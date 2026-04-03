import { eq, and, desc } from 'drizzle-orm';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../db/client.js';
import {
  tierRecommendationsWeekly,
  tokenScoresWeekly,
  regimeScoresWeekly,
  tokenMetricsDaily,
  portfolioActionsWeekly,
} from '../db/schema.js';
import { loadPortfolio, loadTokens } from '../lib/config.js';
import { generateAction, evaluateNewCandidate, type ActionContext } from './portfolio-actions.js';
import type { Tier } from './decision-rules.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function generatePortfolioActions(): Promise<void> {
  const date = today();
  console.log(`[portfolio_actions] Starting for ${date}`);

  const portfolio = loadPortfolio();
  const tokensConfig = loadTokens();

  // Get regime
  const [regime] = await db
    .select()
    .from(regimeScoresWeekly)
    .orderBy(desc(regimeScoresWeekly.date))
    .limit(1);

  const regimeLabel = regime?.label ?? 'stabilising';

  // Get all tier recommendations for today
  const tiers = await db
    .select()
    .from(tierRecommendationsWeekly)
    .where(eq(tierRecommendationsWeekly.date, date));

  const tierMap = new Map(tiers.map((t) => [t.sector, t.proposedTier as Tier]));

  // Get all token scores for today
  const tokenScores = await db
    .select()
    .from(tokenScoresWeekly)
    .where(eq(tokenScoresWeekly.date, date));

  const tokenScoreMap = new Map(tokenScores.map((t) => [t.symbol, t]));

  // Get current prices for portfolio value computation
  const currentPrices = await db
    .select()
    .from(tokenMetricsDaily)
    .where(eq(tokenMetricsDaily.date, date));

  const priceMap = new Map(currentPrices.map((p) => [p.symbol, p.priceUsd ?? 0]));

  // Compute total portfolio value
  let totalValue = 0;
  for (const holding of portfolio.holdings) {
    const price = priceMap.get(holding.symbol) ?? 0;
    totalValue += holding.current_units * price;
  }
  if (totalValue === 0) totalValue = 1; // avoid division by zero

  const actions = [];

  // Generate actions for each holding
  for (const holding of portfolio.holdings) {
    const price = priceMap.get(holding.symbol) ?? 0;
    const currentPct = (holding.current_units * price) / totalValue;
    const tokenDef = tokensConfig.tokens[holding.symbol];
    const sectorTier = tokenDef?.sector ? tierMap.get(tokenDef.sector) ?? null : null;
    const tokenScore = tokenScoreMap.get(holding.symbol);

    const ctx: ActionContext = {
      holding,
      sectorTier,
      tokenScore: tokenScore?.scoreTotal ?? null,
      tokenCandidateStatus: tokenScore?.candidateStatus ?? null,
      regimeLabel,
      currentPct,
      targets: portfolio.targets,
    };

    const action = generateAction(ctx);
    actions.push({ ...action, date });
  }

  // Detect new candidates (tokens not in holdings but scoring well)
  const holdingSymbols = new Set(portfolio.holdings.map((h) => h.symbol));
  for (const ts of tokenScores) {
    if (holdingSymbols.has(ts.symbol)) continue;
    if (!ts.sector) continue;

    const sectorTier = tierMap.get(ts.sector);
    if (!sectorTier) continue;

    const candidate = evaluateNewCandidate({
      symbol: ts.symbol,
      sector: ts.sector,
      sectorTier,
      tokenScore: ts.scoreTotal ?? 0,
      tokenCandidateStatus: ts.candidateStatus ?? 'observe',
      targets: portfolio.targets,
    });

    if (candidate) {
      actions.push({ ...candidate, date });
    }
  }

  // Upsert all actions
  for (const action of actions) {
    await db
      .insert(portfolioActionsWeekly)
      .values({
        date: action.date,
        symbol: action.symbol,
        currentBucket: action.currentBucket,
        currentPct: action.currentPct,
        targetPct: action.targetPct,
        proposedAction: action.proposedAction,
        reasonCode: action.reasonCode,
        confidence: action.confidence,
        executionBlocked: action.executionBlocked,
      })
      .onConflictDoUpdate({
        target: [portfolioActionsWeekly.date, portfolioActionsWeekly.symbol],
        set: {
          currentBucket: action.currentBucket,
          currentPct: action.currentPct,
          targetPct: action.targetPct,
          proposedAction: action.proposedAction,
          reasonCode: action.reasonCode,
          confidence: action.confidence,
          executionBlocked: action.executionBlocked,
        },
      });
  }

  // Write JSON output
  const ROOT = resolve(import.meta.dirname, '..', '..');
  const outDir = resolve(ROOT, 'outputs', 'actions');
  mkdirSync(outDir, { recursive: true });

  const jsonActions = actions.map((a) => ({
    symbol: a.symbol,
    current_bucket: a.currentBucket,
    current_pct: Math.round(a.currentPct * 10000) / 10000,
    target_pct: Math.round(a.targetPct * 10000) / 10000,
    proposed_action: a.proposedAction,
    reason_code: a.reasonCode,
    confidence: a.confidence,
    execution_blocked: a.executionBlocked,
  }));

  writeFileSync(
    resolve(outDir, `portfolio_actions_${date}.json`),
    JSON.stringify(jsonActions, null, 2),
  );

  console.log(`[portfolio_actions] Generated ${actions.length} actions for ${date}`);
}
