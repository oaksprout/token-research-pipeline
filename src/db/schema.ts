import {
  pgTable,
  text,
  real,
  integer,
  boolean,
  timestamp,
  primaryKey,
  uuid,
} from 'drizzle-orm/pg-core';

// ─── Daily Ingest Tables ────────────────────────────────────────────

export const marketDaily = pgTable('market_daily', {
  date: text('date').primaryKey(),
  btcPrice: real('btc_price'),
  ethPrice: real('eth_price'),
  solPrice: real('sol_price'),
  btcVolume: real('btc_volume'),
  ethVolume: real('eth_volume'),
  btcMcap: real('btc_mcap'),
  totalMcap: real('total_mcap'),
  btcDominance: real('btc_dominance'),
  btcSma20: real('btc_sma_20'),
  btcSma50: real('btc_sma_50'),
  btcSma200: real('btc_sma_200'),
  btcRsi14: real('btc_rsi_14'),
  ethBtcRatio: real('eth_btc_ratio'),
  solBtcRatio: real('sol_btc_ratio'),
  ethBtcRatioSma20: real('eth_btc_ratio_sma_20'),
  solBtcRatioSma20: real('sol_btc_ratio_sma_20'),
  stablecoinMcapSma7: real('stablecoin_mcap_sma_7'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const flowsDaily = pgTable('flows_daily', {
  date: text('date').primaryKey(),
  fundingRateAvg: real('funding_rate_avg'),
  openInterestBtc: real('open_interest_btc'),
  oiChangePct24h: real('oi_change_pct_24h'),
  liquidationsLong24h: real('liquidations_long_24h'),
  liquidationsShort24h: real('liquidations_short_24h'),
  etfNetFlowDaily: real('etf_net_flow_daily'),
  stablecoinTotalMcap: real('stablecoin_total_mcap'),
  stablecoinChange7d: real('stablecoin_change_7d'),
  exchangeNetflowBtc: real('exchange_netflow_btc'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const tokenMetricsDaily = pgTable(
  'token_metrics_daily',
  {
    date: text('date').notNull(),
    symbol: text('symbol').notNull(),
    priceUsd: real('price_usd'),
    volume24h: real('volume_24h'),
    mcap: real('mcap'),
    fdv: real('fdv'),
    priceChange7d: real('price_change_7d'),
    priceChange30d: real('price_change_30d'),
    priceChange90d: real('price_change_90d'),
  },
  (t) => [primaryKey({ columns: [t.date, t.symbol] })],
);

// ─── Weekly Scoring Tables ──────────────────────────────────────────

export const sectorMetricsWeekly = pgTable(
  'sector_metrics_weekly',
  {
    date: text('date').notNull(),
    sector: text('sector').notNull(),
    basketReturn7d: real('basket_return_7d'),
    basketReturn30d: real('basket_return_30d'),
    rsVsBtc30d: real('rs_vs_btc_30d'),
    rsVsEth30d: real('rs_vs_eth_30d'),
    tvlTotal: real('tvl_total'),
    tvlChange30d: real('tvl_change_30d'),
    feeRevenue30d: real('fee_revenue_30d'),
    devCommitsProxy: real('dev_commits_proxy'),
    fundingEvents30d: integer('funding_events_30d'),
    fundingTotal30d: real('funding_total_30d'),
  },
  (t) => [primaryKey({ columns: [t.date, t.sector] })],
);

export const regimeScoresWeekly = pgTable('regime_scores_weekly', {
  date: text('date').primaryKey(),
  scoreTotal: real('score_total'),
  label: text('label'),
  confidence: text('confidence'),
  subStructure: real('sub_structure'),
  subLeverage: real('sub_leverage'),
  subFlows: real('sub_flows'),
  subOnchain: real('sub_onchain'),
  subAltStrength: real('sub_alt_strength'),
  sizingImplication: text('sizing_implication'),
  etfDataAvailable: boolean('etf_data_available'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sectorScoresWeekly = pgTable(
  'sector_scores_weekly',
  {
    date: text('date').notNull(),
    sector: text('sector').notNull(),
    scoreTotal: real('score_total'),
    scoreDelta4w: real('score_delta_4w'),
    confidence: text('confidence'),
    structuralFilter: text('structural_filter'),
    validation: text('validation'),
    subDev: real('sub_dev'),
    subUsage: real('sub_usage'),
    subFunding: real('sub_funding'),
    subNarrative: real('sub_narrative'),
    subRs: real('sub_rs'),
    tierCandidate: text('tier_candidate'),
    leaderTokens: text('leader_tokens'),
  },
  (t) => [primaryKey({ columns: [t.date, t.sector] })],
);

export const tokenScoresWeekly = pgTable(
  'token_scores_weekly',
  {
    date: text('date').notNull(),
    symbol: text('symbol').notNull(),
    sector: text('sector'),
    scoreTotal: real('score_total'),
    rankInSector: integer('rank_in_sector'),
    subLiquidity: real('sub_liquidity'),
    subRs: real('sub_rs'),
    subStructure: real('sub_structure'),
    subVolume: real('sub_volume'),
    subValuation: real('sub_valuation'),
    candidateStatus: text('candidate_status'),
  },
  (t) => [primaryKey({ columns: [t.date, t.symbol] })],
);

export const tierRecommendationsWeekly = pgTable(
  'tier_recommendations_weekly',
  {
    date: text('date').notNull(),
    sector: text('sector').notNull(),
    priorTier: text('prior_tier'),
    proposedTier: text('proposed_tier'),
    tierChanged: integer('tier_changed'),
    changeReason: text('change_reason'),
    leaderToken: text('leader_token'),
    leaderStatus: text('leader_status'),
  },
  (t) => [primaryKey({ columns: [t.date, t.sector] })],
);

export const portfolioActionsWeekly = pgTable(
  'portfolio_actions_weekly',
  {
    date: text('date').notNull(),
    symbol: text('symbol').notNull(),
    currentBucket: text('current_bucket'),
    currentPct: real('current_pct'),
    targetPct: real('target_pct'),
    proposedAction: text('proposed_action'),
    reasonCode: text('reason_code'),
    confidence: text('confidence'),
    executionBlocked: boolean('execution_blocked'),
  },
  (t) => [primaryKey({ columns: [t.date, t.symbol] })],
);

// ─── Operational ────────────────────────────────────────────────────

export const runLog = pgTable('run_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  script: text('script').notNull(),
  startedAt: timestamp('started_at').defaultNow(),
  finishedAt: timestamp('finished_at'),
  status: text('status'),
  errors: text('errors'),
});

export const taxLots = pgTable('tax_lots', {
  id: uuid('id').primaryKey().defaultRandom(),
  symbol: text('symbol').notNull(),
  quantity: real('quantity').notNull(),
  costBasis: real('cost_basis').notNull(),
  costPerUnit: real('cost_per_unit').notNull(),
  acquiredAt: text('acquired_at').notNull(),
  disposedAt: text('disposed_at'),
  proceeds: real('proceeds'),
  gainLoss: real('gain_loss'),
  source: text('source'),
  koinlyTxnId: text('koinly_txn_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const llmAnalysisWeekly = pgTable('llm_analysis_weekly', {
  date: text('date').primaryKey(),
  regimeAnalysis: text('regime_analysis'),         // JSON: RegimeLlmAnalysis
  sectorAnalysis: text('sector_analysis'),         // JSON: SectorLlmAnalysis[]
  portfolioAnalysis: text('portfolio_analysis'),   // JSON: PortfolioLlmAnalysis
  createdAt: timestamp('created_at').defaultNow(),
});

export const runTrace = pgTable('run_trace', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
  phase: text('phase').notNull(),         // 'ingest' | 'scoring' | 'engine' | 'report'
  step: text('step').notNull(),           // 'fetch_coingecko' | 'score_regime' | 'tier_decision' etc.
  category: text('category').notNull(),   // 'api_call' | 'computation' | 'decision' | 'upsert'
  detail: text('detail').notNull(),       // JSON — inputs, outputs, reasoning
  durationMs: integer('duration_ms'),
});
