/**
 * Glossary of all metrics, scores, and terms used in the pipeline.
 * Used for tooltips throughout the UI and the /docs page.
 */

export const glossary: Record<string, { short: string; long: string }> = {
  // ─── Regime ────────────────────────────────────────────────────────
  regime: {
    short: 'Overall crypto market condition',
    long: 'A composite score (-100 to +100) from 5 sub-scores measuring market structure, leverage, flows, on-chain stress, and alt strength. Determines whether the market is deteriorating, stabilising, or improving.',
  },
  regimeScore: {
    short: 'Sum of 5 sub-scores, -100 to +100',
    long: 'Total regime score. Each sub-score ranges from -20 to +20. Negative = bearish signals dominating. Positive = bullish signals. The label is derived from this: ≤-20 = deteriorating, ≥+20 = improving, else stabilising.',
  },
  marketStructure: {
    short: 'BTC price vs moving averages + trend',
    long: 'Scores BTC position relative to 20/50/200-day SMAs (+3/+4/+6 if above), whether weekly lows are rising (+7) or falling (-7), and proximity to 52-week high/low. Range: -20 to +20. Requires 200 days of data for full accuracy.',
  },
  leverageStress: {
    short: 'Funding rates, open interest, liquidations',
    long: 'Measures derivative market health. Negative funding = bears overcrowded (+8). High positive funding = excess leverage (-8). Declining OI = deleveraging (+4). Large liquidations signal flush events. Range: -20 to +20.',
  },
  flowSupport: {
    short: 'ETF flows, stablecoin trends, exchange flows',
    long: 'Tracks capital entering/leaving crypto. ETF inflows (+6), stablecoin growth (+5), stablecoin acceleration (+3), exchange outflows (+5). Currently degraded: ETF data requires manual input, exchange flow not yet implemented.',
  },
  onchainStress: {
    short: 'BTC drawdown from ATH + RSI extremes',
    long: 'Measures how far BTC is from all-time high and whether RSI signals oversold/overbought. Deep drawdown (<0.3x ATH) is actually bullish (+12, closer to bottom). Near ATH (>0.8x) is bearish (-8). RSI <30 adds +6, >70 adds -6.',
  },
  altStrength: {
    short: 'ETH/BTC and SOL/BTC ratio momentum',
    long: 'Checks if alts are gaining or losing ground vs BTC. Each ratio checked: above 20-day SMA (+5 each), rising for 3 weeks (+5 each). All negative = -20 (alts bleeding). Requires 20 days of ratio data for SMA calculation.',
  },
  sizingImplication: {
    short: 'Position sizing guidance from regime',
    long: 'Deteriorating = "no aggressive risk" (hold, don\'t add). Stabilising = "pilot OK" (small positions). Improving = "full sizing OK" (scale up).',
  },
  confidence: {
    short: 'How extreme the signal is',
    long: 'Based on absolute score magnitude. |score| ≥40 = high confidence. |score| ≥20 = medium. Below = low. Low confidence means the market is ambiguous.',
  },
  etfDataAvailable: {
    short: 'Whether ETF flow data was included',
    long: 'ETF net flow data must be manually entered or fetched from SoSoValue. When missing, the flow support sub-score loses its ETF component (±6 points unavailable).',
  },

  // ─── Sectors ───────────────────────────────────────────────────────
  sectorScore: {
    short: 'Composite sector health, 0-100',
    long: '5 sub-scores (0-20 each): Dev activity, Usage/TVL, Funding, Narrative momentum, and Relative Strength vs BTC/ETH. Gated by structural filter (novel capability, capital pathway, distribution vector) and validation proxies.',
  },
  subDev: {
    short: 'Developer activity proxy',
    long: 'Based on GitHub commit counts from tracked repos. No data = 10 (neutral), 0 commits = 5 (declining), >0 = 10, >50 = 15, >100 = 20 (accelerating). Most sectors have no repos configured yet → defaults to 10.',
  },
  subUsage: {
    short: 'TVL trend + fee revenue',
    long: 'Measures 30-day TVL change: contracting (<-10%) = 3, flat = 8, growing (>+10%) = 14, accelerating (>+25%) = 18. Fee revenue adds +2 bonus. Sectors without TVL categories default to 8.',
  },
  subFunding: {
    short: 'Funding rounds in last 30 days',
    long: 'None = 2, <$10M = 8, <$50M = 14, >$50M = 20. No automated data source in v1 → defaults to 8 (no data). Will improve with CryptoRank or similar integration.',
  },
  subNarrative: {
    short: 'Market sentiment proxy via 7d return',
    long: 'Uses sector basket 7-day return as a narrative momentum proxy. Heavy sell-off (<-15%) = 3, light dip (<-5%) = 6, flat = 10, light rally (>+5%) = 14, heavy rally (>+15%) = 18.',
  },
  subRs: {
    short: 'Sector return vs BTC and ETH',
    long: 'Compares sector basket 30-day return against BTC and ETH returns. Under both = 3, under one = 8, match = 10, over one = 14, over both = 18, over both by >15% = 20.',
  },
  structuralFilter: {
    short: 'Must-have sector characteristics',
    long: 'Three gates from sectors.yaml: novel_capability (does the sector offer something new?), capital_pathway (clear token value mechanism?), distribution_vector (organic growth channel?). All must pass or tier is capped at Observe.',
  },
  validation: {
    short: 'Quality proxies for Pilot eligibility',
    long: 'Three proxies checked at score ≥60: retention (TVL growing), unit economics (fee revenue > 0), composability (measurable TVL exists). Failure caps tier at Ready even with high score.',
  },
  tierCandidate: {
    short: 'Proposed allocation tier',
    long: 'Observe (score <40, no allocation), Ready (40-59, watching), Pilot (≥60 + validation pass, small position), Scale (Pilot + regime OK + leader token ≥70). Tier changes require sustained score trends, not single-week spikes.',
  },
  scoreDelta4w: {
    short: 'Score change over 4 weeks',
    long: 'Current score minus score from 4 weeks ago. Positive = improving trend. Null on first run (no historical comparison available).',
  },

  // ─── Tokens ────────────────────────────────────────────────────────
  tokenScore: {
    short: 'Individual token quality, 0-100',
    long: '5 sub-scores (0-20 each): Liquidity, Relative Strength, Price Structure, Volume trend, Valuation sanity. Determines candidate status: <30 Observe, <50 Ready, <70 Pilot, ≥70 Scale.',
  },
  subLiquidity: {
    short: 'Volume/market cap ratio',
    long: 'Measures how tradeable a token is. Volume/mcap <1% = illiquid (4), <5% = low (10), <15% = medium (16), ≥15% = high (20).',
  },
  tokenSubRs: {
    short: 'Token return vs BTC and ETH',
    long: '30-day return compared to BTC and ETH. Under both = 4, over one = 10, over both = 16, over both by >15% = 20.',
  },
  subStructure: {
    short: 'Price trend across timeframes',
    long: 'Checks 7d, 30d, 90d returns. All negative = 3 (downtrend), 7d positive + 30d negative = 12 (inflection), 7d+30d positive + 90d negative = 16 (uptrend forming), all positive = 20 (established uptrend), mixed = 8.',
  },
  subVolume: {
    short: 'Recent volume vs 7-day average',
    long: 'Ratio of today\'s volume to 7-day average. <0.5x = 4 (drying up), <1x = 10 (below average), <2x = 16 (expanding), ≥2x = 20 (strong expansion).',
  },
  subValuation: {
    short: 'FDV/market cap dilution risk',
    long: 'Measures how much supply is unlocked. FDV/mcap ≥10x = massive dilution (4), ≥5x = high (8), ≥2x = moderate (12), <2x = low (16). Fee revenue adds +4 bonus.',
  },
  candidateStatus: {
    short: 'Token allocation readiness',
    long: 'Observe (<30), Ready (30-49), Pilot (50-69), Scale (≥70). Determines whether the token qualifies for position sizing within its sector tier.',
  },
  rankInSector: {
    short: 'Position within sector by score',
    long: 'Tokens ranked by total score within their sector. Rank 1 = leader token, which gets referenced in tier recommendations.',
  },

  // ─── Portfolio Actions ─────────────────────────────────────────────
  proposedAction: {
    short: 'Recommended trade for this position',
    long: 'Core holdings: respond only to regime (add if improving, hold otherwise). Active holdings: ordered rules — thesis invalidated→exit, weakening→trim, overweight→trim, below target→add, underperforming→trim. Constrained: always no_action.',
  },
  currentPct: {
    short: 'Current portfolio weight',
    long: 'Position value divided by total portfolio value, calculated from live Zerion wallet data across all tracked addresses.',
  },
  targetPct: {
    short: 'Target portfolio weight from tier',
    long: 'Pilot tier = 5% (default), Scale tier = 15% (default). Overridden by per-holding targets in portfolio.yaml if set. Observe/Ready tiers = 0% target (hold existing, don\'t add).',
  },
  executionBlocked: {
    short: 'Whether trading is restricted',
    long: 'True for constrained holdings (e.g., OLAS — co-founder locked tokens). These appear in reports for awareness but generate no trade recommendations.',
  },
  reasonCode: {
    short: 'Why this action was proposed',
    long: 'thesis_invalidated = thesis broken, exit. thesis_weakening = losing conviction, trim. overweight = above max position limit. above_target/below_target = rebalancing. regime_improving/deteriorating = macro signal for core. token_underperforming = score dropped below threshold.',
  },

  // ─── Data Quality ──────────────────────────────────────────────────
  firstRunWarning: {
    short: 'Scores are partially informed',
    long: 'On the first run, many indicators are null because they need historical data: SMAs need 20-200 days, RSI needs 15 days, stablecoin 7d change needs a week, score deltas need 4 weeks. Scores will become more accurate as daily data accumulates.',
  },

  // ─── Pipeline ──────────────────────────────────────────────────────
  dailyIngest: {
    short: 'Daily data collection job',
    long: 'Runs daily at 7 AM. Fetches: CoinGecko (prices, market caps, dominance), Binance (funding rates, open interest), DefiLlama (stablecoin mcap, sector TVL/fees), Zerion (live wallet positions). Computes SMAs, RSI, ratios.',
  },
  weeklyScoring: {
    short: 'Weekly analysis pipeline',
    long: 'Runs Sundays at 8 AM. Sequence: regime scoring → sector scoring → token scoring → tier recommendations → portfolio actions → report generation → context bundle for LLM review.',
  },
  llmReview: {
    short: 'Optional LLM interpretation layer',
    long: 'After deterministic scoring, an optional script sends the context bundle to GPT-4o for strategic interpretation. Three prompts: regime review (is the label correct?), sector review (which tiers to prioritise?), portfolio briefing (top 5 actions). All traced.',
  },
};

export type GlossaryKey = keyof typeof glossary;
