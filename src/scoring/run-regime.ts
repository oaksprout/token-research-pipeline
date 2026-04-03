import { desc } from 'drizzle-orm';
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
import { trace } from '../lib/trace.js';

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

  const structureInput = {
    btcPrice: latestMarket.btcPrice!,
    btcSma20: latestMarket.btcSma20 ?? latestMarket.btcPrice!,
    btcSma50: latestMarket.btcSma50 ?? latestMarket.btcPrice!,
    btcSma200: latestMarket.btcSma200 ?? latestMarket.btcPrice!,
    weeklyLows4w,
    week52Low,
    week52High,
  };
  const subStructure = scoreMarketStructure(structureInput);

  await trace('scoring', 'regime_market_structure', 'computation', {
    input: structureInput,
    nullSmas: { sma20: latestMarket.btcSma20 == null, sma50: latestMarket.btcSma50 == null, sma200: latestMarket.btcSma200 == null },
    output: subStructure,
    reasoning: subStructure === 0 ? 'All SMAs null (first run) — defaulting to price, so no above/below signal' : undefined,
  });

  const leverageInput = {
    fundingRateAvg7d: latestFlows?.fundingRateAvg ?? null,
    oiChangePct7d: latestFlows?.oiChangePct24h ?? null,
    liquidationsLong24h: latestFlows?.liquidationsLong24h ?? null,
    liquidationsShort24h: latestFlows?.liquidationsShort24h ?? null,
  };
  const subLeverage = scoreLeverageStress(leverageInput);

  await trace('scoring', 'regime_leverage_stress', 'computation', {
    input: leverageInput,
    output: subLeverage,
  });

  const flowInput = {
    etfNetFlowDaily: latestFlows?.etfNetFlowDaily ?? null,
    stablecoinChange7d: latestFlows?.stablecoinChange7d ?? null,
    stablecoinAccelerating,
    exchangeNetflowBtc: latestFlows?.exchangeNetflowBtc ?? null,
  };
  const flowResult = scoreFlowSupport(flowInput);

  await trace('scoring', 'regime_flow_support', 'computation', {
    input: flowInput,
    output: flowResult,
    reasoning: !flowResult.etfDataAvailable ? 'No ETF flow data available — ETF contribution = 0' : undefined,
  });

  const onchainInput = {
    btcPrice: latestMarket.btcPrice!,
    btcAth,
    btcRsi14: latestMarket.btcRsi14 ?? null,
  };
  const subOnchain = scoreOnchainStress(onchainInput);

  await trace('scoring', 'regime_onchain_stress', 'computation', {
    input: onchainInput,
    athRatio: latestMarket.btcPrice! / btcAth,
    output: subOnchain,
  });

  const altInput = {
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
  };
  const subAltStr = scoreAltStrength(altInput);

  await trace('scoring', 'regime_alt_strength', 'computation', {
    input: altInput,
    nullRatioSmas: { ethBtcSma20: latestMarket.ethBtcRatioSma20 == null, solBtcSma20: latestMarket.solBtcRatioSma20 == null },
    output: subAltStr,
    reasoning: subAltStr === -20 ? 'All alt strength signals negative — ratio SMAs null means above_sma defaults to false' : undefined,
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

  await trace('scoring', 'regime_total', 'computation', {
    subScores: { subStructure, subLeverage, subFlows: flowResult.score, subOnchain, subAltStrength: subAltStr },
    result: { scoreTotal: result.scoreTotal, label: result.label, confidence: result.confidence, sizingImplication: result.sizingImplication },
    dataCompleteness: {
      hasSmas: latestMarket.btcSma20 != null,
      hasRsi: latestMarket.btcRsi14 != null,
      hasEtf: flowResult.etfDataAvailable,
      hasStablecoinChange: latestFlows?.stablecoinChange7d != null,
      hasRatioSmas: latestMarket.ethBtcRatioSma20 != null,
      weeklyLowsCount: weeklyLows4w.length,
      historicalDays: allPrices.length,
    },
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
