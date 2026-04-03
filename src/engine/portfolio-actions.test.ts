import { describe, it, expect } from 'vitest';
import {
  generateAction,
  evaluateNewCandidate,
  computeTargetPct,
  type ActionContext,
  type CandidateContext,
} from './portfolio-actions.js';
import type { Holding, PortfolioTargets } from '../lib/types.js';

const defaultTargets: PortfolioTargets = {
  pilot_default_pct: 0.05,
  scale_default_pct: 0.15,
  max_sectors: 3,
  cash_reserve_pct: 0.10,
};

function makeHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    symbol: 'ONDO',
    bucket: 'active',
    current_units: 100,
    cost_basis_usd: 1.0,
    pilot_target_pct: null,
    scale_target_pct: null,
    max_position_pct: null,
    thesis: 'RWA adoption',
    thesis_status: 'intact',
    invalidation: 'RWA market collapse',
    execution_exempt: false,
    can_add: true,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    holding: makeHolding(),
    sectorTier: 'pilot',
    tokenScore: 55,
    tokenCandidateStatus: 'pilot',
    regimeLabel: 'stabilising',
    currentPct: 0.04,
    targets: defaultTargets,
    ...overrides,
  };
}

describe('computeTargetPct', () => {
  it('uses pilot default when no holding override', () => {
    expect(computeTargetPct(makeHolding(), 'pilot', defaultTargets)).toBe(0.05);
  });

  it('uses holding pilot override when present', () => {
    expect(computeTargetPct(makeHolding({ pilot_target_pct: 0.08 }), 'pilot', defaultTargets)).toBe(0.08);
  });

  it('returns 0 for observe/ready tiers', () => {
    expect(computeTargetPct(makeHolding(), 'observe', defaultTargets)).toBe(0);
    expect(computeTargetPct(makeHolding(), 'ready', defaultTargets)).toBe(0);
  });

  it('uses scale default', () => {
    expect(computeTargetPct(makeHolding(), 'scale', defaultTargets)).toBe(0.15);
  });
});

describe('generateAction — core holdings', () => {
  it('adds when regime improving and can_add', () => {
    const ctx = makeCtx({
      holding: makeHolding({ symbol: 'BTC', bucket: 'core' }),
      regimeLabel: 'improving',
    });
    const result = generateAction(ctx);
    expect(result.proposedAction).toBe('add');
    expect(result.reasonCode).toBe('regime_improving');
  });

  it('holds when regime stabilising', () => {
    const ctx = makeCtx({
      holding: makeHolding({ symbol: 'BTC', bucket: 'core' }),
      regimeLabel: 'stabilising',
    });
    const result = generateAction(ctx);
    expect(result.proposedAction).toBe('hold');
  });

  it('holds when regime deteriorating', () => {
    const ctx = makeCtx({
      holding: makeHolding({ symbol: 'BTC', bucket: 'core' }),
      regimeLabel: 'deteriorating',
    });
    const result = generateAction(ctx);
    expect(result.proposedAction).toBe('hold');
    expect(result.reasonCode).toBe('regime_deteriorating');
  });
});

describe('generateAction — active holdings', () => {
  it('exits when thesis invalidated', () => {
    const ctx = makeCtx({
      holding: makeHolding({ thesis_status: 'invalidated' }),
    });
    const result = generateAction(ctx);
    expect(result.proposedAction).toBe('exit');
    expect(result.reasonCode).toBe('thesis_invalidated');
    expect(result.confidence).toBe('high');
  });

  it('trims when thesis weakening', () => {
    const ctx = makeCtx({
      holding: makeHolding({ thesis_status: 'weakening' }),
    });
    const result = generateAction(ctx);
    expect(result.proposedAction).toBe('trim');
    expect(result.reasonCode).toBe('thesis_weakening');
  });

  it('trims when overweight above max position', () => {
    const ctx = makeCtx({
      holding: makeHolding({ max_position_pct: 0.05 }),
      currentPct: 0.08,
    });
    const result = generateAction(ctx);
    expect(result.proposedAction).toBe('trim');
    expect(result.reasonCode).toBe('overweight');
  });

  it('trims when above target by >20%', () => {
    const ctx = makeCtx({
      currentPct: 0.07, // > 0.05 * 1.2 = 0.06
      sectorTier: 'pilot',
    });
    const result = generateAction(ctx);
    expect(result.proposedAction).toBe('trim');
    expect(result.reasonCode).toBe('above_target');
  });

  it('adds when below target by >50% at pilot tier', () => {
    const ctx = makeCtx({
      currentPct: 0.02, // < 0.05 * 0.5 = 0.025
      sectorTier: 'pilot',
    });
    const result = generateAction(ctx);
    expect(result.proposedAction).toBe('add');
    expect(result.reasonCode).toBe('below_target');
  });

  it('trims when token underperforming (score < 30)', () => {
    const ctx = makeCtx({
      tokenScore: 20,
      currentPct: 0.04,
      sectorTier: 'ready', // target = 0, so above_target/below_target won't trigger
    });
    const result = generateAction(ctx);
    expect(result.proposedAction).toBe('trim');
    expect(result.reasonCode).toBe('token_underperforming');
  });

  it('holds when no rules trigger', () => {
    const ctx = makeCtx({
      currentPct: 0.045, // within range of target 0.05
      tokenScore: 55,
    });
    const result = generateAction(ctx);
    expect(result.proposedAction).toBe('hold');
  });
});

describe('generateAction — constrained holdings', () => {
  it('returns no_action with execution blocked', () => {
    const ctx = makeCtx({
      holding: makeHolding({ symbol: 'OLAS', bucket: 'constrained', execution_exempt: true }),
    });
    const result = generateAction(ctx);
    expect(result.proposedAction).toBe('no_action');
    expect(result.executionBlocked).toBe(true);
    expect(result.reasonCode).toBe('execution_exempt');
  });
});

describe('evaluateNewCandidate', () => {
  it('returns add for token at pilot + sector at pilot', () => {
    const ctx: CandidateContext = {
      symbol: 'NEW',
      sector: 'rwa',
      sectorTier: 'pilot',
      tokenScore: 55,
      tokenCandidateStatus: 'pilot',
      targets: defaultTargets,
    };
    const result = evaluateNewCandidate(ctx);
    expect(result).not.toBeNull();
    expect(result!.proposedAction).toBe('add');
    expect(result!.reasonCode).toBe('new_candidate');
    expect(result!.confidence).toBe('low');
  });

  it('returns null when sector not at pilot/scale', () => {
    const ctx: CandidateContext = {
      symbol: 'NEW',
      sector: 'rwa',
      sectorTier: 'ready',
      tokenScore: 55,
      tokenCandidateStatus: 'pilot',
      targets: defaultTargets,
    };
    expect(evaluateNewCandidate(ctx)).toBeNull();
  });
});
