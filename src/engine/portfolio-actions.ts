import type { Holding, PortfolioTargets } from '../lib/types.js';
import type { Tier } from './decision-rules.js';

export type Action = 'add' | 'trim' | 'hold' | 'exit' | 'no_action';

export interface ActionContext {
  holding: Holding;
  sectorTier: Tier | null;
  tokenScore: number | null;
  tokenCandidateStatus: string | null;
  regimeLabel: string;
  currentPct: number;
  targets: PortfolioTargets;
}

export interface PortfolioAction {
  symbol: string;
  currentBucket: string;
  currentPct: number;
  targetPct: number;
  proposedAction: Action;
  reasonCode: string;
  confidence: 'low' | 'medium' | 'high';
  executionBlocked: boolean;
}

// ─── Target percentage logic ───────────────────────────────────────

export function computeTargetPct(
  holding: Holding,
  sectorTier: Tier | null,
  targets: PortfolioTargets,
): number {
  if (sectorTier === 'pilot') {
    return holding.pilot_target_pct ?? targets.pilot_default_pct;
  }
  if (sectorTier === 'scale') {
    return holding.scale_target_pct ?? targets.scale_default_pct;
  }
  return 0; // observe/ready → no target
}

// ─── Per-bucket action logic ───────────────────────────────────────

function computeCoreAction(ctx: ActionContext): PortfolioAction {
  const targetPct = 0; // core has no percentage target

  if (ctx.holding.thesis_status === 'invalidated') {
    return {
      symbol: ctx.holding.symbol,
      currentBucket: ctx.holding.bucket,
      currentPct: ctx.currentPct,
      targetPct,
      proposedAction: 'exit',
      reasonCode: 'thesis_invalidated',
      confidence: 'high',
      executionBlocked: ctx.holding.execution_exempt,
    };
  }

  if (ctx.regimeLabel === 'improving' && ctx.holding.can_add) {
    return {
      symbol: ctx.holding.symbol,
      currentBucket: ctx.holding.bucket,
      currentPct: ctx.currentPct,
      targetPct,
      proposedAction: 'add',
      reasonCode: 'regime_improving',
      confidence: 'medium',
      executionBlocked: false,
    };
  }

  return {
    symbol: ctx.holding.symbol,
    currentBucket: ctx.holding.bucket,
    currentPct: ctx.currentPct,
    targetPct,
    proposedAction: 'hold',
    reasonCode: ctx.regimeLabel === 'deteriorating' ? 'regime_deteriorating' : 'regime_stable',
    confidence: 'low',
    executionBlocked: false,
  };
}

function computeActiveAction(ctx: ActionContext): PortfolioAction {
  const targetPct = computeTargetPct(ctx.holding, ctx.sectorTier, ctx.targets);
  const base = {
    symbol: ctx.holding.symbol,
    currentBucket: ctx.holding.bucket,
    currentPct: ctx.currentPct,
    targetPct,
    executionBlocked: false,
  };

  // 1. Thesis invalidated → exit
  if (ctx.holding.thesis_status === 'invalidated') {
    return { ...base, proposedAction: 'exit', reasonCode: 'thesis_invalidated', confidence: 'high' };
  }

  // 2. Thesis weakening → trim
  if (ctx.holding.thesis_status === 'weakening') {
    return { ...base, proposedAction: 'trim', reasonCode: 'thesis_weakening', confidence: 'medium' };
  }

  // 3. Overweight (above max position)
  if (ctx.holding.max_position_pct != null && ctx.currentPct > ctx.holding.max_position_pct) {
    return { ...base, proposedAction: 'trim', reasonCode: 'overweight', confidence: 'high' };
  }

  // 4. Above target by >20%
  if (targetPct > 0 && ctx.currentPct > targetPct * 1.2) {
    return { ...base, proposedAction: 'trim', reasonCode: 'above_target', confidence: 'high' };
  }

  // 5. Below target by >50% and sector at pilot/scale
  if (
    targetPct > 0 &&
    ctx.currentPct < targetPct * 0.5 &&
    (ctx.sectorTier === 'pilot' || ctx.sectorTier === 'scale') &&
    ctx.holding.can_add
  ) {
    return { ...base, proposedAction: 'add', reasonCode: 'below_target', confidence: 'medium' };
  }

  // 6. Token underperforming sector
  if (ctx.tokenScore != null && ctx.tokenScore < 30) {
    return { ...base, proposedAction: 'trim', reasonCode: 'token_underperforming', confidence: 'medium' };
  }

  // 7. Default → hold
  return { ...base, proposedAction: 'hold', reasonCode: 'no_change', confidence: 'low' };
}

function computeConstrainedAction(ctx: ActionContext): PortfolioAction {
  return {
    symbol: ctx.holding.symbol,
    currentBucket: ctx.holding.bucket,
    currentPct: ctx.currentPct,
    targetPct: 0,
    proposedAction: 'no_action',
    reasonCode: 'execution_exempt',
    confidence: 'low',
    executionBlocked: true,
  };
}

// ─── Main ──────────────────────────────────────────────────────────

export function generateAction(ctx: ActionContext): PortfolioAction {
  if (ctx.holding.bucket === 'constrained' || ctx.holding.execution_exempt) {
    return computeConstrainedAction(ctx);
  }
  if (ctx.holding.bucket === 'core') {
    return computeCoreAction(ctx);
  }
  return computeActiveAction(ctx);
}

// ─── New candidate detection ───────────────────────────────────────

export interface CandidateContext {
  symbol: string;
  sector: string;
  sectorTier: Tier;
  tokenScore: number;
  tokenCandidateStatus: string;
  targets: PortfolioTargets;
}

export function evaluateNewCandidate(ctx: CandidateContext): PortfolioAction | null {
  if (
    (ctx.tokenCandidateStatus === 'pilot' || ctx.tokenCandidateStatus === 'scale') &&
    (ctx.sectorTier === 'pilot' || ctx.sectorTier === 'scale')
  ) {
    return {
      symbol: ctx.symbol,
      currentBucket: 'active',
      currentPct: 0,
      targetPct: ctx.targets.pilot_default_pct,
      proposedAction: 'add',
      reasonCode: 'new_candidate',
      confidence: 'low',
      executionBlocked: false,
    };
  }
  return null;
}
