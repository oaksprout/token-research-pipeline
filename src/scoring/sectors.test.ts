import { describe, it, expect } from 'vitest';
import {
  clampSectorSub,
  scoreDevActivity,
  scoreUsage,
  scoreFunding,
  scoreNarrative,
  scoreRelativeStrength,
  checkStructuralFilters,
  checkValidation,
  computeSectorScore,
} from './sectors.js';

describe('clampSectorSub', () => {
  it('clamps to [0, 20]', () => {
    expect(clampSectorSub(25)).toBe(20);
    expect(clampSectorSub(-5)).toBe(0);
    expect(clampSectorSub(10)).toBe(10);
  });
});

describe('scoreDevActivity', () => {
  it('returns correct scores for each bracket', () => {
    expect(scoreDevActivity(null)).toBe(10);
    expect(scoreDevActivity(0)).toBe(5);
    expect(scoreDevActivity(25)).toBe(10);
    expect(scoreDevActivity(50)).toBe(10);
    expect(scoreDevActivity(75)).toBe(15);
    expect(scoreDevActivity(100)).toBe(15);
    expect(scoreDevActivity(150)).toBe(20);
  });
});

describe('scoreUsage', () => {
  it('returns TVL_FLAT for null tvlChange30d', () => {
    expect(scoreUsage(null, null)).toBe(8);
  });

  it('scores TVL brackets correctly', () => {
    expect(scoreUsage(-0.20, null)).toBe(3);   // contracting
    expect(scoreUsage(0.0, null)).toBe(8);      // flat
    expect(scoreUsage(0.15, null)).toBe(14);    // growing
    expect(scoreUsage(0.30, null)).toBe(18);    // accelerating
  });

  it('adds fee revenue bonus clamped to 20', () => {
    expect(scoreUsage(0.30, 100)).toBe(20);    // 18 + 2 = 20
    expect(scoreUsage(0.0, 100)).toBe(10);      // 8 + 2 = 10
  });
});

describe('scoreFunding', () => {
  it('returns correct scores for each bracket', () => {
    expect(scoreFunding(null)).toBe(8);
    expect(scoreFunding(0)).toBe(2);
    expect(scoreFunding(5_000_000)).toBe(8);
    expect(scoreFunding(10_000_000)).toBe(8);
    expect(scoreFunding(30_000_000)).toBe(14);
    expect(scoreFunding(50_000_000)).toBe(14);
    expect(scoreFunding(100_000_000)).toBe(20);
  });
});

describe('scoreNarrative', () => {
  it('returns correct scores for each bracket', () => {
    expect(scoreNarrative(null)).toBe(10);
    expect(scoreNarrative(-0.20)).toBe(3);
    expect(scoreNarrative(-0.08)).toBe(6);
    expect(scoreNarrative(0.0)).toBe(10);
    expect(scoreNarrative(0.10)).toBe(14);
    expect(scoreNarrative(0.20)).toBe(18);
  });
});

describe('scoreRelativeStrength', () => {
  it('returns MATCH_BOTH when both null', () => {
    expect(scoreRelativeStrength(null, null)).toBe(10);
  });

  it('returns UNDER_BOTH when both negative', () => {
    expect(scoreRelativeStrength(-0.10, -0.05)).toBe(3);
  });

  it('returns OVER_BOTH when both positive', () => {
    expect(scoreRelativeStrength(0.10, 0.05)).toBe(18);
  });

  it('returns OVER_BOTH_15PCT when both above threshold', () => {
    expect(scoreRelativeStrength(0.20, 0.20)).toBe(20);
  });

  it('returns OVER_ONE when one positive one negative', () => {
    expect(scoreRelativeStrength(0.10, -0.05)).toBe(14);
  });

  it('returns UNDER_ONE when one negative one zero', () => {
    expect(scoreRelativeStrength(-0.10, 0)).toBe(8);
  });
});

describe('checkStructuralFilters', () => {
  it('passes when all true', () => {
    const result = checkStructuralFilters({
      novel_capability: true,
      capital_pathway: true,
      distribution_vector: true,
    });
    expect(result.passes).toBe(true);
    expect(result.failedFilters).toEqual([]);
  });

  it('fails and lists failed filters', () => {
    const result = checkStructuralFilters({
      novel_capability: true,
      capital_pathway: false,
      distribution_vector: false,
    });
    expect(result.passes).toBe(false);
    expect(result.failedFilters).toEqual(['capital_pathway', 'distribution_vector']);
  });
});

describe('checkValidation', () => {
  it('passes when retention, unit_economics, composability all hold', () => {
    const result = checkValidation(0.05, 1000);
    expect(result.passes).toBe(true);
    expect(result.notes).toEqual([]);
  });

  it('fails and lists failing proxies', () => {
    const result = checkValidation(null, null);
    expect(result.passes).toBe(false);
    expect(result.notes).toContain('retention');
    expect(result.notes).toContain('unit_economics');
    expect(result.notes).toContain('composability');
  });
});

describe('computeSectorScore', () => {
  const allPassFilters = {
    novel_capability: true,
    capital_pathway: true,
    distribution_vector: true,
  };

  const oneFailFilter = {
    novel_capability: true,
    capital_pathway: false,
    distribution_vector: true,
  };

  it('assigns observe tier for low score', () => {
    const result = computeSectorScore(
      {
        devCommitsProxy: 0,          // 5
        tvlChange30d: -0.20,         // 3
        feeRevenue30d: null,         // no bonus
        fundingTotal30d: 0,          // 2
        basketReturn7d: -0.20,       // 3
        basketReturn30d: null,
        rsVsBtc30d: -0.10,          // 3 (under both)
        rsVsEth30d: -0.05,
      },
      allPassFilters,
      null,
      '',
    );
    // 5 + 3 + 2 + 3 + 3 = 16
    expect(result.scoreTotal).toBe(16);
    expect(result.tierCandidate).toBe('observe');
    expect(result.structuralFilter).toBe('pass');
    expect(result.validation).toBe('n/a');
  });

  it('assigns ready tier for mid-range score', () => {
    const result = computeSectorScore(
      {
        devCommitsProxy: 50,         // 10
        tvlChange30d: 0.0,           // 8
        feeRevenue30d: null,
        fundingTotal30d: null,       // 8
        basketReturn7d: 0.0,         // 10
        basketReturn30d: null,
        rsVsBtc30d: null,            // 10
        rsVsEth30d: null,
      },
      allPassFilters,
      null,
      '',
    );
    // 10 + 8 + 8 + 10 + 10 = 46
    expect(result.scoreTotal).toBe(46);
    expect(result.tierCandidate).toBe('ready');
  });

  it('assigns pilot tier for high score with passing validation', () => {
    const result = computeSectorScore(
      {
        devCommitsProxy: 150,        // 20
        tvlChange30d: 0.30,          // 18 + 2 fee = 20
        feeRevenue30d: 5000,
        fundingTotal30d: 100_000_000, // 20
        basketReturn7d: 0.20,        // 18
        basketReturn30d: null,
        rsVsBtc30d: 0.20,           // 20 (over both > 15%)
        rsVsEth30d: 0.20,
      },
      allPassFilters,
      null,
      'TOKEN_A,TOKEN_B',
    );
    // 20 + 20 + 20 + 18 + 20 = 98
    expect(result.scoreTotal).toBe(98);
    expect(result.tierCandidate).toBe('pilot');
    expect(result.validation).toBe('pass');
    expect(result.leaderTokens).toBe('TOKEN_A,TOKEN_B');
  });

  it('caps at observe when structural filter fails even with high score', () => {
    const result = computeSectorScore(
      {
        devCommitsProxy: 150,
        tvlChange30d: 0.30,
        feeRevenue30d: 5000,
        fundingTotal30d: 100_000_000,
        basketReturn7d: 0.20,
        basketReturn30d: null,
        rsVsBtc30d: 0.20,
        rsVsEth30d: 0.20,
      },
      oneFailFilter,
      null,
      '',
    );
    expect(result.scoreTotal).toBe(98);
    expect(result.tierCandidate).toBe('observe');
    expect(result.structuralFilter).toBe('fail');
  });

  it('caps at ready when score >= 60 but validation fails', () => {
    const result = computeSectorScore(
      {
        devCommitsProxy: 150,        // 20
        tvlChange30d: null,          // 8 (no TVL = composability fail)
        feeRevenue30d: null,         // unit_economics fail
        fundingTotal30d: 100_000_000, // 20
        basketReturn7d: 0.20,        // 18
        basketReturn30d: null,
        rsVsBtc30d: 0.20,           // 20
        rsVsEth30d: 0.20,
      },
      allPassFilters,
      null,
      '',
    );
    // 20 + 8 + 20 + 18 + 20 = 86
    expect(result.scoreTotal).toBe(86);
    expect(result.tierCandidate).toBe('ready');
    expect(result.validation).toBe('fail');
  });

  it('computes scoreDelta4w and confidence correctly', () => {
    const result = computeSectorScore(
      {
        devCommitsProxy: 50,
        tvlChange30d: 0.0,
        feeRevenue30d: null,
        fundingTotal30d: null,
        basketReturn7d: 0.0,
        basketReturn30d: null,
        rsVsBtc30d: null,
        rsVsEth30d: null,
      },
      allPassFilters,
      30,   // prior score 4w ago
      '',
    );
    // scoreTotal = 46, delta = 46 - 30 = 16
    expect(result.scoreDelta4w).toBe(16);
    expect(result.confidence).toBe('high');
  });
});
