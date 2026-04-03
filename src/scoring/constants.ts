// ─── Regime Scoring ─────────────────────────────────────────────────

export const REGIME = {
  // Sub-score caps
  SUB_SCORE_MIN: -20,
  SUB_SCORE_MAX: 20,

  // Market Structure
  STRUCTURE: {
    ABOVE_SMA_200: 6,
    ABOVE_SMA_50: 4,
    ABOVE_SMA_20: 3,
    HIGHER_WEEKLY_LOWS_4W: 7,
    LOWER_WEEKLY_LOWS_4W: -7,
    WITHIN_10PCT_52W_LOW: -4,
    WITHIN_20PCT_52W_HIGH: 4,
  },

  // Leverage Stress
  LEVERAGE: {
    FUNDING_NEGATIVE_THRESHOLD: -0.0001,    // -0.01%
    FUNDING_POSITIVE_THRESHOLD: 0.0003,     // 0.03%
    FUNDING_NEAR_ZERO_LOW: -0.0001,
    FUNDING_NEAR_ZERO_HIGH: 0.0001,
    FUNDING_NEGATIVE_POINTS: 8,             // bullish (bears overcrowded)
    FUNDING_POSITIVE_POINTS: -8,            // bearish (excess leverage)
    FUNDING_NEAR_ZERO_POINTS: 4,            // healthy
    OI_DECLINE_THRESHOLD: -10,              // % 7d
    OI_EXPAND_THRESHOLD: 15,               // % 7d
    OI_DECLINE_POINTS: 4,                  // deleveraging = healthier
    OI_EXPAND_POINTS: -4,                  // leverage building
    LIQUIDATION_THRESHOLD: 200_000_000,     // $200M
    LIQUIDATION_LONG_POINTS: 4,            // flush = closer to bottom
    LIQUIDATION_SHORT_POINTS: -4,          // squeeze
  },

  // Flow Support
  FLOWS: {
    ETF_INFLOW_POINTS: 6,
    ETF_OUTFLOW_POINTS: -6,
    STABLECOIN_GROWTH_THRESHOLD: 0.01,      // 1% 7d
    STABLECOIN_SHRINK_THRESHOLD: -0.01,
    STABLECOIN_GROW_POINTS: 5,
    STABLECOIN_SHRINK_POINTS: -5,
    STABLECOIN_ACCEL_POINTS: 3,
    STABLECOIN_DECEL_POINTS: -3,
    EXCHANGE_OUTFLOW_POINTS: 5,            // accumulation
    EXCHANGE_INFLOW_POINTS: -5,            // distribution
  },

  // On-Chain Stress
  ONCHAIN: {
    BTC_DRAWDOWN_50_THRESHOLD: 0.5,        // < 0.5x ATH
    BTC_DRAWDOWN_30_THRESHOLD: 0.3,        // < 0.3x ATH
    BTC_NEAR_ATH_THRESHOLD: 0.8,           // > 0.8x ATH
    DRAWDOWN_50_POINTS: 8,
    DRAWDOWN_30_POINTS: 12,
    NEAR_ATH_POINTS: -8,
    RSI_OVERSOLD: 30,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD_POINTS: 6,
    RSI_OVERBOUGHT_POINTS: -6,
  },

  // Alt Relative Strength
  ALT_STRENGTH: {
    ABOVE_SMA_POINTS: 5,
    BELOW_SMA_POINTS: -5,
    RISING_3W_POINTS: 5,
    FALLING_3W_POINTS: -5,
  },

  // Labels
  DETERIORATING_THRESHOLD: -20,
  IMPROVING_THRESHOLD: 20,
  HIGH_CONFIDENCE_THRESHOLD: 40,
  MEDIUM_CONFIDENCE_THRESHOLD: 20,
} as const;

// ─── Sector Scoring ─────────────────────────────────────────────────

export const SECTOR = {
  SUB_SCORE_MIN: 0,
  SUB_SCORE_MAX: 20,

  DEV: {
    NO_DATA: 10,
    DECLINING: 5,
    STABLE_THRESHOLD: 0.10,
    STABLE: 10,
    GROWING_THRESHOLD: 0.10,
    GROWING: 15,
    ACCELERATING_THRESHOLD: 0.25,
    ACCELERATING: 20,
  },

  USAGE: {
    TVL_CONTRACTING_THRESHOLD: -0.10,
    TVL_CONTRACTING: 3,
    TVL_FLAT: 8,
    TVL_GROWING_THRESHOLD: 0.10,
    TVL_GROWING: 14,
    TVL_ACCELERATING_THRESHOLD: 0.25,
    TVL_ACCELERATING: 18,
    FEE_REVENUE_BONUS: 2,
  },

  FUNDING: {
    NO_DATA_DEFAULT: 8,
    NONE: 2,
    MINOR_THRESHOLD: 10_000_000,
    MINOR: 8,
    SIGNIFICANT_THRESHOLD: 50_000_000,
    SIGNIFICANT: 14,
    MAJOR: 20,
  },

  NARRATIVE: {
    DOWN_HEAVY_THRESHOLD: -0.15,
    DOWN_HEAVY: 3,
    DOWN_LIGHT_THRESHOLD: -0.05,
    DOWN_LIGHT: 6,
    FLAT: 10,
    UP_LIGHT_THRESHOLD: 0.05,
    UP_LIGHT: 14,
    UP_HEAVY_THRESHOLD: 0.15,
    UP_HEAVY: 18,
  },

  RS: {
    UNDER_BOTH: 3,
    UNDER_ONE: 8,
    MATCH_BOTH: 10,
    OVER_ONE: 14,
    OVER_BOTH: 18,
    OVER_BOTH_15PCT: 20,
    OUTPERFORM_THRESHOLD: 0.15,
  },

  // Tier thresholds
  READY_THRESHOLD: 40,
  PILOT_THRESHOLD: 60,
} as const;

// ─── Token Scoring ──────────────────────────────────────────────────

export const TOKEN = {
  SUB_SCORE_MIN: 0,
  SUB_SCORE_MAX: 20,

  LIQUIDITY: {
    ILLIQUID_THRESHOLD: 0.01,
    ILLIQUID: 4,
    LOW_THRESHOLD: 0.05,
    LOW: 10,
    MEDIUM_THRESHOLD: 0.15,
    MEDIUM: 16,
    HIGH: 20,
  },

  RS: {
    UNDER_BOTH: 4,
    OVER_ONE: 10,
    OVER_BOTH: 16,
    OVER_BOTH_15PCT: 20,
    OUTPERFORM_THRESHOLD: 0.15,
  },

  STRUCTURE: {
    ALL_NEGATIVE: 3,
    MIXED: 8,
    INFLECTION: 12,
    UPTREND_FORMING: 16,
    ESTABLISHED_UPTREND: 20,
  },

  VOLUME: {
    BELOW_50PCT: 4,
    BELOW_AVG: 10,
    EXPANDING: 16,
    STRONG_EXPANDING: 20,
    EXPAND_THRESHOLD: 2.0,
  },

  VALUATION: {
    MASSIVE_DILUTION_THRESHOLD: 10,
    MASSIVE_DILUTION: 4,
    HIGH_DILUTION_THRESHOLD: 5,
    HIGH_DILUTION: 8,
    MODERATE_DILUTION_THRESHOLD: 2,
    MODERATE_DILUTION: 12,
    LOW_DILUTION: 16,
    FEE_REVENUE_BONUS: 4,
  },

  // Status thresholds
  OBSERVE_THRESHOLD: 30,
  READY_THRESHOLD: 50,
  PILOT_THRESHOLD: 70,
} as const;
