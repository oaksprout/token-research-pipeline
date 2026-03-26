# Phase 1: Foundation + Regime Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the project scaffolding, database schema, daily market ingest, and weekly regime scoring pipeline — the foundation everything else builds on.

**Architecture:** Two Railway cron services (daily-ingest, weekly-scoring) sharing a Postgres database. TypeScript + Drizzle ORM. Daily cron ingests market data, weekly cron scores the regime. All scoring is deterministic — no LLM.

**Tech Stack:** TypeScript 5.x, Node.js 20+, Drizzle ORM, postgres (porsager), js-yaml, vitest

**Spec reference:** `/Users/gcd/.claude/plans/inherited-frolicking-lerdorf.md`

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `drizzle.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "token-research-pipeline",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev:daily": "tsx src/daily.ts",
    "dev:weekly": "tsx src/weekly.ts",
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "drizzle-orm": "^0.44.0",
    "postgres": "^3.4.5",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.0",
    "typescript": "^5.7.0",
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: Create drizzle.config.ts**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
outputs/
.env
*.log
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated.

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (no source files yet, just verifying config).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json drizzle.config.ts .gitignore
git commit -m "chore: project scaffolding — ts, drizzle, vitest"
```

---

### Task 2: Drizzle Schema

**Files:**
- Create: `src/db/schema.ts`

All 10 tables defined in a single file. This is the source of truth for the database.

- [ ] **Step 1: Create src/db/schema.ts**

```ts
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
```

- [ ] **Step 2: Verify schema compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: drizzle schema — all 10 tables"
```

---

### Task 3: DB Client + Migration Runner

**Files:**
- Create: `src/db/client.ts`
- Create: `src/db/migrate.ts`

- [ ] **Step 1: Create src/db/client.ts**

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { runLog } from './schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = postgres(connectionString);
export const db = drizzle(sql, { schema });

export async function logRun(
  scriptName: string,
  fn: () => Promise<void>,
): Promise<void> {
  const [row] = await db
    .insert(runLog)
    .values({ script: scriptName })
    .returning({ id: runLog.id });

  const errors: string[] = [];
  let status = 'success';

  try {
    await fn();
  } catch (err) {
    status = 'failed';
    errors.push(err instanceof Error ? err.message : String(err));
  }

  await db
    .update(runLog)
    .set({
      finishedAt: new Date(),
      status,
      errors: errors.length > 0 ? JSON.stringify(errors) : null,
    })
    .where(
      // drizzle eq import
      (() => {
        const { eq } = require('drizzle-orm');
        return eq(runLog.id, row.id);
      })(),
    );
}

export async function closeDb(): Promise<void> {
  await sql.end();
}
```

Wait — that `require` inside is ugly. Let me fix:

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema.js';
import { runLog } from './schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = postgres(connectionString);
export const db = drizzle(sql, { schema });

export async function logRun(
  scriptName: string,
  fn: () => Promise<void>,
): Promise<void> {
  const [row] = await db
    .insert(runLog)
    .values({ script: scriptName })
    .returning({ id: runLog.id });

  const errors: string[] = [];
  let status = 'success';

  try {
    await fn();
  } catch (err) {
    status = 'failed';
    errors.push(err instanceof Error ? err.message : String(err));
  }

  await db
    .update(runLog)
    .set({
      finishedAt: new Date(),
      status,
      errors: errors.length > 0 ? JSON.stringify(errors) : null,
    })
    .where(eq(runLog.id, row.id));
}

export async function closeDb(): Promise<void> {
  await sql.end();
}
```

- [ ] **Step 2: Create src/db/migrate.ts**

```ts
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, closeDb } from './client.js';

async function main() {
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations complete.');
  await closeDb();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/client.ts src/db/migrate.ts
git commit -m "feat: db client with logRun helper + migration runner"
```

---

### Task 4: Config Files

**Files:**
- Create: `portfolio.yaml`
- Create: `configs/sectors.yaml`
- Create: `configs/tokens.yaml`

- [ ] **Step 1: Create portfolio.yaml**

Copy the full portfolio.yaml from the spec (Amendment 1 version). All holdings with: symbol, bucket, current_units, cost_basis_usd, pilot_target_pct, scale_target_pct, max_position_pct, thesis, thesis_status, invalidation, execution_exempt, can_add. Plus the `targets` section.

The full content is in the spec at `/Users/gcd/.claude/plans/inherited-frolicking-lerdorf.md` under "portfolio.yaml — Amendment 1: Strengthened". Copy it verbatim.

- [ ] **Step 2: Create configs/sectors.yaml**

Copy the full sectors.yaml from the original user spec. All 8 sectors (rwa, depin, ai_agent, da, btc_l2, zk_infra, stablecoin_infra, defi_infra) with name, description, token_universe, structural_filters, metrics_sources, and notes.

The full content is in the original user message under "sectors.yaml". Copy it verbatim.

- [ ] **Step 3: Create configs/tokens.yaml**

Copy the full tokens.yaml from the original user spec. All tracked tokens (ONDO, CFG, MPL, BUIDL, HNT, RENDER, DIMO, VIRTUAL, TAO, OLAS, TIA, AVAIL, STX, BABY, PROVE, AAVE, LDO, UNI, MKR, BTC, ETH, SOL, ZORA) with name, sector, coingecko_id, notes.

The full content is in the original user message under "tokens.yaml". Copy it verbatim.

- [ ] **Step 4: Commit**

```bash
git add portfolio.yaml configs/sectors.yaml configs/tokens.yaml
git commit -m "feat: config files — portfolio, sectors, tokens"
```

---

### Task 5: Config Loader + Types

**Files:**
- Create: `src/lib/config.ts`
- Create: `src/lib/types.ts`
- Test: `src/lib/config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadPortfolio, loadSectors, loadTokens } from './config.js';

describe('loadPortfolio', () => {
  it('loads holdings with required fields', () => {
    const portfolio = loadPortfolio();
    expect(portfolio.holdings.length).toBeGreaterThan(0);

    const btc = portfolio.holdings.find((h) => h.symbol === 'BTC');
    expect(btc).toBeDefined();
    expect(btc!.bucket).toBe('core');
    expect(btc!.thesis_status).toBe('intact');
    expect(btc!.execution_exempt).toBe(false);
  });

  it('loads targets', () => {
    const portfolio = loadPortfolio();
    expect(portfolio.targets.pilot_default_pct).toBe(0.05);
    expect(portfolio.targets.scale_default_pct).toBe(0.15);
    expect(portfolio.targets.max_sectors).toBe(3);
    expect(portfolio.targets.cash_reserve_pct).toBe(0.10);
  });

  it('identifies constrained holdings', () => {
    const portfolio = loadPortfolio();
    const olas = portfolio.holdings.find((h) => h.symbol === 'OLAS');
    expect(olas).toBeDefined();
    expect(olas!.bucket).toBe('constrained');
    expect(olas!.execution_exempt).toBe(true);
  });
});

describe('loadSectors', () => {
  it('loads all sectors', () => {
    const sectors = loadSectors();
    expect(Object.keys(sectors.sectors).length).toBeGreaterThanOrEqual(8);
    expect(sectors.sectors.rwa).toBeDefined();
    expect(sectors.sectors.rwa.token_universe).toContain('ONDO');
  });

  it('includes structural filters', () => {
    const sectors = loadSectors();
    const rwa = sectors.sectors.rwa;
    expect(rwa.structural_filters.novel_capability).toBe(true);
    expect(rwa.structural_filters.capital_pathway).toBe(true);
    expect(rwa.structural_filters.distribution_vector).toBe(true);
  });
});

describe('loadTokens', () => {
  it('loads all tokens', () => {
    const tokens = loadTokens();
    expect(Object.keys(tokens.tokens).length).toBeGreaterThanOrEqual(20);
    expect(tokens.tokens.BTC.coingecko_id).toBe('bitcoin');
  });

  it('maps tokens to sectors', () => {
    const tokens = loadTokens();
    expect(tokens.tokens.ONDO.sector).toBe('rwa');
    expect(tokens.tokens.BTC.sector).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/config.test.ts`
Expected: FAIL — module `./config.js` not found.

- [ ] **Step 3: Create src/lib/types.ts**

```ts
export interface Holding {
  symbol: string;
  bucket: 'core' | 'active' | 'constrained';
  current_units: number;
  cost_basis_usd: number;
  pilot_target_pct: number | null;
  scale_target_pct: number | null;
  max_position_pct: number | null;
  thesis: string;
  thesis_status: 'intact' | 'weakening' | 'invalidated';
  invalidation: string;
  execution_exempt: boolean;
  can_add: boolean;
}

export interface PortfolioTargets {
  pilot_default_pct: number;
  scale_default_pct: number;
  max_sectors: number;
  cash_reserve_pct: number;
}

export interface PortfolioConfig {
  last_updated: string;
  holdings: Holding[];
  targets: PortfolioTargets;
}

export interface StructuralFilters {
  novel_capability: boolean;
  capital_pathway: boolean;
  distribution_vector: boolean;
}

export interface MetricsSources {
  tvl_category: string | null;
  coingecko_category: string | null;
  github_repos: string[];
}

export interface SectorDef {
  name: string;
  description: string;
  token_universe: string[];
  structural_filters: StructuralFilters;
  metrics_sources: MetricsSources;
  notes?: string;
}

export interface SectorsConfig {
  sectors: Record<string, SectorDef>;
}

export interface TokenDef {
  name: string;
  sector: string | null;
  coingecko_id: string | null;
  notes: string;
}

export interface TokensConfig {
  tokens: Record<string, TokenDef>;
}
```

- [ ] **Step 4: Create src/lib/config.ts**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import type { PortfolioConfig, SectorsConfig, TokensConfig } from './types.js';

const ROOT = resolve(import.meta.dirname, '..', '..');

function loadYaml<T>(relativePath: string): T {
  const fullPath = resolve(ROOT, relativePath);
  const raw = readFileSync(fullPath, 'utf-8');
  return yaml.load(raw) as T;
}

export function loadPortfolio(): PortfolioConfig {
  return loadYaml<PortfolioConfig>('portfolio.yaml');
}

export function loadSectors(): SectorsConfig {
  return loadYaml<SectorsConfig>('configs/sectors.yaml');
}

export function loadTokens(): TokensConfig {
  return loadYaml<TokensConfig>('configs/tokens.yaml');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/config.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/config.ts src/lib/config.test.ts
git commit -m "feat: config loader + types for portfolio, sectors, tokens"
```

---

### Task 6: API Helper

**Files:**
- Create: `src/lib/api.ts`
- Test: `src/lib/api.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWithRetry } from './api.js';

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ price: 100 }), { status: 200 }),
    );

    const result = await fetchWithRetry('https://example.com/api');
    expect(result).toEqual({ price: 100 });
  });

  it('returns null after exhausting retries', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

    const result = await fetchWithRetry('https://example.com/api', {
      retries: 2,
      baseDelayMs: 10,
    });
    expect(result).toBeNull();
  });

  it('retries on non-200 status', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    const result = await fetchWithRetry('https://example.com/api', {
      retries: 3,
      baseDelayMs: 10,
    });
    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api.test.ts`
Expected: FAIL — module `./api.js` not found.

- [ ] **Step 3: Create src/lib/api.ts**

```ts
interface FetchOptions {
  retries?: number;
  baseDelayMs?: number;
}

export async function fetchWithRetry<T = unknown>(
  url: string,
  options: FetchOptions = {},
): Promise<T | null> {
  const { retries = 3, baseDelayMs = 1500 } = options;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      const isLast = attempt === retries - 1;
      if (isLast) {
        console.error(
          `fetchWithRetry failed after ${retries} attempts for ${url}:`,
          err instanceof Error ? err.message : err,
        );
        return null;
      }
      const delay = baseDelayMs * 2 ** attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

export async function rateLimitedSleep(ms: number = 1500): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/api.test.ts`
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/lib/api.test.ts
git commit -m "feat: fetch wrapper with retry + rate-limit sleep"
```

---

### Task 7: Scoring Constants

**Files:**
- Create: `src/scoring/constants.ts`

All magic numbers from the spec in one file.

- [ ] **Step 1: Create src/scoring/constants.ts**

```ts
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
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/scoring/constants.ts
git commit -m "feat: scoring constants — all thresholds for regime, sector, token"
```

---

### Task 8: Regime Scoring + Tests

**Files:**
- Create: `src/scoring/regime.ts`
- Test: `src/scoring/regime.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/scoring/regime.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/scoring/regime.test.ts`
Expected: FAIL — module `./regime.js` not found.

- [ ] **Step 3: Create src/scoring/regime.ts**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/scoring/regime.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scoring/regime.ts src/scoring/regime.test.ts
git commit -m "feat: regime scoring — 5 sub-scores + tests"
```

---

### Task 9: Market Ingest — Technical Indicators

**Files:**
- Create: `src/ingest/indicators.ts`
- Test: `src/ingest/indicators.test.ts`

Helper functions for computing SMA and RSI from historical price data.

- [ ] **Step 1: Write the failing tests**

Create `src/ingest/indicators.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeSma, computeRsi } from './indicators.js';

describe('computeSma', () => {
  it('computes simple moving average', () => {
    const prices = [10, 20, 30, 40, 50];
    expect(computeSma(prices, 3)).toBe(40); // (30+40+50)/3
    expect(computeSma(prices, 5)).toBe(30); // (10+20+30+40+50)/5
  });

  it('returns null when insufficient data', () => {
    expect(computeSma([10, 20], 5)).toBeNull();
  });
});

describe('computeRsi', () => {
  it('returns ~50 for alternating equal moves', () => {
    // alternating +1, -1 over 28 periods
    const prices: number[] = [];
    let p = 100;
    for (let i = 0; i < 30; i++) {
      prices.push(p);
      p += i % 2 === 0 ? 1 : -1;
    }
    const rsi = computeRsi(prices, 14);
    expect(rsi).not.toBeNull();
    expect(rsi!).toBeGreaterThan(40);
    expect(rsi!).toBeLessThan(60);
  });

  it('returns high RSI for consistent gains', () => {
    const prices = Array.from({ length: 20 }, (_, i) => 100 + i * 2);
    const rsi = computeRsi(prices, 14);
    expect(rsi).not.toBeNull();
    expect(rsi!).toBeGreaterThan(90);
  });

  it('returns null when insufficient data', () => {
    expect(computeRsi([100, 101, 102], 14)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ingest/indicators.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create src/ingest/indicators.ts**

```ts
export function computeSma(
  prices: number[],
  period: number,
): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

export function computeRsi(
  prices: number[],
  period: number,
): number | null {
  if (prices.length < period + 1) return null;

  let avgGain = 0;
  let avgLoss = 0;

  // Initial averages from first `period` changes
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  // Smoothed averages for remaining data
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ingest/indicators.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ingest/indicators.ts src/ingest/indicators.test.ts
git commit -m "feat: SMA + RSI indicator functions + tests"
```

---

### Task 10: Market Ingest — Main Script

**Files:**
- Create: `src/ingest/market.ts`

This script fetches data from CoinGecko, Binance, CoinGlass, DefiLlama and writes to `market_daily` and `flows_daily`. It also computes SMAs, RSI, and ratio SMAs from historical data already in the DB.

- [ ] **Step 1: Create src/ingest/market.ts**

```ts
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { marketDaily, flowsDaily } from '../db/schema.js';
import { fetchWithRetry, rateLimitedSleep } from '../lib/api.js';
import { computeSma, computeRsi } from './indicators.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── CoinGecko ──────────────────────────────────────────────────────

interface CoinGeckoPrice {
  [id: string]: {
    usd: number;
    usd_24h_vol: number;
    usd_market_cap: number;
  };
}

async function fetchCoreMarket() {
  const data = await fetchWithRetry<CoinGeckoPrice>(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true',
  );
  if (!data) return null;
  return {
    btcPrice: data.bitcoin?.usd ?? null,
    ethPrice: data.ethereum?.usd ?? null,
    solPrice: data.solana?.usd ?? null,
    btcVolume: data.bitcoin?.usd_24h_vol ?? null,
    ethVolume: data.ethereum?.usd_24h_vol ?? null,
    btcMcap: data.bitcoin?.usd_market_cap ?? null,
  };
}

interface CoinGeckoGlobal {
  data: {
    total_market_cap: { usd: number };
    market_cap_percentage: { btc: number };
  };
}

async function fetchGlobalMarket() {
  const data = await fetchWithRetry<CoinGeckoGlobal>(
    'https://api.coingecko.com/api/v3/global',
  );
  if (!data) return null;
  return {
    totalMcap: data.data.total_market_cap.usd,
    btcDominance: data.data.market_cap_percentage.btc,
  };
}

// ─── Binance ────────────────────────────────────────────────────────

interface BinanceFundingRate {
  fundingRate: string;
  fundingTime: number;
}

async function fetchFundingRate(): Promise<number | null> {
  const data = await fetchWithRetry<BinanceFundingRate[]>(
    'https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=21',
  );
  if (!data || data.length === 0) return null;
  // Average the most recent 7 days (3 funding events per day = 21 entries)
  const rates = data.map((d) => parseFloat(d.fundingRate));
  return rates.reduce((s, r) => s + r, 0) / rates.length;
}

interface BinanceOI {
  openInterest: string;
}

async function fetchOpenInterest(): Promise<number | null> {
  const data = await fetchWithRetry<BinanceOI>(
    'https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT',
  );
  if (!data) return null;
  return parseFloat(data.openInterest);
}

// ─── DefiLlama ──────────────────────────────────────────────────────

interface StablecoinData {
  peggedAssets: Array<{
    circulating: { peggedUSD: number };
  }>;
}

async function fetchStablecoinMcap(): Promise<number | null> {
  const data = await fetchWithRetry<StablecoinData>(
    'https://stablecoins.llama.fi/stablecoins?includePrices=false',
  );
  if (!data?.peggedAssets) return null;
  return data.peggedAssets.reduce(
    (sum, a) => sum + (a.circulating?.peggedUSD ?? 0),
    0,
  );
}

// ─── Historical lookups for computed fields ─────────────────────────

async function getRecentPrices(
  field: 'btcPrice' | 'ethBtcRatio' | 'solBtcRatio' | 'stablecoinTotalMcap',
  days: number,
): Promise<number[]> {
  // Map field to the right schema column
  const columnMap = {
    btcPrice: marketDaily.btcPrice,
    ethBtcRatio: marketDaily.ethBtcRatio,
    solBtcRatio: marketDaily.solBtcRatio,
    stablecoinTotalMcap: flowsDaily.stablecoinTotalMcap,
  };

  if (field === 'stablecoinTotalMcap') {
    const rows = await db
      .select({ value: flowsDaily.stablecoinTotalMcap })
      .from(flowsDaily)
      .orderBy(desc(flowsDaily.date))
      .limit(days);
    return rows.filter((r) => r.value != null).map((r) => r.value!).reverse();
  }

  const col = columnMap[field];
  const rows = await db
    .select({ value: col })
    .from(marketDaily)
    .orderBy(desc(marketDaily.date))
    .limit(days);
  return rows.filter((r) => r.value != null).map((r) => r.value!).reverse();
}

async function getRecentBtcPrices(days: number): Promise<number[]> {
  return getRecentPrices('btcPrice', days);
}

// ─── Main ───────────────────────────────────────────────────────────

export async function ingestMarket(): Promise<void> {
  const date = today();
  console.log(`[ingest_market] Starting for ${date}`);

  // Fetch all data sources in parallel where possible
  const [coreMarket, globalMarket, fundingRate, openInterest, stablecoinMcap] =
    await Promise.all([
      fetchCoreMarket(),
      rateLimitedSleep(1500).then(() => fetchGlobalMarket()),
      fetchFundingRate(),
      fetchOpenInterest(),
      fetchStablecoinMcap(),
    ]);

  // Compute ratios
  const ethBtcRatio =
    coreMarket?.ethPrice && coreMarket?.btcPrice
      ? coreMarket.ethPrice / coreMarket.btcPrice
      : null;
  const solBtcRatio =
    coreMarket?.solPrice && coreMarket?.btcPrice
      ? coreMarket.solPrice / coreMarket.btcPrice
      : null;

  // Historical data for computed fields
  const btcPrices = await getRecentBtcPrices(201);
  const currentBtcPrice = coreMarket?.btcPrice;
  if (currentBtcPrice) btcPrices.push(currentBtcPrice);

  const btcSma20 = computeSma(btcPrices, 20);
  const btcSma50 = computeSma(btcPrices, 50);
  const btcSma200 = computeSma(btcPrices, 200);
  const btcRsi14 = computeRsi(btcPrices, 14);

  // ETH/BTC and SOL/BTC ratio SMAs
  const ethBtcHistory = await getRecentPrices('ethBtcRatio', 20);
  if (ethBtcRatio) ethBtcHistory.push(ethBtcRatio);
  const ethBtcRatioSma20 = computeSma(ethBtcHistory, 20);

  const solBtcHistory = await getRecentPrices('solBtcRatio', 20);
  if (solBtcRatio) solBtcHistory.push(solBtcRatio);
  const solBtcRatioSma20 = computeSma(solBtcHistory, 20);

  // Stablecoin SMA
  const stablecoinHistory = await getRecentPrices('stablecoinTotalMcap', 7);
  if (stablecoinMcap) stablecoinHistory.push(stablecoinMcap);
  const stablecoinMcapSma7 = computeSma(stablecoinHistory, 7);

  // Stablecoin 7d change
  let stablecoinChange7d: number | null = null;
  if (stablecoinMcap && stablecoinHistory.length >= 7) {
    const prev = stablecoinHistory[stablecoinHistory.length - 7];
    stablecoinChange7d = (stablecoinMcap - prev) / prev;
  }

  // Upsert market_daily
  await db
    .insert(marketDaily)
    .values({
      date,
      btcPrice: coreMarket?.btcPrice ?? null,
      ethPrice: coreMarket?.ethPrice ?? null,
      solPrice: coreMarket?.solPrice ?? null,
      btcVolume: coreMarket?.btcVolume ?? null,
      ethVolume: coreMarket?.ethVolume ?? null,
      btcMcap: coreMarket?.btcMcap ?? null,
      totalMcap: globalMarket?.totalMcap ?? null,
      btcDominance: globalMarket?.btcDominance ?? null,
      btcSma20,
      btcSma50,
      btcSma200,
      btcRsi14,
      ethBtcRatio,
      solBtcRatio,
      ethBtcRatioSma20,
      solBtcRatioSma20,
      stablecoinMcapSma7,
    })
    .onConflictDoUpdate({
      target: marketDaily.date,
      set: {
        btcPrice: coreMarket?.btcPrice ?? null,
        ethPrice: coreMarket?.ethPrice ?? null,
        solPrice: coreMarket?.solPrice ?? null,
        btcVolume: coreMarket?.btcVolume ?? null,
        ethVolume: coreMarket?.ethVolume ?? null,
        btcMcap: coreMarket?.btcMcap ?? null,
        totalMcap: globalMarket?.totalMcap ?? null,
        btcDominance: globalMarket?.btcDominance ?? null,
        btcSma20,
        btcSma50,
        btcSma200,
        btcRsi14,
        ethBtcRatio,
        solBtcRatio,
        ethBtcRatioSma20,
        solBtcRatioSma20,
        stablecoinMcapSma7,
      },
    });

  // Upsert flows_daily
  // OI change requires yesterday's value
  let oiChangePct24h: number | null = null;
  if (openInterest != null) {
    const yesterday = await db
      .select({ oi: flowsDaily.openInterestBtc })
      .from(flowsDaily)
      .orderBy(desc(flowsDaily.date))
      .limit(1);
    if (yesterday.length > 0 && yesterday[0].oi != null) {
      oiChangePct24h =
        ((openInterest - yesterday[0].oi) / yesterday[0].oi) * 100;
    }
  }

  await db
    .insert(flowsDaily)
    .values({
      date,
      fundingRateAvg: fundingRate,
      openInterestBtc: openInterest,
      oiChangePct24h,
      liquidationsLong24h: null,   // CoinGlass — added when API key available
      liquidationsShort24h: null,
      etfNetFlowDaily: null,       // manual or SoSoValue — NULL for now
      stablecoinTotalMcap: stablecoinMcap,
      stablecoinChange7d,
      exchangeNetflowBtc: null,    // skipped in v1
    })
    .onConflictDoUpdate({
      target: flowsDaily.date,
      set: {
        fundingRateAvg: fundingRate,
        openInterestBtc: openInterest,
        oiChangePct24h,
        stablecoinTotalMcap: stablecoinMcap,
        stablecoinChange7d,
      },
    });

  console.log(`[ingest_market] Done for ${date}`);
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/ingest/market.ts
git commit -m "feat: market ingest — CoinGecko, Binance, DefiLlama + computed indicators"
```

---

### Task 11: Weekly Regime Score Runner

**Files:**
- Create: `src/scoring/run-regime.ts`

This orchestrates the regime scoring: reads the latest data from DB, computes sub-scores, writes result to `regime_scores_weekly`.

- [ ] **Step 1: Create src/scoring/run-regime.ts**

```ts
import { desc, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { marketDaily, flowsDaily, regimeScoresWeekly } from '../db/schema.js';
import {
  scoreMarketStructure,
  scoreLeverageStress,
  scoreFlowSupport,
  scoreOnchainStress,
  scoreAltStrength,
  computeRegimeScore,
} from './regime.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function scoreRegime(): Promise<void> {
  const date = today();
  console.log(`[score_regime] Starting for ${date}`);

  // Get latest market data
  const [latestMarket] = await db
    .select()
    .from(marketDaily)
    .orderBy(desc(marketDaily.date))
    .limit(1);

  if (!latestMarket) {
    console.error('[score_regime] No market data found. Skipping.');
    return;
  }

  // Get latest flow data
  const [latestFlows] = await db
    .select()
    .from(flowsDaily)
    .orderBy(desc(flowsDaily.date))
    .limit(1);

  // Get weekly lows for last 4 weeks
  // Each "weekly low" = min BTC price in a 7-day window
  const last28Days = await db
    .select({ btcPrice: marketDaily.btcPrice })
    .from(marketDaily)
    .orderBy(desc(marketDaily.date))
    .limit(28);

  const weeklyLows4w: number[] = [];
  const prices = last28Days
    .filter((r) => r.btcPrice != null)
    .map((r) => r.btcPrice!)
    .reverse(); // oldest first

  for (let w = 0; w < 4; w++) {
    const weekSlice = prices.slice(w * 7, (w + 1) * 7);
    if (weekSlice.length > 0) {
      weeklyLows4w.push(Math.min(...weekSlice));
    }
  }

  // Get 52-week high/low
  const last365Days = await db
    .select({ btcPrice: marketDaily.btcPrice })
    .from(marketDaily)
    .orderBy(desc(marketDaily.date))
    .limit(365);

  const allPrices = last365Days
    .filter((r) => r.btcPrice != null)
    .map((r) => r.btcPrice!);

  const week52High = allPrices.length > 0 ? Math.max(...allPrices) : latestMarket.btcPrice!;
  const week52Low = allPrices.length > 0 ? Math.min(...allPrices) : latestMarket.btcPrice!;
  const btcAth = week52High; // best proxy in v1

  // Get ETH/BTC and SOL/BTC weekly trends (3 weeks)
  const last21Days = await db
    .select({
      ethBtcRatio: marketDaily.ethBtcRatio,
      solBtcRatio: marketDaily.solBtcRatio,
    })
    .from(marketDaily)
    .orderBy(desc(marketDaily.date))
    .limit(21);

  const ethBtcWeeklyAvgs: number[] = [];
  const solBtcWeeklyAvgs: number[] = [];
  const ratioRows = last21Days.reverse(); // oldest first

  for (let w = 0; w < 3; w++) {
    const weekSlice = ratioRows.slice(w * 7, (w + 1) * 7);
    const ethVals = weekSlice.filter((r) => r.ethBtcRatio != null).map((r) => r.ethBtcRatio!);
    const solVals = weekSlice.filter((r) => r.solBtcRatio != null).map((r) => r.solBtcRatio!);
    if (ethVals.length > 0) ethBtcWeeklyAvgs.push(ethVals.reduce((a, b) => a + b, 0) / ethVals.length);
    if (solVals.length > 0) solBtcWeeklyAvgs.push(solVals.reduce((a, b) => a + b, 0) / solVals.length);
  }

  const ethBtcRising3w =
    ethBtcWeeklyAvgs.length >= 3 &&
    ethBtcWeeklyAvgs[1] > ethBtcWeeklyAvgs[0] &&
    ethBtcWeeklyAvgs[2] > ethBtcWeeklyAvgs[1];

  const solBtcRising3w =
    solBtcWeeklyAvgs.length >= 3 &&
    solBtcWeeklyAvgs[1] > solBtcWeeklyAvgs[0] &&
    solBtcWeeklyAvgs[2] > solBtcWeeklyAvgs[1];

  const ethBtcFalling3w =
    ethBtcWeeklyAvgs.length >= 3 &&
    ethBtcWeeklyAvgs[1] < ethBtcWeeklyAvgs[0] &&
    ethBtcWeeklyAvgs[2] < ethBtcWeeklyAvgs[1];

  const solBtcFalling3w =
    solBtcWeeklyAvgs.length >= 3 &&
    solBtcWeeklyAvgs[1] < solBtcWeeklyAvgs[0] &&
    solBtcWeeklyAvgs[2] < solBtcWeeklyAvgs[1];

  // Stablecoin acceleration
  // Compare current 7d change to prior 7d change
  const last14Stablecoins = await db
    .select({ mcap: flowsDaily.stablecoinTotalMcap })
    .from(flowsDaily)
    .orderBy(desc(flowsDaily.date))
    .limit(14);

  const stablecoinVals = last14Stablecoins
    .filter((r) => r.mcap != null)
    .map((r) => r.mcap!)
    .reverse();

  let stablecoinAccelerating: boolean | null = null;
  if (stablecoinVals.length >= 14) {
    const currentChange = (stablecoinVals[13] - stablecoinVals[6]) / stablecoinVals[6];
    const priorChange = (stablecoinVals[6] - stablecoinVals[0]) / stablecoinVals[0];
    stablecoinAccelerating = currentChange > priorChange;
  }

  // ─── Compute sub-scores ───────────────────────────────────────────

  const subStructure = scoreMarketStructure({
    btcPrice: latestMarket.btcPrice!,
    btcSma20: latestMarket.btcSma20 ?? latestMarket.btcPrice!,
    btcSma50: latestMarket.btcSma50 ?? latestMarket.btcPrice!,
    btcSma200: latestMarket.btcSma200 ?? latestMarket.btcPrice!,
    weeklyLows4w,
    week52Low,
    week52High,
  });

  const subLeverage = scoreLeverageStress({
    fundingRateAvg7d: latestFlows?.fundingRateAvg ?? null,
    oiChangePct7d: latestFlows?.oiChangePct24h ?? null, // approximation in v1
    liquidationsLong24h: latestFlows?.liquidationsLong24h ?? null,
    liquidationsShort24h: latestFlows?.liquidationsShort24h ?? null,
  });

  const flowResult = scoreFlowSupport({
    etfNetFlowDaily: latestFlows?.etfNetFlowDaily ?? null,
    stablecoinChange7d: latestFlows?.stablecoinChange7d ?? null,
    stablecoinAccelerating,
    exchangeNetflowBtc: latestFlows?.exchangeNetflowBtc ?? null,
  });

  const subOnchain = scoreOnchainStress({
    btcPrice: latestMarket.btcPrice!,
    btcAth,
    btcRsi14: latestMarket.btcRsi14 ?? null,
  });

  const subAltStr = scoreAltStrength({
    ethBtcAboveSma:
      latestMarket.ethBtcRatio != null &&
      latestMarket.ethBtcRatioSma20 != null &&
      latestMarket.ethBtcRatio > latestMarket.ethBtcRatioSma20,
    solBtcAboveSma:
      latestMarket.solBtcRatio != null &&
      latestMarket.solBtcRatioSma20 != null &&
      latestMarket.solBtcRatio > latestMarket.solBtcRatioSma20,
    ethBtcRising3w: ethBtcRising3w && !ethBtcFalling3w,
    solBtcRising3w: solBtcRising3w && !solBtcFalling3w,
  });

  // ─── Compute total ────────────────────────────────────────────────

  const result = computeRegimeScore({
    subStructure,
    subLeverage,
    subFlows: flowResult.score,
    subOnchain,
    subAltStrength: subAltStr,
    etfDataAvailable: flowResult.etfDataAvailable,
  });

  // ─── Upsert ───────────────────────────────────────────────────────

  await db
    .insert(regimeScoresWeekly)
    .values({
      date,
      scoreTotal: result.scoreTotal,
      label: result.label,
      confidence: result.confidence,
      subStructure: result.subStructure,
      subLeverage: result.subLeverage,
      subFlows: result.subFlows,
      subOnchain: result.subOnchain,
      subAltStrength: result.subAltStrength,
      sizingImplication: result.sizingImplication,
      etfDataAvailable: result.etfDataAvailable,
    })
    .onConflictDoUpdate({
      target: regimeScoresWeekly.date,
      set: {
        scoreTotal: result.scoreTotal,
        label: result.label,
        confidence: result.confidence,
        subStructure: result.subStructure,
        subLeverage: result.subLeverage,
        subFlows: result.subFlows,
        subOnchain: result.subOnchain,
        subAltStrength: result.subAltStrength,
        sizingImplication: result.sizingImplication,
        etfDataAvailable: result.etfDataAvailable,
      },
    });

  console.log(
    `[score_regime] ${date}: ${result.label} (${result.scoreTotal}, ${result.confidence})`,
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/scoring/run-regime.ts
git commit -m "feat: regime score runner — reads DB, computes 5 sub-scores, writes result"
```

---

### Task 12: Entrypoints

**Files:**
- Create: `src/daily.ts`
- Create: `src/weekly.ts`

- [ ] **Step 1: Create src/daily.ts**

```ts
import { logRun, closeDb } from './db/client.js';
import { ingestMarket } from './ingest/market.js';

async function main() {
  await logRun('daily-ingest', async () => {
    await ingestMarket();
    // ingestSectors() added in Phase 2
  });
  await closeDb();
}

main().catch((err) => {
  console.error('daily-ingest failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Create src/weekly.ts**

```ts
import { logRun, closeDb } from './db/client.js';
import { scoreRegime } from './scoring/run-regime.js';

async function main() {
  await logRun('weekly-scoring', async () => {
    await scoreRegime();
    // Phase 2: scoreSectors(), scoreTokens(), applyDecisionRules(),
    //          generatePortfolioActions(), generateReport(), buildPromptContext()
  });
  await closeDb();
}

main().catch((err) => {
  console.error('weekly-scoring failed:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/daily.ts src/weekly.ts
git commit -m "feat: daily + weekly cron entrypoints"
```

---

### Task 13: Prompt Files (Skeleton)

**Files:**
- Create: `prompts/weekly-regime-review.md`
- Create: `prompts/weekly-sector-review.md`
- Create: `prompts/weekly-portfolio-briefing.md`

- [ ] **Step 1: Create all three prompt files**

Copy the prompts verbatim from the original spec. Each file contains the system prompt for the respective LLM review step.

`prompts/weekly-regime-review.md`:
```markdown
You are a crypto macro analyst. You are reviewing a structured regime assessment.

Your input is a context bundle containing quantitative regime scores, sub-scores, and deltas.

Your job:
1. Interpret the regime classification. Is the label correct given the sub-scores? Flag if you disagree.
2. What changed this week and why it matters.
3. Whether the sizing implication is appropriate.
4. Any risks the quantitative model might be missing (e.g., regulatory events, black swans, structural market changes).

Constraints:
- British English spelling.
- Maximum 200 words.
- No filler, hedging, questions, or offers.
- If you agree with the model's output and have nothing to add, say "No exceptions" and stop.
```

`prompts/weekly-sector-review.md`:
```markdown
You are a crypto sector analyst. You are reviewing structured sector scores and tier recommendations.

Your input is a context bundle containing per-sector scores, 4-week trends, tier proposals from a rule engine, and a token leaderboard.

Your job:
1. Do the tier proposals make sense given the scores? Flag any you disagree with and explain why.
2. Are there any sectors the model is overrating or underrating? Why?
3. Should any new sector be added to the watchlist based on your current knowledge?
4. For sectors at Pilot or Scale, is the leader token still the right one?

Constraints:
- British English spelling.
- Maximum 300 words.
- No filler, hedging, questions, or offers.
- Do not re-explain the data. Focus only on exceptions and additions.
```

`prompts/weekly-portfolio-briefing.md`:
```markdown
You are a portfolio analyst. You are reviewing a portfolio against structured market and sector data.

Your input is a context bundle containing: regime classification, sector tier proposals, token scores, current holdings with cost basis and thesis, and rule-engine-generated action recommendations.

Your job:
1. Review each holding. For each, state: Hold / Add / Trim / Exit.
2. State maximum 5 concrete actions for this week, in priority order.
3. Flag any holding where the thesis in portfolio.yaml appears to be invalidated by current data.
4. Flag any position sizing issue (e.g., overweight in a sector that's deteriorating).

Rules:
- Core positions (BTC, ETH, SOL) respond only to regime. Do not recommend adding unless regime = improving.
- Constrained positions (execution_exempt = true) are excluded from recommendations. Acknowledge them but do not recommend action.
- For tokens marked for sale in portfolio.yaml, always recommend Exit.
- Pilot sizing = 2-5% of total portfolio. Scale sizing = 10-15%.
- Maximum 3 sectors at Pilot or Scale simultaneously.

Constraints:
- British English spelling.
- Maximum 400 words.
- Be specific. "Consider" is not an action. "Sell ZORA at market" is.
- Terminate after the actions list.
```

- [ ] **Step 2: Commit**

```bash
git add prompts/
git commit -m "feat: LLM review prompt templates — regime, sector, portfolio"
```

---

### Task 14: End-to-End Verification

This task verifies that everything works together. Requires a `DATABASE_URL` pointing at a Postgres instance.

- [ ] **Step 1: Push schema to database**

Run: `DATABASE_URL=<your-url> npx drizzle-kit push`
Expected: All 10 tables created. Output lists each table.

- [ ] **Step 2: Run daily ingest**

Run: `DATABASE_URL=<your-url> npx tsx src/daily.ts`
Expected:
- Stdout: `[ingest_market] Starting for YYYY-MM-DD` ... `[ingest_market] Done for YYYY-MM-DD`
- Row inserted in `market_daily` with today's date, non-null BTC/ETH/SOL prices
- Row inserted in `flows_daily` with today's date
- Row inserted in `run_log` with status = 'success'

- [ ] **Step 3: Run weekly scoring**

Run: `DATABASE_URL=<your-url> npx tsx src/weekly.ts`
Expected:
- Stdout: `[score_regime] YYYY-MM-DD: <label> (<score>, <confidence>)`
- Row inserted in `regime_scores_weekly` with today's date
- Score between -100 and +100
- Label is one of: deteriorating, stabilising, improving
- Row in `run_log` with status = 'success'

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: All tests pass (config loader, API helper, indicators, regime scoring).

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: phase 1 complete — foundation + regime pipeline"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Project scaffolding | package.json, tsconfig.json, drizzle.config.ts, .gitignore |
| 2 | Drizzle schema | src/db/schema.ts |
| 3 | DB client + migration | src/db/client.ts, src/db/migrate.ts |
| 4 | Config files | portfolio.yaml, configs/sectors.yaml, configs/tokens.yaml |
| 5 | Config loader + types + tests | src/lib/types.ts, src/lib/config.ts, src/lib/config.test.ts |
| 6 | API helper + tests | src/lib/api.ts, src/lib/api.test.ts |
| 7 | Scoring constants | src/scoring/constants.ts |
| 8 | Regime scoring + tests | src/scoring/regime.ts, src/scoring/regime.test.ts |
| 9 | Technical indicators + tests | src/ingest/indicators.ts, src/ingest/indicators.test.ts |
| 10 | Market ingest | src/ingest/market.ts |
| 11 | Regime score runner | src/scoring/run-regime.ts |
| 12 | Entrypoints | src/daily.ts, src/weekly.ts |
| 13 | Prompt files | prompts/*.md |
| 14 | End-to-end verification | — |
