import { desc, eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  regimeScoresWeekly,
  sectorScoresWeekly,
  sectorMetricsWeekly,
  tokenScoresWeekly,
  portfolioActionsWeekly,
  marketDaily,
  llmAnalysisWeekly,
} from '../db/schema.js';
import { loadSectors, loadPortfolio } from '../lib/config.js';
import { trace } from '../lib/trace.js';
import { analyseRegime } from './llm-regime.js';
import { analyseSectors } from './llm-sectors.js';
import { analysePortfolio } from './llm-portfolio.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function runLlmAnalysis(): Promise<void> {
  const date = today();
  console.log(`[llm_analysis] Starting for ${date}`);

  // ─── Gather context ───────────────────────────────────────────────

  const [regime] = await db.select().from(regimeScoresWeekly).orderBy(desc(regimeScoresWeekly.date)).limit(1);
  const [market] = await db.select().from(marketDaily).orderBy(desc(marketDaily.date)).limit(1);
  const sectorScores = await db.select().from(sectorScoresWeekly).where(eq(sectorScoresWeekly.date, date));
  const sectorMetrics = await db.select().from(sectorMetricsWeekly).where(eq(sectorMetricsWeekly.date, date));
  const actions = await db.select().from(portfolioActionsWeekly).where(eq(portfolioActionsWeekly.date, date));
  const tokenScores = await db.select().from(tokenScoresWeekly).where(eq(tokenScoresWeekly.date, date));

  const sectorsConfig = loadSectors();
  const portfolio = loadPortfolio();

  // ─── 1. Regime LLM Analysis ───────────────────────────────────────

  let regimeAnalysis = null;
  if (regime && market) {
    console.log('[llm_analysis] Analysing regime...');
    regimeAnalysis = await analyseRegime({
      scoreTotal: regime.scoreTotal ?? 0,
      label: regime.label ?? 'stabilising',
      confidence: regime.confidence ?? 'low',
      subStructure: regime.subStructure ?? 0,
      subLeverage: regime.subLeverage ?? 0,
      subFlows: regime.subFlows ?? 0,
      subOnchain: regime.subOnchain ?? 0,
      subAltStrength: regime.subAltStrength ?? 0,
      btcPrice: market.btcPrice ?? 0,
      ethPrice: market.ethPrice ?? 0,
      solPrice: market.solPrice ?? 0,
      btcDominance: market.btcDominance,
      dataCompleteness: {
        hasSmas: market.btcSma20 != null,
        hasRsi: market.btcRsi14 != null,
        hasEtfFlows: regime.etfDataAvailable ?? false,
        hasStablecoinTrend: market.stablecoinMcapSma7 != null,
        hasRatioSmas: market.ethBtcRatioSma20 != null,
      },
    });

    if (regimeAnalysis) {
      console.log(`[llm_analysis] Regime: ${regimeAnalysis.label_agreement ? 'agrees' : 'DISAGREES'} with "${regime.label}"`);
      if (regimeAnalysis.risk_flags.length > 0) {
        console.log(`[llm_analysis] Risk flags: ${regimeAnalysis.risk_flags.join(', ')}`);
      }
    }
  }

  // ─── 2. Sector LLM Analysis ──────────────────────────────────────

  console.log('[llm_analysis] Analysing sectors...');
  const metricsMap = new Map(sectorMetrics.map((m) => [m.sector, m]));
  const tokenScoreMap = new Map<string, number>();
  for (const ts of tokenScores) {
    if (ts.sector && ts.rankInSector === 1) {
      tokenScoreMap.set(ts.sector, ts.scoreTotal ?? 0);
    }
  }

  const sectorInputs = sectorScores.map((s) => {
    const metrics = metricsMap.get(s.sector);
    const config = sectorsConfig.sectors[s.sector];
    return {
      key: s.sector,
      name: config?.name ?? s.sector,
      scoreTotal: s.scoreTotal ?? 0,
      tierCandidate: s.tierCandidate ?? 'observe',
      basketReturn7d: metrics?.basketReturn7d ?? null,
      basketReturn30d: metrics?.basketReturn30d ?? null,
      tvlTotal: metrics?.tvlTotal ?? null,
      tvlChange30d: metrics?.tvlChange30d ?? null,
      leaderToken: s.leaderTokens || null,
      tokenUniverse: config?.token_universe ?? [],
    };
  });

  const sectorAnalysis = await analyseSectors(sectorInputs);

  if (sectorAnalysis.length > 0) {
    console.log(`[llm_analysis] Got sector analysis for ${sectorAnalysis.length} sectors`);

    // Update sector scores with LLM narrative and funding scores
    for (const sa of sectorAnalysis) {
      const existing = sectorScores.find((s) => s.sector === sa.sector);
      if (!existing) continue;

      // Recompute sector total with LLM-enriched sub-scores
      const newTotal =
        (existing.subDev ?? 0) +
        (existing.subUsage ?? 0) +
        sa.funding_score +       // LLM replaces stubbed funding
        sa.narrative_score +     // LLM replaces price-proxy narrative
        (existing.subRs ?? 0);

      await db
        .update(sectorScoresWeekly)
        .set({
          subFunding: sa.funding_score,
          subNarrative: sa.narrative_score,
          scoreTotal: newTotal,
          leaderTokens: `${existing.leaderTokens ?? ''}`,
        })
        .where(and(eq(sectorScoresWeekly.date, date), eq(sectorScoresWeekly.sector, sa.sector)));

      await trace('scoring', `llm_sector_update_${sa.sector}`, 'upsert', {
        sector: sa.sector,
        oldNarrative: existing.subNarrative,
        newNarrative: sa.narrative_score,
        oldFunding: existing.subFunding,
        newFunding: sa.funding_score,
        oldTotal: existing.scoreTotal,
        newTotal,
        thesisNotes: sa.thesis_notes,
        risks: sa.risks,
        catalysts: sa.catalysts,
      });

      console.log(`[llm_analysis] ${sa.sector}: score ${existing.scoreTotal} → ${newTotal} (narrative: ${sa.narrative_score}, funding: ${sa.funding_score})`);
    }
  }

  // ─── 3. Portfolio LLM Analysis ────────────────────────────────────

  console.log('[llm_analysis] Analysing portfolio...');
  const tokenScoreBySymbol = new Map(tokenScores.map((t) => [t.symbol, t]));

  const holdingInputs = portfolio.holdings.map((h) => {
    const action = actions.find((a) => a.symbol === h.symbol);
    const ts = tokenScoreBySymbol.get(h.symbol);
    return {
      symbol: h.symbol,
      bucket: h.bucket,
      thesis: h.thesis,
      thesis_status: h.thesis_status,
      currentPct: action?.currentPct ?? 0,
      proposedAction: action?.proposedAction ?? 'no_action',
      reasonCode: action?.reasonCode ?? '',
      sectorTier: null as string | null, // simplified for now
      tokenScore: ts?.scoreTotal ?? null,
    };
  });

  const portfolioAnalysis = await analysePortfolio({
    regimeLabel: regime?.label ?? 'stabilising',
    regimeScore: regime?.scoreTotal ?? 0,
    holdings: holdingInputs,
  });

  if (portfolioAnalysis) {
    console.log(`[llm_analysis] Portfolio: ${portfolioAnalysis.top_actions.length} actions recommended`);
    for (const action of portfolioAnalysis.top_actions) {
      console.log(`[llm_analysis]   → ${action}`);
    }
  }

  // ─── Persist LLM analysis ────────────────────────────────────────

  await db
    .insert(llmAnalysisWeekly)
    .values({
      date,
      regimeAnalysis: regimeAnalysis ? JSON.stringify(regimeAnalysis) : null,
      sectorAnalysis: sectorAnalysis.length > 0 ? JSON.stringify(sectorAnalysis) : null,
      portfolioAnalysis: portfolioAnalysis ? JSON.stringify(portfolioAnalysis) : null,
    })
    .onConflictDoUpdate({
      target: llmAnalysisWeekly.date,
      set: {
        regimeAnalysis: regimeAnalysis ? JSON.stringify(regimeAnalysis) : null,
        sectorAnalysis: sectorAnalysis.length > 0 ? JSON.stringify(sectorAnalysis) : null,
        portfolioAnalysis: portfolioAnalysis ? JSON.stringify(portfolioAnalysis) : null,
      },
    });

  console.log(`[llm_analysis] Done for ${date}`);
}
