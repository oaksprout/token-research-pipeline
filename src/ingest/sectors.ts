import { desc, eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { tokenMetricsDaily, sectorMetricsWeekly, marketDaily } from '../db/schema.js';
import { fetchWithRetry, rateLimitedSleep } from '../lib/api.js';
import { loadTokens, loadSectors } from '../lib/config.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── CoinGecko Token Markets ───────────────────────────────────────

interface CoinGeckoMarketItem {
  id: string;
  symbol: string;
  current_price: number | null;
  total_volume: number | null;
  market_cap: number | null;
  fully_diluted_valuation: number | null;
  price_change_percentage_7d_in_currency: number | null;
  price_change_percentage_30d_in_currency: number | null;
}

async function fetchTokenMarkets(
  coingeckoIds: string[],
): Promise<CoinGeckoMarketItem[]> {
  if (coingeckoIds.length === 0) return [];

  const joined = coingeckoIds.join(',');
  const url =
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd` +
    `&ids=${joined}&price_change_percentage=7d,30d&per_page=250`;

  const data = await fetchWithRetry<CoinGeckoMarketItem[]>(url);
  return data ?? [];
}

// ─── DefiLlama TVL ─────────────────────────────────────────────────

interface LlamaProtocol {
  category: string;
  tvl: number | null;
  change_1m: number | null;
}

async function fetchSectorTvl(
  tvlCategory: string,
): Promise<{ tvlTotal: number; tvlChange30d: number | null }> {
  const data = await fetchWithRetry<LlamaProtocol[]>(
    'https://api.llama.fi/protocols',
  );
  if (!data) return { tvlTotal: 0, tvlChange30d: null };

  const matches = data.filter(
    (p) => p.category?.toLowerCase() === tvlCategory.toLowerCase(),
  );

  const tvlTotal = matches.reduce((sum, p) => sum + (p.tvl ?? 0), 0);

  const changesWithValues = matches.filter((p) => p.change_1m != null);
  const tvlChange30d =
    changesWithValues.length > 0
      ? changesWithValues.reduce((sum, p) => sum + p.change_1m!, 0) /
        changesWithValues.length
      : null;

  return { tvlTotal, tvlChange30d };
}

// ─── DefiLlama Fees ────────────────────────────────────────────────

interface LlamaFeesResponse {
  protocols: Array<{
    category: string;
    total30d: number | null;
  }>;
}

async function fetchSectorFees(
  tvlCategory: string,
): Promise<number | null> {
  const data = await fetchWithRetry<LlamaFeesResponse>(
    'https://api.llama.fi/overview/fees',
  );
  if (!data?.protocols) return null;

  const matches = data.protocols.filter(
    (p) => p.category?.toLowerCase() === tvlCategory.toLowerCase(),
  );

  if (matches.length === 0) return null;

  return matches.reduce((sum, p) => sum + (p.total30d ?? 0), 0);
}

// ─── GitHub Dev Commits ────────────────────────────────────────────

interface GitHubWeeklyCommit {
  total: number;
  week: number;
}

async function fetchDevCommits(repos: string[]): Promise<number> {
  let totalCommits = 0;

  for (const repo of repos) {
    const url = `https://api.github.com/repos/${repo}/stats/commit_activity`;
    const data = await fetchWithRetry<GitHubWeeklyCommit[]>(url);

    if (data && data.length >= 4) {
      // Sum last 4 weeks
      const last4 = data.slice(-4);
      totalCommits += last4.reduce((sum, w) => sum + w.total, 0);
    }

    await rateLimitedSleep();
  }

  return totalCommits;
}

// ─── Historical price lookup for 90d change ────────────────────────

async function getPrice90dAgo(symbol: string): Promise<number | null> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 90);
  const dateStr = targetDate.toISOString().slice(0, 10);

  // Get the closest row on or before ~90 days ago
  const rows = await db
    .select({ priceUsd: tokenMetricsDaily.priceUsd })
    .from(tokenMetricsDaily)
    .where(
      and(
        eq(tokenMetricsDaily.symbol, symbol),
        eq(tokenMetricsDaily.date, dateStr),
      ),
    )
    .limit(1);

  return rows.length > 0 ? rows[0].priceUsd : null;
}

// ─── Main Orchestrator ─────────────────────────────────────────────

export async function ingestSectors(): Promise<void> {
  const date = today();
  console.log(`[ingest_sectors] Starting for ${date}`);

  // a. Load configs
  const { tokens } = loadTokens();
  const { sectors } = loadSectors();

  // b. Collect all non-null coingecko_ids
  const cgIdToSymbol = new Map<string, string>();
  for (const [symbol, def] of Object.entries(tokens)) {
    if (def.coingecko_id) {
      cgIdToSymbol.set(def.coingecko_id, symbol);
    }
  }

  const allCgIds = [...cgIdToSymbol.keys()];
  console.log(`[ingest_sectors] Fetching market data for ${allCgIds.length} tokens`);

  const marketItems = await fetchTokenMarkets(allCgIds);
  console.log(`[ingest_sectors] Got data for ${marketItems.length} tokens`);

  // c. Build lookup by coingecko_id
  const dataById = new Map<string, CoinGeckoMarketItem>();
  for (const item of marketItems) {
    dataById.set(item.id, item);
  }

  // d. Upsert token metrics
  for (const [cgId, symbol] of cgIdToSymbol.entries()) {
    const item = dataById.get(cgId);
    if (!item) continue;

    // Compute 90d price change from historical DB data
    let priceChange90d: number | null = null;
    if (item.current_price != null) {
      const price90d = await getPrice90dAgo(symbol);
      if (price90d != null && price90d > 0) {
        priceChange90d = ((item.current_price - price90d) / price90d) * 100;
      }
    }

    const row = {
      date,
      symbol,
      priceUsd: item.current_price,
      volume24h: item.total_volume,
      mcap: item.market_cap,
      fdv: item.fully_diluted_valuation,
      priceChange7d: item.price_change_percentage_7d_in_currency,
      priceChange30d: item.price_change_percentage_30d_in_currency,
      priceChange90d,
    };

    await db
      .insert(tokenMetricsDaily)
      .values(row)
      .onConflictDoUpdate({
        target: [tokenMetricsDaily.date, tokenMetricsDaily.symbol],
        set: {
          priceUsd: row.priceUsd,
          volume24h: row.volume24h,
          mcap: row.mcap,
          fdv: row.fdv,
          priceChange7d: row.priceChange7d,
          priceChange30d: row.priceChange30d,
          priceChange90d: row.priceChange90d,
        },
      });
  }

  console.log(`[ingest_sectors] Token metrics upserted`);

  // e. Get BTC and ETH 30d returns from token data (or marketDaily fallback)
  let btcReturn30d: number | null = null;
  let ethReturn30d: number | null = null;

  const btcData = dataById.get('bitcoin');
  const ethData = dataById.get('ethereum');

  if (btcData?.price_change_percentage_30d_in_currency != null) {
    btcReturn30d = btcData.price_change_percentage_30d_in_currency;
  }
  if (ethData?.price_change_percentage_30d_in_currency != null) {
    ethReturn30d = ethData.price_change_percentage_30d_in_currency;
  }

  // f. Process each sector
  for (const [sectorKey, sectorDef] of Object.entries(sectors)) {
    console.log(`[ingest_sectors] Processing sector: ${sectorDef.name}`);

    // Compute basket returns from tokens in this sector's universe
    const sectorTokenChanges7d: number[] = [];
    const sectorTokenChanges30d: number[] = [];

    for (const sym of sectorDef.token_universe) {
      const tokenDef = tokens[sym];
      if (!tokenDef?.coingecko_id) continue;

      const item = dataById.get(tokenDef.coingecko_id);
      if (!item) continue;

      if (item.price_change_percentage_7d_in_currency != null) {
        sectorTokenChanges7d.push(item.price_change_percentage_7d_in_currency);
      }
      if (item.price_change_percentage_30d_in_currency != null) {
        sectorTokenChanges30d.push(item.price_change_percentage_30d_in_currency);
      }
    }

    const basketReturn7d =
      sectorTokenChanges7d.length > 0
        ? sectorTokenChanges7d.reduce((a, b) => a + b, 0) /
          sectorTokenChanges7d.length
        : null;

    const basketReturn30d =
      sectorTokenChanges30d.length > 0
        ? sectorTokenChanges30d.reduce((a, b) => a + b, 0) /
          sectorTokenChanges30d.length
        : null;

    // Relative strength vs BTC and ETH
    const rsVsBtc30d =
      basketReturn30d != null && btcReturn30d != null
        ? basketReturn30d - btcReturn30d
        : null;

    const rsVsEth30d =
      basketReturn30d != null && ethReturn30d != null
        ? basketReturn30d - ethReturn30d
        : null;

    // TVL data
    let tvlTotal: number | null = null;
    let tvlChange30d: number | null = null;
    const tvlCategory = sectorDef.metrics_sources.tvl_category;

    if (tvlCategory) {
      const tvlData = await fetchSectorTvl(tvlCategory);
      tvlTotal = tvlData.tvlTotal;
      tvlChange30d = tvlData.tvlChange30d;
    }

    // Fee revenue
    let feeRevenue30d: number | null = null;
    if (tvlCategory) {
      feeRevenue30d = await fetchSectorFees(tvlCategory);
    }

    // Dev commits
    let devCommitsProxy: number | null = null;
    const githubRepos = sectorDef.metrics_sources.github_repos;
    if (githubRepos && githubRepos.length > 0) {
      devCommitsProxy = await fetchDevCommits(githubRepos);
    }

    // Funding — null for v1 (no automated funding data source)
    const fundingEvents30d: number | null = null;
    const fundingTotal30d: number | null = null;

    const sectorRow = {
      date,
      sector: sectorKey,
      basketReturn7d,
      basketReturn30d,
      rsVsBtc30d,
      rsVsEth30d,
      tvlTotal,
      tvlChange30d,
      feeRevenue30d,
      devCommitsProxy,
      fundingEvents30d,
      fundingTotal30d,
    };

    await db
      .insert(sectorMetricsWeekly)
      .values(sectorRow)
      .onConflictDoUpdate({
        target: [sectorMetricsWeekly.date, sectorMetricsWeekly.sector],
        set: {
          basketReturn7d: sectorRow.basketReturn7d,
          basketReturn30d: sectorRow.basketReturn30d,
          rsVsBtc30d: sectorRow.rsVsBtc30d,
          rsVsEth30d: sectorRow.rsVsEth30d,
          tvlTotal: sectorRow.tvlTotal,
          tvlChange30d: sectorRow.tvlChange30d,
          feeRevenue30d: sectorRow.feeRevenue30d,
          devCommitsProxy: sectorRow.devCommitsProxy,
          fundingEvents30d: sectorRow.fundingEvents30d,
          fundingTotal30d: sectorRow.fundingTotal30d,
        },
      });

    console.log(`[ingest_sectors] Sector ${sectorDef.name} upserted`);
  }

  console.log(`[ingest_sectors] Done for ${date}`);
}
