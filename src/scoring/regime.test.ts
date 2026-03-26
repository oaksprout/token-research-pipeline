import { describe, it, expect } from 'vitest';
import {
  scoreMarketStructure,
  scoreLeverageStress,
  scoreFlowSupport,
  scoreOnchainStress,
  scoreAltStrength,
  computeRegimeScore,
  clampSub,
} from './regime.js';

describe('clampSub', () => {
  it('clamps to [-20, 20]', () => {
    expect(clampSub(25)).toBe(20);
    expect(clampSub(-30)).toBe(-20);
    expect(clampSub(10)).toBe(10);
  });
});

describe('scoreMarketStructure', () => {
  it('returns positive when BTC is above all SMAs with higher lows', () => {
    const score = scoreMarketStructure({
      btcPrice: 100_000,
      btcSma20: 95_000,
      btcSma50: 90_000,
      btcSma200: 80_000,
      weeklyLows4w: [88_000, 90_000, 92_000, 94_000], // higher lows
      week52Low: 40_000,
      week52High: 110_000,
    });
    // above SMA200 (+6) + SMA50 (+4) + SMA20 (+3) + higher lows (+7) + within 20% of 52w high (+4) = 24 → clamped to 20
    expect(score).toBe(20);
  });

  it('returns negative when BTC is below all SMAs with lower lows', () => {
    const score = scoreMarketStructure({
      btcPrice: 30_000,
      btcSma20: 35_000,
      btcSma50: 40_000,
      btcSma200: 50_000,
      weeklyLows4w: [40_000, 38_000, 35_000, 30_000], // lower lows
      week52Low: 28_000,
      week52High: 100_000,
    });
    // below all SMAs (0) + lower lows (-7) + within 10% of 52w low (-4) = -11
    expect(score).toBe(-11);
  });

  it('stays within bounds', () => {
    const score = scoreMarketStructure({
      btcPrice: 50_000,
      btcSma20: 50_000,
      btcSma50: 50_000,
      btcSma200: 50_000,
      weeklyLows4w: [50_000, 50_000, 50_000, 50_000],
      week52Low: 20_000,
      week52High: 100_000,
    });
    expect(score).toBeGreaterThanOrEqual(-20);
    expect(score).toBeLessThanOrEqual(20);
  });
});

describe('scoreLeverageStress', () => {
  it('scores positively for negative funding (bearish flush)', () => {
    const score = scoreLeverageStress({
      fundingRateAvg7d: -0.0005,
      oiChangePct7d: -15,
      liquidationsLong24h: 300_000_000,
      liquidationsShort24h: 0,
    });
    // negative funding (+8) + OI declining (+4) + large long liqs (+4) = 16
    expect(score).toBe(16);
  });

  it('scores negatively for overleveraged market', () => {
    const score = scoreLeverageStress({
      fundingRateAvg7d: 0.001,
      oiChangePct7d: 20,
      liquidationsLong24h: 0,
      liquidationsShort24h: 300_000_000,
    });
    // positive funding (-8) + OI expanding (-4) + large short liqs (-4) = -16
    expect(score).toBe(-16);
  });
});

describe('scoreFlowSupport', () => {
  it('returns 0 when no data available', () => {
    const { score, etfDataAvailable } = scoreFlowSupport({
      etfNetFlowDaily: null,
      stablecoinChange7d: null,
      stablecoinAccelerating: null,
      exchangeNetflowBtc: null,
    });
    expect(score).toBe(0);
    expect(etfDataAvailable).toBe(false);
  });

  it('scores positively for inflows', () => {
    const { score, etfDataAvailable } = scoreFlowSupport({
      etfNetFlowDaily: 100,
      stablecoinChange7d: 0.02,
      stablecoinAccelerating: true,
      exchangeNetflowBtc: -500,
    });
    // ETF inflow (+6) + stablecoin growing (+5) + accel (+3) + exchange outflow (+5) = 19
    expect(score).toBe(19);
    expect(etfDataAvailable).toBe(true);
  });
});

describe('scoreOnchainStress', () => {
  it('scores positively for deep drawdown + oversold RSI', () => {
    const score = scoreOnchainStress({
      btcPrice: 20_000,
      btcAth: 100_000,
      btcRsi14: 25,
    });
    // < 0.3x ATH (+12) + RSI < 30 (+6) = 18
    expect(score).toBe(18);
  });

  it('scores negatively near ATH + overbought', () => {
    const score = scoreOnchainStress({
      btcPrice: 95_000,
      btcAth: 100_000,
      btcRsi14: 75,
    });
    // > 0.8x ATH (-8) + RSI > 70 (-6) = -14
    expect(score).toBe(-14);
  });
});

describe('scoreAltStrength', () => {
  it('scores positively when alts strong vs BTC', () => {
    const score = scoreAltStrength({
      ethBtcAboveSma: true,
      solBtcAboveSma: true,
      ethBtcRising3w: true,
      solBtcRising3w: true,
    });
    // +5 +5 +5 +5 = 20
    expect(score).toBe(20);
  });

  it('scores negatively when alts weak vs BTC', () => {
    const score = scoreAltStrength({
      ethBtcAboveSma: false,
      solBtcAboveSma: false,
      ethBtcRising3w: false,
      solBtcRising3w: false,
    });
    // -5 -5 -5 -5 = -20
    expect(score).toBe(-20);
  });
});

describe('computeRegimeScore', () => {
  it('labels as deteriorating when total <= -20', () => {
    const result = computeRegimeScore({
      subStructure: -15,
      subLeverage: -10,
      subFlows: -5,
      subOnchain: -5,
      subAltStrength: -5,
      etfDataAvailable: true,
    });
    expect(result.scoreTotal).toBe(-40);
    expect(result.label).toBe('deteriorating');
    expect(result.confidence).toBe('high');
    expect(result.sizingImplication).toBe('no aggressive risk');
  });

  it('labels as improving when total >= 20', () => {
    const result = computeRegimeScore({
      subStructure: 10,
      subLeverage: 5,
      subFlows: 5,
      subOnchain: 5,
      subAltStrength: 5,
      etfDataAvailable: true,
    });
    expect(result.scoreTotal).toBe(30);
    expect(result.label).toBe('improving');
    expect(result.confidence).toBe('medium');
    expect(result.sizingImplication).toBe('full sizing OK');
  });

  it('labels as stabilising in the middle', () => {
    const result = computeRegimeScore({
      subStructure: 5,
      subLeverage: -3,
      subFlows: 2,
      subOnchain: 0,
      subAltStrength: 0,
      etfDataAvailable: false,
    });
    expect(result.scoreTotal).toBe(4);
    expect(result.label).toBe('stabilising');
    expect(result.confidence).toBe('low');
    expect(result.sizingImplication).toBe('pilot OK');
  });
});
