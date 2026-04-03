import { describe, it, expect } from 'vitest';
import { computeTierRecommendation, type TierContext } from './decision-rules.js';

function baseTierContext(overrides: Partial<TierContext> = {}): TierContext {
  return {
    sector: 'rwa',
    currentTier: 'observe',
    sectorScore: 50,
    sectorScoreHistory: [45, 48, 50],
    structuralFilterPasses: true,
    validationPasses: true,
    leaderToken: 'ONDO',
    leaderTokenScore: 60,
    regimeLabel: 'stabilising',
    weeksAtCurrentTier: 3,
    ...overrides,
  };
}

describe('computeTierRecommendation', () => {
  it('promotes observe → ready when score ≥40 and rising 2+ weeks', () => {
    const ctx = baseTierContext({
      currentTier: 'observe',
      sectorScore: 45,
      sectorScoreHistory: [38, 42, 45],
    });
    const result = computeTierRecommendation(ctx);
    expect(result.proposedTier).toBe('ready');
    expect(result.tierChanged).toBe(true);
    expect(result.changeReason).toBe('score_gte_40_rising_2w');
  });

  it('keeps observe when score < 40', () => {
    const ctx = baseTierContext({
      currentTier: 'observe',
      sectorScore: 35,
      sectorScoreHistory: [30, 32, 35],
    });
    const result = computeTierRecommendation(ctx);
    expect(result.proposedTier).toBe('observe');
    expect(result.tierChanged).toBe(false);
  });

  it('promotes ready → pilot when score ≥60, validated, stable, 2+ weeks', () => {
    const ctx = baseTierContext({
      currentTier: 'ready',
      sectorScore: 65,
      sectorScoreHistory: [58, 62, 65],
      weeksAtCurrentTier: 3,
    });
    const result = computeTierRecommendation(ctx);
    expect(result.proposedTier).toBe('pilot');
    expect(result.tierChanged).toBe(true);
  });

  it('blocks ready → pilot when validation fails', () => {
    const ctx = baseTierContext({
      currentTier: 'ready',
      sectorScore: 65,
      sectorScoreHistory: [58, 62, 65],
      validationPasses: false,
      weeksAtCurrentTier: 3,
    });
    const result = computeTierRecommendation(ctx);
    expect(result.proposedTier).toBe('ready');
    expect(result.tierChanged).toBe(false);
  });

  it('blocks ready → pilot when less than 2 weeks at ready', () => {
    const ctx = baseTierContext({
      currentTier: 'ready',
      sectorScore: 65,
      sectorScoreHistory: [58, 62, 65],
      weeksAtCurrentTier: 1,
    });
    const result = computeTierRecommendation(ctx);
    expect(result.proposedTier).toBe('ready');
    expect(result.tierChanged).toBe(false);
  });

  it('promotes pilot → scale when regime OK and leader ≥70', () => {
    const ctx = baseTierContext({
      currentTier: 'pilot',
      sectorScore: 65,
      sectorScoreHistory: [60, 62, 65],
      leaderTokenScore: 75,
      regimeLabel: 'improving',
    });
    const result = computeTierRecommendation(ctx);
    expect(result.proposedTier).toBe('scale');
    expect(result.tierChanged).toBe(true);
  });

  it('blocks pilot → scale when regime is deteriorating', () => {
    const ctx = baseTierContext({
      currentTier: 'pilot',
      sectorScore: 65,
      sectorScoreHistory: [60, 62, 65],
      leaderTokenScore: 75,
      regimeLabel: 'deteriorating',
    });
    const result = computeTierRecommendation(ctx);
    expect(result.proposedTier).toBe('pilot');
    expect(result.tierChanged).toBe(false);
  });

  it('demotes when declining 3+ weeks', () => {
    const ctx = baseTierContext({
      currentTier: 'pilot',
      sectorScore: 55,
      sectorScoreHistory: [65, 60, 55],
    });
    const result = computeTierRecommendation(ctx);
    expect(result.proposedTier).toBe('ready');
    expect(result.tierChanged).toBe(true);
    expect(result.changeReason).toBe('declining_3w');
  });

  it('demotes to observe when structural filter fails', () => {
    const ctx = baseTierContext({
      currentTier: 'ready',
      sectorScore: 50,
      structuralFilterPasses: false,
    });
    const result = computeTierRecommendation(ctx);
    expect(result.proposedTier).toBe('observe');
    expect(result.tierChanged).toBe(true);
    expect(result.changeReason).toBe('structural_filter_failed');
  });

  it('demotes when leader token lost', () => {
    const ctx = baseTierContext({
      currentTier: 'pilot',
      sectorScore: 60,
      sectorScoreHistory: [58, 59, 60],
      leaderTokenScore: 25,
    });
    const result = computeTierRecommendation(ctx);
    expect(result.proposedTier).toBe('ready');
    expect(result.changeReason).toBe('leader_token_lost');
  });

  it('returns no_change when no promotion or demotion applies', () => {
    const ctx = baseTierContext({
      currentTier: 'scale',
      sectorScore: 65,
      sectorScoreHistory: [63, 64, 65],
      leaderTokenScore: 75,
      regimeLabel: 'improving',
    });
    const result = computeTierRecommendation(ctx);
    expect(result.proposedTier).toBe('scale');
    expect(result.tierChanged).toBe(false);
    expect(result.changeReason).toBe('no_change');
  });
});
