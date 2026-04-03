import { REGIME } from './constants.js';

const { SUB_SCORE_MIN, SUB_SCORE_MAX } = REGIME;

export function clampSub(value: number): number {
  return Math.max(SUB_SCORE_MIN, Math.min(SUB_SCORE_MAX, value));
}

// ─── Sub-score 1: Market Structure ──────────────────────────────────

export interface MarketStructureInput {
  btcPrice: number;
  btcSma20: number;
  btcSma50: number;
  btcSma200: number;
  weeklyLows4w: number[]; // 4 values, oldest first
  week52Low: number;
  week52High: number;
}

export function scoreMarketStructure(input: MarketStructureInput): number {
  const { STRUCTURE: S } = REGIME;
  let score = 0;

  if (input.btcPrice > input.btcSma200) score += S.ABOVE_SMA_200;
  if (input.btcPrice > input.btcSma50) score += S.ABOVE_SMA_50;
  if (input.btcPrice > input.btcSma20) score += S.ABOVE_SMA_20;

  if (input.weeklyLows4w.length >= 4) {
    const isHigherLows = input.weeklyLows4w.every(
      (v, i) => i === 0 || v >= input.weeklyLows4w[i - 1],
    );
    const isLowerLows = input.weeklyLows4w.every(
      (v, i) => i === 0 || v <= input.weeklyLows4w[i - 1],
    );
    if (isHigherLows) score += S.HIGHER_WEEKLY_LOWS_4W;
    if (isLowerLows) score += S.LOWER_WEEKLY_LOWS_4W;
  }

  const distFromLow = (input.btcPrice - input.week52Low) / input.week52Low;
  if (distFromLow <= 0.10) score += S.WITHIN_10PCT_52W_LOW;

  const distFromHigh =
    (input.week52High - input.btcPrice) / input.week52High;
  if (distFromHigh <= 0.20) score += S.WITHIN_20PCT_52W_HIGH;

  return clampSub(score);
}

// ─── Sub-score 2: Leverage Stress ───────────────────────────────────

export interface LeverageStressInput {
  fundingRateAvg7d: number | null;
  oiChangePct7d: number | null;
  liquidationsLong24h: number | null;
  liquidationsShort24h: number | null;
}

export function scoreLeverageStress(input: LeverageStressInput): number {
  const { LEVERAGE: L } = REGIME;
  let score = 0;

  if (input.fundingRateAvg7d != null) {
    if (input.fundingRateAvg7d < L.FUNDING_NEGATIVE_THRESHOLD) {
      score += L.FUNDING_NEGATIVE_POINTS;
    } else if (input.fundingRateAvg7d > L.FUNDING_POSITIVE_THRESHOLD) {
      score += L.FUNDING_POSITIVE_POINTS;
    } else if (
      input.fundingRateAvg7d >= L.FUNDING_NEAR_ZERO_LOW &&
      input.fundingRateAvg7d <= L.FUNDING_NEAR_ZERO_HIGH
    ) {
      score += L.FUNDING_NEAR_ZERO_POINTS;
    }
  }

  if (input.oiChangePct7d != null) {
    if (input.oiChangePct7d <= L.OI_DECLINE_THRESHOLD) {
      score += L.OI_DECLINE_POINTS;
    } else if (input.oiChangePct7d >= L.OI_EXPAND_THRESHOLD) {
      score += L.OI_EXPAND_POINTS;
    }
  }

  if (
    input.liquidationsLong24h != null &&
    input.liquidationsLong24h > L.LIQUIDATION_THRESHOLD
  ) {
    score += L.LIQUIDATION_LONG_POINTS;
  }

  if (
    input.liquidationsShort24h != null &&
    input.liquidationsShort24h > L.LIQUIDATION_THRESHOLD
  ) {
    score += L.LIQUIDATION_SHORT_POINTS;
  }

  return clampSub(score);
}

// ─── Sub-score 3: Flow Support ──────────────────────────────────────

export interface FlowSupportInput {
  etfNetFlowDaily: number | null;
  stablecoinChange7d: number | null;
  stablecoinAccelerating: boolean | null;
  exchangeNetflowBtc: number | null;
}

export interface FlowSupportResult {
  score: number;
  etfDataAvailable: boolean;
}

export function scoreFlowSupport(input: FlowSupportInput): FlowSupportResult {
  const { FLOWS: F } = REGIME;
  let score = 0;
  let etfDataAvailable = false;

  if (input.etfNetFlowDaily != null) {
    etfDataAvailable = true;
    score += input.etfNetFlowDaily > 0 ? F.ETF_INFLOW_POINTS : F.ETF_OUTFLOW_POINTS;
  }

  if (input.stablecoinChange7d != null) {
    if (input.stablecoinChange7d > F.STABLECOIN_GROWTH_THRESHOLD) {
      score += F.STABLECOIN_GROW_POINTS;
    } else if (input.stablecoinChange7d < F.STABLECOIN_SHRINK_THRESHOLD) {
      score += F.STABLECOIN_SHRINK_POINTS;
    }
  }

  if (input.stablecoinAccelerating != null) {
    score += input.stablecoinAccelerating
      ? F.STABLECOIN_ACCEL_POINTS
      : F.STABLECOIN_DECEL_POINTS;
  }

  if (input.exchangeNetflowBtc != null) {
    score += input.exchangeNetflowBtc < 0
      ? F.EXCHANGE_OUTFLOW_POINTS
      : F.EXCHANGE_INFLOW_POINTS;
  }

  return { score: clampSub(score), etfDataAvailable };
}

// ─── Sub-score 4: On-Chain Stress ───────────────────────────────────

export interface OnchainStressInput {
  btcPrice: number;
  btcAth: number;
  btcRsi14: number | null;
}

export function scoreOnchainStress(input: OnchainStressInput): number {
  const { ONCHAIN: O } = REGIME;
  let score = 0;

  const athRatio = input.btcPrice / input.btcAth;

  if (athRatio < O.BTC_DRAWDOWN_30_THRESHOLD) {
    score += O.DRAWDOWN_30_POINTS;
  } else if (athRatio < O.BTC_DRAWDOWN_50_THRESHOLD) {
    score += O.DRAWDOWN_50_POINTS;
  } else if (athRatio > O.BTC_NEAR_ATH_THRESHOLD) {
    score += O.NEAR_ATH_POINTS;
  }

  if (input.btcRsi14 != null) {
    if (input.btcRsi14 < O.RSI_OVERSOLD) {
      score += O.RSI_OVERSOLD_POINTS;
    } else if (input.btcRsi14 > O.RSI_OVERBOUGHT) {
      score += O.RSI_OVERBOUGHT_POINTS;
    }
  }

  return clampSub(score);
}

// ─── Sub-score 5: Alt Relative Strength ─────────────────────────────

export interface AltStrengthInput {
  ethBtcAboveSma: boolean;
  solBtcAboveSma: boolean;
  ethBtcRising3w: boolean;
  solBtcRising3w: boolean;
}

export function scoreAltStrength(input: AltStrengthInput): number {
  const { ALT_STRENGTH: A } = REGIME;
  let score = 0;

  score += input.ethBtcAboveSma ? A.ABOVE_SMA_POINTS : A.BELOW_SMA_POINTS;
  score += input.solBtcAboveSma ? A.ABOVE_SMA_POINTS : A.BELOW_SMA_POINTS;
  score += input.ethBtcRising3w ? A.RISING_3W_POINTS : A.FALLING_3W_POINTS;
  score += input.solBtcRising3w ? A.RISING_3W_POINTS : A.FALLING_3W_POINTS;

  return clampSub(score);
}

// ─── Regime Total ───────────────────────────────────────────────────

export interface RegimeSubScores {
  subStructure: number;
  subLeverage: number;
  subFlows: number;
  subOnchain: number;
  subAltStrength: number;
  etfDataAvailable: boolean;
}

export interface RegimeResult {
  scoreTotal: number;
  label: 'deteriorating' | 'stabilising' | 'improving';
  confidence: 'low' | 'medium' | 'high';
  sizingImplication: string;
  subStructure: number;
  subLeverage: number;
  subFlows: number;
  subOnchain: number;
  subAltStrength: number;
  etfDataAvailable: boolean;
}

export function computeRegimeScore(subs: RegimeSubScores): RegimeResult {
  const total =
    subs.subStructure +
    subs.subLeverage +
    subs.subFlows +
    subs.subOnchain +
    subs.subAltStrength;

  let label: RegimeResult['label'];
  if (total <= REGIME.DETERIORATING_THRESHOLD) {
    label = 'deteriorating';
  } else if (total >= REGIME.IMPROVING_THRESHOLD) {
    label = 'improving';
  } else {
    label = 'stabilising';
  }

  let confidence: RegimeResult['confidence'];
  const absTotal = Math.abs(total);
  if (absTotal >= REGIME.HIGH_CONFIDENCE_THRESHOLD) {
    confidence = 'high';
  } else if (absTotal >= REGIME.MEDIUM_CONFIDENCE_THRESHOLD) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  let sizingImplication: string;
  if (label === 'deteriorating') {
    sizingImplication = 'no aggressive risk';
  } else if (label === 'stabilising') {
    sizingImplication = 'pilot OK';
  } else {
    sizingImplication = 'full sizing OK';
  }

  return {
    scoreTotal: total,
    label,
    confidence,
    sizingImplication,
    ...subs,
  };
}
