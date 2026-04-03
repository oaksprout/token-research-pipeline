import { describe, it, expect } from 'vitest';
import {
  clampTokenSub,
  scoreLiquidity,
  scoreTokenRs,
  scoreStructure,
  scoreVolume,
  scoreValuation,
  computeTokenScore,
} from './tokens.js';

describe('clampTokenSub', () => {
  it('clamps to [0, 20]', () => {
    expect(clampTokenSub(25)).toBe(20);
    expect(clampTokenSub(-5)).toBe(0);
    expect(clampTokenSub(10)).toBe(10);
  });
});

describe('scoreLiquidity', () => {
  it('returns illiquid (4) for very low volume/mcap ratio', () => {
    expect(scoreLiquidity(50, 10_000)).toBe(4); // 0.005
  });

  it('returns low (10) for ratio < 0.05', () => {
    expect(scoreLiquidity(200, 10_000)).toBe(10); // 0.02
  });

  it('returns medium (16) for ratio < 0.15', () => {
    expect(scoreLiquidity(1_000, 10_000)).toBe(16); // 0.10
  });

  it('returns high (20) for ratio >= 0.15', () => {
    expect(scoreLiquidity(2_000, 10_000)).toBe(20); // 0.20
  });

  it('returns neutral (10) when either value is null', () => {
    expect(scoreLiquidity(null, 10_000)).toBe(10);
    expect(scoreLiquidity(1_000, null)).toBe(10);
  });
});

describe('scoreTokenRs', () => {
  it('returns UNDER_BOTH (4) when token underperforms both', () => {
    expect(scoreTokenRs(-0.10, 0.05, 0.02)).toBe(4);
  });

  it('returns OVER_ONE (10) when over one but not both', () => {
    expect(scoreTokenRs(0.06, 0.05, 0.08)).toBe(10); // over BTC, under ETH
  });

  it('returns OVER_BOTH (16) when over both by less than 15%', () => {
    expect(scoreTokenRs(0.20, 0.10, 0.10)).toBe(16); // 10% above each
  });

  it('returns OVER_BOTH_15PCT (20) when over both by more than 15%', () => {
    expect(scoreTokenRs(0.50, 0.10, 0.10)).toBe(20); // 40% above each
  });

  it('returns neutral (10) when priceChange30d is null', () => {
    expect(scoreTokenRs(null, 0.05, 0.02)).toBe(10);
  });
});

describe('scoreStructure', () => {
  it('returns ALL_NEGATIVE (3) when all timeframes negative', () => {
    expect(scoreStructure(-0.05, -0.10, -0.20)).toBe(3);
  });

  it('returns INFLECTION (12) when 7d positive, 30d negative', () => {
    expect(scoreStructure(0.05, -0.10, -0.20)).toBe(12);
  });

  it('returns UPTREND_FORMING (16) when 7d and 30d positive, 90d negative', () => {
    expect(scoreStructure(0.05, 0.10, -0.20)).toBe(16);
  });

  it('returns ESTABLISHED_UPTREND (20) when all positive', () => {
    expect(scoreStructure(0.05, 0.10, 0.20)).toBe(20);
  });

  it('returns MIXED (8) for other combinations', () => {
    expect(scoreStructure(-0.05, 0.10, 0.20)).toBe(8);
  });

  it('returns MIXED (8) when any value is null', () => {
    expect(scoreStructure(null, 0.10, 0.20)).toBe(8);
  });
});

describe('scoreVolume', () => {
  it('returns BELOW_50PCT (4) when volume < 50% of avg', () => {
    expect(scoreVolume(400, 1_000)).toBe(4); // 0.4
  });

  it('returns BELOW_AVG (10) when volume < avg', () => {
    expect(scoreVolume(800, 1_000)).toBe(10); // 0.8
  });

  it('returns EXPANDING (16) when volume above avg but < 2x', () => {
    expect(scoreVolume(1_500, 1_000)).toBe(16); // 1.5
  });

  it('returns STRONG_EXPANDING (20) when volume >= 2x avg', () => {
    expect(scoreVolume(2_500, 1_000)).toBe(20); // 2.5
  });

  it('returns BELOW_AVG (10) when either value is null', () => {
    expect(scoreVolume(null, 1_000)).toBe(10);
    expect(scoreVolume(1_000, null)).toBe(10);
  });
});

describe('scoreValuation', () => {
  it('returns MASSIVE_DILUTION (4) for fdv/mcap >= 10', () => {
    expect(scoreValuation(100_000, 10_000, null)).toBe(4);
  });

  it('returns LOW_DILUTION (16) for fdv/mcap < 2', () => {
    expect(scoreValuation(15_000, 10_000, null)).toBe(16); // 1.5
  });

  it('adds fee revenue bonus clamped to 20', () => {
    // LOW_DILUTION (16) + FEE_REVENUE_BONUS (4) = 20
    expect(scoreValuation(15_000, 10_000, 500_000)).toBe(20);
  });

  it('returns MODERATE_DILUTION (12) when fdv or mcap is null', () => {
    expect(scoreValuation(null, 10_000, null)).toBe(12);
    expect(scoreValuation(100_000, null, null)).toBe(12);
  });
});

describe('computeTokenScore', () => {
  it('assigns observe status for low scores (<30)', () => {
    const result = computeTokenScore({
      volume24h: 50,       // illiquid → 4
      mcap: 10_000,
      fdv: 100_000,        // massive dilution → 4
      priceChange7d: -0.05,
      priceChange30d: -0.10,
      priceChange90d: -0.20, // all negative → 3
      feeRevenue30d: null,
      btcReturn30d: 0.05,
      ethReturn30d: 0.02,  // under both → 4
      avgVolume7d: 1_000,  // below 50% → 4
    });
    expect(result.scoreTotal).toBe(19); // 4+4+3+4+4
    expect(result.candidateStatus).toBe('observe');
  });

  it('assigns ready status for scores 30-49', () => {
    const result = computeTokenScore({
      volume24h: 200,       // low → 10
      mcap: 10_000,
      fdv: 30_000,          // moderate dilution (3x) → 12
      priceChange7d: -0.05,
      priceChange30d: -0.10,
      priceChange90d: -0.20, // all negative → 3
      feeRevenue30d: null,
      btcReturn30d: 0.05,
      ethReturn30d: 0.02,   // under both → 4
      avgVolume7d: 1_000,   // below 50% → 4
    });
    // 10 + 4 + 3 + 4 + 12 = 33
    expect(result.scoreTotal).toBe(33);
    expect(result.candidateStatus).toBe('ready');
  });

  it('assigns pilot status for scores 50-69', () => {
    const result = computeTokenScore({
      volume24h: 1_000,     // medium → 16
      mcap: 10_000,
      fdv: 15_000,          // low dilution → 16
      priceChange7d: 0.05,
      priceChange30d: -0.10,
      priceChange90d: -0.20, // inflection → 12
      feeRevenue30d: null,
      btcReturn30d: -0.05,
      ethReturn30d: 0.02,   // under both → 4
      avgVolume7d: null,     // below avg → 10
    });
    // 16 + 4 + 12 + 10 + 16 = 58
    expect(result.scoreTotal).toBe(58);
    expect(result.candidateStatus).toBe('pilot');
  });

  it('assigns scale status for scores >= 70', () => {
    const result = computeTokenScore({
      volume24h: 2_000,     // high → 20
      mcap: 10_000,
      fdv: 12_000,          // low dilution → 16
      priceChange7d: 0.05,
      priceChange30d: 0.10,
      priceChange90d: 0.20,  // established uptrend → 20
      feeRevenue30d: 500_000, // +4 bonus → 20 (clamped)
      btcReturn30d: -0.10,
      ethReturn30d: -0.15,   // over both by > 15% → 20
      avgVolume7d: 1_000,    // 2x → strong expanding → 20
    });
    // 20 + 20 + 20 + 20 + 20 = 100
    expect(result.scoreTotal).toBe(100);
    expect(result.candidateStatus).toBe('scale');
  });
});
