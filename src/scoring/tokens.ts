import { TOKEN } from './constants.js';

export function clampTokenSub(value: number): number {
  return Math.max(TOKEN.SUB_SCORE_MIN, Math.min(TOKEN.SUB_SCORE_MAX, value));
}

// ─── Sub-score 1: Liquidity ───────────────────────────────────────

export function scoreLiquidity(volume24h: number | null, mcap: number | null): number {
  const { LIQUIDITY: L } = TOKEN;

  if (volume24h == null || mcap == null) return 10;

  const ratio = volume24h / mcap;

  if (ratio < L.ILLIQUID_THRESHOLD) return L.ILLIQUID;
  if (ratio < L.LOW_THRESHOLD) return L.LOW;
  if (ratio < L.MEDIUM_THRESHOLD) return L.MEDIUM;
  return L.HIGH;
}

// ─── Sub-score 2: Token Relative Strength ─────────────────────────

export function scoreTokenRs(
  priceChange30d: number | null,
  btcReturn30d: number,
  ethReturn30d: number,
): number {
  const { RS: R } = TOKEN;

  if (priceChange30d == null) return 10;

  const overBtc = priceChange30d > btcReturn30d;
  const overEth = priceChange30d > ethReturn30d;

  if (!overBtc && !overEth) return R.UNDER_BOTH;

  if (overBtc && overEth) {
    const btcDiff = priceChange30d - btcReturn30d;
    const ethDiff = priceChange30d - ethReturn30d;
    if (btcDiff > R.OUTPERFORM_THRESHOLD && ethDiff > R.OUTPERFORM_THRESHOLD) {
      return R.OVER_BOTH_15PCT;
    }
    return R.OVER_BOTH;
  }

  return R.OVER_ONE;
}

// ─── Sub-score 3: Structure ───────────────────────────────────────

export function scoreStructure(
  priceChange7d: number | null,
  priceChange30d: number | null,
  priceChange90d: number | null,
): number {
  const { STRUCTURE: S } = TOKEN;

  if (priceChange7d == null || priceChange30d == null || priceChange90d == null) {
    return S.MIXED;
  }

  if (priceChange7d < 0 && priceChange30d < 0 && priceChange90d < 0) return S.ALL_NEGATIVE;
  if (priceChange7d > 0 && priceChange30d > 0 && priceChange90d > 0) return S.ESTABLISHED_UPTREND;
  if (priceChange7d > 0 && priceChange30d > 0 && priceChange90d < 0) return S.UPTREND_FORMING;
  if (priceChange7d > 0 && priceChange30d < 0) return S.INFLECTION;

  return S.MIXED;
}

// ─── Sub-score 4: Volume ──────────────────────────────────────────

export function scoreVolume(volume24h: number | null, avgVolume7d: number | null): number {
  const { VOLUME: V } = TOKEN;

  if (volume24h == null || avgVolume7d == null) return V.BELOW_AVG;

  const ratio = volume24h / avgVolume7d;

  if (ratio < 0.5) return V.BELOW_50PCT;
  if (ratio < 1.0) return V.BELOW_AVG;
  if (ratio < V.EXPAND_THRESHOLD) return V.EXPANDING;
  return V.STRONG_EXPANDING;
}

// ─── Sub-score 5: Valuation ──────────────────────────────────────

export function scoreValuation(
  fdv: number | null,
  mcap: number | null,
  feeRevenue30d: number | null,
): number {
  const { VALUATION: V } = TOKEN;

  if (fdv == null || mcap == null) return V.MODERATE_DILUTION;

  const ratio = fdv / mcap;
  let score: number;

  if (ratio >= V.MASSIVE_DILUTION_THRESHOLD) {
    score = V.MASSIVE_DILUTION;
  } else if (ratio >= V.HIGH_DILUTION_THRESHOLD) {
    score = V.HIGH_DILUTION;
  } else if (ratio >= V.MODERATE_DILUTION_THRESHOLD) {
    score = V.MODERATE_DILUTION;
  } else {
    score = V.LOW_DILUTION;
  }

  if (feeRevenue30d != null && feeRevenue30d > 0) {
    score += V.FEE_REVENUE_BONUS;
  }

  return clampTokenSub(score);
}

// ─── Total ────────────────────────────────────────────────────────

export interface TokenMetricsInput {
  volume24h: number | null;
  mcap: number | null;
  fdv: number | null;
  priceChange7d: number | null;
  priceChange30d: number | null;
  priceChange90d: number | null;
  feeRevenue30d: number | null;
  btcReturn30d: number;
  ethReturn30d: number;
  avgVolume7d: number | null;
}

export interface TokenScoreResult {
  scoreTotal: number;
  subLiquidity: number;
  subRs: number;
  subStructure: number;
  subVolume: number;
  subValuation: number;
  candidateStatus: 'observe' | 'ready' | 'pilot' | 'scale';
}

export function computeTokenScore(input: TokenMetricsInput): TokenScoreResult {
  const subLiquidity = scoreLiquidity(input.volume24h, input.mcap);
  const subRs = scoreTokenRs(input.priceChange30d, input.btcReturn30d, input.ethReturn30d);
  const subStructure = scoreStructure(input.priceChange7d, input.priceChange30d, input.priceChange90d);
  const subVolume = scoreVolume(input.volume24h, input.avgVolume7d);
  const subValuation = scoreValuation(input.fdv, input.mcap, input.feeRevenue30d);

  const scoreTotal = subLiquidity + subRs + subStructure + subVolume + subValuation;

  let candidateStatus: TokenScoreResult['candidateStatus'];
  if (scoreTotal < TOKEN.OBSERVE_THRESHOLD) {
    candidateStatus = 'observe';
  } else if (scoreTotal < TOKEN.READY_THRESHOLD) {
    candidateStatus = 'ready';
  } else if (scoreTotal < TOKEN.PILOT_THRESHOLD) {
    candidateStatus = 'pilot';
  } else {
    candidateStatus = 'scale';
  }

  return {
    scoreTotal,
    subLiquidity,
    subRs,
    subStructure,
    subVolume,
    subValuation,
    candidateStatus,
  };
}
