import { desc } from 'drizzle-orm';
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
  if (field === 'stablecoinTotalMcap') {
    const rows = await db
      .select({ value: flowsDaily.stablecoinTotalMcap })
      .from(flowsDaily)
      .orderBy(desc(flowsDaily.date))
      .limit(days);
    return rows.filter((r) => r.value != null).map((r) => r.value!).reverse();
  }

  const columnMap = {
    btcPrice: marketDaily.btcPrice,
    ethBtcRatio: marketDaily.ethBtcRatio,
    solBtcRatio: marketDaily.solBtcRatio,
  } as const;

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
