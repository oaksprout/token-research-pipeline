/**
 * Backfill historical market data from CoinGecko so SMAs, RSI,
 * and ratio indicators are immediately available.
 */
import { db, closeDb } from '../src/db/client.js';
import { marketDaily, flowsDaily } from '../src/db/schema.js';
import { fetchWithRetry, rateLimitedSleep } from '../src/lib/api.js';
import { computeSma, computeRsi } from '../src/ingest/indicators.js';

interface CoinGeckoChart {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

async function fetchHistory(coinId: string, days: number): Promise<CoinGeckoChart | null> {
  return fetchWithRetry<CoinGeckoChart>(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
  );
}

function tsToDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

async function main() {
  console.log('[backfill] Fetching 200 days of BTC, ETH, SOL history...');

  const [btcData, ethData, solData] = await Promise.all([
    fetchHistory('bitcoin', 200),
    rateLimitedSleep(1500).then(() => fetchHistory('ethereum', 200)),
    rateLimitedSleep(3000).then(() => fetchHistory('solana', 200)),
  ]);

  if (!btcData || !ethData || !solData) {
    console.error('[backfill] Failed to fetch historical data');
    process.exit(1);
  }

  console.log(`[backfill] Got ${btcData.prices.length} BTC, ${ethData.prices.length} ETH, ${solData.prices.length} SOL data points`);

  // Also fetch global data for dominance
  await rateLimitedSleep(1500);
  const globalData = await fetchWithRetry<{ data: { market_cap_percentage: { btc: number }; total_market_cap: { usd: number } } }>(
    'https://api.coingecko.com/api/v3/global',
  );

  // Also fetch stablecoin mcap history
  await rateLimitedSleep(1500);
  const stablecoinData = await fetchWithRetry<{ peggedAssets: Array<{ circulating: { peggedUSD: number } }> }>(
    'https://stablecoins.llama.fi/stablecoins?includePrices=false',
  );
  const currentStablecoinMcap = stablecoinData?.peggedAssets?.reduce(
    (sum, a) => sum + (a.circulating?.peggedUSD ?? 0), 0,
  ) ?? null;

  // Build price arrays for SMA/RSI computation
  const btcPrices = btcData.prices.map(([, p]) => p);
  const ethPrices = ethData.prices.map(([, p]) => p);
  const solPrices = solData.prices.map(([, p]) => p);

  let upserted = 0;

  for (let i = 0; i < btcData.prices.length; i++) {
    const date = tsToDate(btcData.prices[i][0]);
    const btcPrice = btcPrices[i];
    const ethPrice = ethPrices[i] ?? null;
    const solPrice = solPrices[i] ?? null;

    // Compute SMAs and RSI using data up to this point
    const pricesUpToNow = btcPrices.slice(0, i + 1);
    const btcSma20 = computeSma(pricesUpToNow, 20);
    const btcSma50 = computeSma(pricesUpToNow, 50);
    const btcSma200 = computeSma(pricesUpToNow, 200);
    const btcRsi14 = computeRsi(pricesUpToNow, 14);

    // Compute ratios
    const ethBtcRatio = ethPrice && btcPrice ? ethPrice / btcPrice : null;
    const solBtcRatio = solPrice && btcPrice ? solPrice / btcPrice : null;

    // Compute ratio SMAs
    const ethBtcHistory = [];
    const solBtcHistory = [];
    for (let j = 0; j <= i; j++) {
      if (ethPrices[j] && btcPrices[j]) ethBtcHistory.push(ethPrices[j] / btcPrices[j]);
      if (solPrices[j] && btcPrices[j]) solBtcHistory.push(solPrices[j] / btcPrices[j]);
    }
    const ethBtcRatioSma20 = computeSma(ethBtcHistory, 20);
    const solBtcRatioSma20 = computeSma(solBtcHistory, 20);

    await db
      .insert(marketDaily)
      .values({
        date,
        btcPrice,
        ethPrice,
        solPrice,
        btcVolume: btcData.total_volumes[i]?.[1] ?? null,
        ethVolume: ethData.total_volumes[i]?.[1] ?? null,
        btcMcap: btcData.market_caps[i]?.[1] ?? null,
        totalMcap: null,
        btcDominance: null,
        btcSma20,
        btcSma50,
        btcSma200,
        btcRsi14,
        ethBtcRatio,
        solBtcRatio,
        ethBtcRatioSma20,
        solBtcRatioSma20,
        stablecoinMcapSma7: null,
      })
      .onConflictDoUpdate({
        target: marketDaily.date,
        set: {
          btcPrice,
          ethPrice,
          solPrice,
          btcVolume: btcData.total_volumes[i]?.[1] ?? null,
          ethVolume: ethData.total_volumes[i]?.[1] ?? null,
          btcMcap: btcData.market_caps[i]?.[1] ?? null,
          btcSma20,
          btcSma50,
          btcSma200,
          btcRsi14,
          ethBtcRatio,
          solBtcRatio,
          ethBtcRatioSma20,
          solBtcRatioSma20,
        },
      });

    upserted++;
    if (upserted % 50 === 0) console.log(`[backfill] Upserted ${upserted}/${btcData.prices.length} days`);
  }

  console.log(`[backfill] Done — ${upserted} days of market data with SMAs + RSI`);

  // Now re-run today's ingest so it picks up the historical context
  console.log('[backfill] Now re-computing today with full history...');

  // Re-read the latest row to verify SMAs are populated
  const { desc } = await import('drizzle-orm');
  const [latest] = await db.select().from(marketDaily).orderBy(desc(marketDaily.date)).limit(1);
  console.log(`[backfill] Latest: date=${latest?.date}, btcSma20=${latest?.btcSma20?.toFixed(0)}, btcSma200=${latest?.btcSma200?.toFixed(0)}, btcRsi14=${latest?.btcRsi14?.toFixed(1)}, ethBtcSma20=${latest?.ethBtcRatioSma20?.toFixed(6)}`);

  await closeDb();
}

main().catch((err) => {
  console.error('[backfill] Failed:', err);
  process.exit(1);
});
