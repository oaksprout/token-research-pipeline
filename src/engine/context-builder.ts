import { eq, desc } from 'drizzle-orm';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../db/client.js';
import {
  regimeScoresWeekly,
  sectorScoresWeekly,
  sectorMetricsWeekly,
  tokenScoresWeekly,
  tierRecommendationsWeekly,
  portfolioActionsWeekly,
} from '../db/schema.js';
import { loadPortfolio, loadSectors } from '../lib/config.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function buildContext(): Promise<void> {
  const date = today();
  console.log(`[build_context] Starting for ${date}`);

  // Read all data
  const [regime] = await db
    .select()
    .from(regimeScoresWeekly)
    .orderBy(desc(regimeScoresWeekly.date))
    .limit(1);

  const sectorScores = await db
    .select()
    .from(sectorScoresWeekly)
    .where(eq(sectorScoresWeekly.date, date));

  const sectorMetrics = await db
    .select()
    .from(sectorMetricsWeekly)
    .where(eq(sectorMetricsWeekly.date, date));

  const tokenScores = await db
    .select()
    .from(tokenScoresWeekly)
    .where(eq(tokenScoresWeekly.date, date));

  const tiers = await db
    .select()
    .from(tierRecommendationsWeekly)
    .where(eq(tierRecommendationsWeekly.date, date));

  const actions = await db
    .select()
    .from(portfolioActionsWeekly)
    .where(eq(portfolioActionsWeekly.date, date));

  const portfolio = loadPortfolio();
  const sectorsConfig = loadSectors();

  // ─── Assemble markdown ────────────────────────────────────────────

  let md = `# Crypto Cycle Monitor — Weekly Context Bundle\nDate: ${date}\nGenerated: ${new Date().toISOString()}\n\n`;

  // Regime
  md += '## Regime Status\n\n';
  if (regime) {
    md += '| Metric | Value |\n|--------|-------|\n';
    md += `| Total Score | ${regime.scoreTotal} |\n`;
    md += `| Label | ${regime.label} |\n`;
    md += `| Confidence | ${regime.confidence} |\n`;
    md += `| Market Structure | ${regime.subStructure} |\n`;
    md += `| Leverage Stress | ${regime.subLeverage} |\n`;
    md += `| Flow Support | ${regime.subFlows} |\n`;
    md += `| On-Chain Stress | ${regime.subOnchain} |\n`;
    md += `| Alt Relative Strength | ${regime.subAltStrength} |\n`;
    md += `| Sizing | ${regime.sizingImplication} |\n`;
    md += `| ETF Data Available | ${regime.etfDataAvailable} |\n`;
  } else {
    md += 'No regime data available.\n';
  }

  // Sector Scores
  md += '\n## Sector Scores & Tier Recommendations\n\n';
  md += '| Sector | Score | Dev | Usage | Funding | Narrative | RS | Tier Prev | Tier Prop | Change | Leader |\n';
  md += '|--------|-------|-----|-------|---------|-----------|-----|-----------|-----------|--------|--------|\n';
  const tierMap = new Map(tiers.map((t) => [t.sector, t]));
  for (const s of sectorScores.sort((a, b) => (b.scoreTotal ?? 0) - (a.scoreTotal ?? 0))) {
    const t = tierMap.get(s.sector);
    md += `| ${s.sector} | ${s.scoreTotal ?? '-'} | ${s.subDev ?? '-'} | ${s.subUsage ?? '-'} | ${s.subFunding ?? '-'} | ${s.subNarrative ?? '-'} | ${s.subRs ?? '-'} | ${t?.priorTier ?? '-'} | ${t?.proposedTier ?? '-'} | ${t?.changeReason ?? '-'} | ${t?.leaderToken ?? '-'} |\n`;
  }

  // Sector Metrics
  md += '\n## Sector Metrics\n\n';
  md += '| Sector | Basket 7d | Basket 30d | RS vs BTC | RS vs ETH | TVL | TVL Δ30d | Fees 30d | Dev Commits |\n';
  md += '|--------|-----------|------------|-----------|-----------|-----|----------|----------|-------------|\n';
  for (const m of sectorMetrics) {
    md += `| ${m.sector} | ${m.basketReturn7d?.toFixed(2) ?? '-'} | ${m.basketReturn30d?.toFixed(2) ?? '-'} | ${m.rsVsBtc30d?.toFixed(2) ?? '-'} | ${m.rsVsEth30d?.toFixed(2) ?? '-'} | ${m.tvlTotal?.toFixed(0) ?? '-'} | ${m.tvlChange30d?.toFixed(2) ?? '-'} | ${m.feeRevenue30d?.toFixed(0) ?? '-'} | ${m.devCommitsProxy ?? '-'} |\n`;
  }

  // Token Scores
  md += '\n## Token Scores\n\n';
  md += '| Symbol | Sector | Score | Liquidity | RS | Structure | Volume | Valuation | Status | Rank |\n';
  md += '|--------|--------|-------|-----------|-----|-----------|--------|-----------|--------|------|\n';
  for (const t of tokenScores.sort((a, b) => (b.scoreTotal ?? 0) - (a.scoreTotal ?? 0))) {
    md += `| ${t.symbol} | ${t.sector ?? '-'} | ${t.scoreTotal ?? '-'} | ${t.subLiquidity ?? '-'} | ${t.subRs ?? '-'} | ${t.subStructure ?? '-'} | ${t.subVolume ?? '-'} | ${t.subValuation ?? '-'} | ${t.candidateStatus ?? '-'} | ${t.rankInSector ?? '-'} |\n`;
  }

  // Portfolio Actions
  md += '\n## Portfolio Holdings & Actions\n\n';
  md += '| Symbol | Bucket | Current % | Target % | Action | Reason | Confidence | Blocked |\n';
  md += '|--------|--------|-----------|----------|--------|--------|------------|---------|\n';
  for (const a of actions) {
    const curPct = a.currentPct != null ? (a.currentPct * 100).toFixed(1) + '%' : '-';
    const tgtPct = a.targetPct != null ? (a.targetPct * 100).toFixed(1) + '%' : '-';
    md += `| ${a.symbol} | ${a.currentBucket ?? '-'} | ${curPct} | ${tgtPct} | ${a.proposedAction ?? '-'} | ${a.reasonCode ?? '-'} | ${a.confidence ?? '-'} | ${a.executionBlocked ? 'Yes' : 'No'} |\n`;
  }

  // Holdings Context
  md += '\n## Holdings Context\n\n';
  md += '| Symbol | Bucket | Units | Cost Basis | Thesis | Status | Can Add |\n';
  md += '|--------|--------|-------|-----------|--------|--------|---------|\n';
  for (const h of portfolio.holdings) {
    md += `| ${h.symbol} | ${h.bucket} | ${h.current_units} | $${h.cost_basis_usd} | ${h.thesis} | ${h.thesis_status} | ${h.can_add} |\n`;
  }

  // Notes
  md += '\n## Notes\n\n';
  const exemptHoldings = portfolio.holdings.filter((h) => h.execution_exempt).map((h) => h.symbol);
  if (exemptHoldings.length > 0) {
    md += `- Execution-exempt holdings: ${exemptHoldings.join(', ')}\n`;
  }
  const weakening = portfolio.holdings.filter((h) => h.thesis_status !== 'intact');
  for (const h of weakening) {
    md += `- ${h.symbol}: thesis ${h.thesis_status}\n`;
  }
  for (const [key, def] of Object.entries(sectorsConfig.sectors)) {
    if (def.notes) {
      md += `- ${key}: ${def.notes}\n`;
    }
  }
  if (regime) {
    md += `- Regime: etf_data_available = ${regime.etfDataAvailable}\n`;
  }

  // Write output
  const ROOT = resolve(import.meta.dirname, '..', '..');
  const outDir = resolve(ROOT, 'outputs', 'context');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, `context-${date}.md`), md);

  console.log(`[build_context] Done for ${date}`);
}
