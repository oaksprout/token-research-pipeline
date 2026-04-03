import { eq, desc } from 'drizzle-orm';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../db/client.js';
import {
  regimeScoresWeekly,
  sectorScoresWeekly,
  tierRecommendationsWeekly,
  portfolioActionsWeekly,
} from '../db/schema.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const ROOT = resolve(import.meta.dirname, '..', '..');

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

// ─── Regime Report ──────────────────────────────────────────────────

function generateRegimeMarkdown(regime: {
  scoreTotal: number | null;
  label: string | null;
  confidence: string | null;
  subStructure: number | null;
  subLeverage: number | null;
  subFlows: number | null;
  subOnchain: number | null;
  subAltStrength: number | null;
  sizingImplication: string | null;
  etfDataAvailable: boolean | null;
}): string {
  return `# Regime Report — ${today()}

| Metric | Value |
|--------|-------|
| Total Score | ${regime.scoreTotal ?? 'n/a'} |
| Label | ${regime.label ?? 'n/a'} |
| Confidence | ${regime.confidence ?? 'n/a'} |
| Market Structure | ${regime.subStructure ?? 'n/a'} |
| Leverage Stress | ${regime.subLeverage ?? 'n/a'} |
| Flow Support | ${regime.subFlows ?? 'n/a'} |
| On-Chain Stress | ${regime.subOnchain ?? 'n/a'} |
| Alt Relative Strength | ${regime.subAltStrength ?? 'n/a'} |
| Sizing | ${regime.sizingImplication ?? 'n/a'} |
| ETF Data Available | ${regime.etfDataAvailable ?? 'n/a'} |
`;
}

// ─── Sectors Report ─────────────────────────────────────────────────

function generateSectorsMarkdown(
  sectors: Array<{
    sector: string;
    scoreTotal: number | null;
    subDev: number | null;
    subUsage: number | null;
    subFunding: number | null;
    subNarrative: number | null;
    subRs: number | null;
    structuralFilter: string | null;
    validation: string | null;
    tierCandidate: string | null;
    leaderTokens: string | null;
  }>,
  tiers: Array<{
    sector: string;
    priorTier: string | null;
    proposedTier: string | null;
    changeReason: string | null;
    leaderToken: string | null;
  }>,
): string {
  const tierMap = new Map(tiers.map((t) => [t.sector, t]));

  let md = `# Sector Report — ${today()}\n\n`;
  md += '| Sector | Score | Dev | Usage | Funding | Narrative | RS | Filter | Validation | Tier Prev | Tier Prop | Change | Leader |\n';
  md += '|--------|-------|-----|-------|---------|-----------|----|---------|-----------:|-----------|-----------|--------|--------|\n';

  for (const s of sectors.sort((a, b) => (b.scoreTotal ?? 0) - (a.scoreTotal ?? 0))) {
    const t = tierMap.get(s.sector);
    md += `| ${s.sector} | ${s.scoreTotal ?? '-'} | ${s.subDev ?? '-'} | ${s.subUsage ?? '-'} | ${s.subFunding ?? '-'} | ${s.subNarrative ?? '-'} | ${s.subRs ?? '-'} | ${s.structuralFilter ?? '-'} | ${s.validation ?? '-'} | ${t?.priorTier ?? '-'} | ${t?.proposedTier ?? '-'} | ${t?.changeReason ?? '-'} | ${t?.leaderToken ?? '-'} |\n`;
  }

  return md;
}

// ─── Portfolio Report ───────────────────────────────────────────────

function generatePortfolioMarkdown(
  actions: Array<{
    symbol: string;
    currentBucket: string | null;
    currentPct: number | null;
    targetPct: number | null;
    proposedAction: string | null;
    reasonCode: string | null;
    confidence: string | null;
    executionBlocked: boolean | null;
  }>,
): string {
  let md = `# Portfolio Report — ${today()}\n\n`;
  md += '| Symbol | Bucket | Current % | Target % | Action | Reason | Confidence | Blocked |\n';
  md += '|--------|--------|-----------|----------|--------|--------|------------|---------|\n';

  for (const a of actions) {
    const curPct = a.currentPct != null ? (a.currentPct * 100).toFixed(1) + '%' : '-';
    const tgtPct = a.targetPct != null ? (a.targetPct * 100).toFixed(1) + '%' : '-';
    md += `| ${a.symbol} | ${a.currentBucket ?? '-'} | ${curPct} | ${tgtPct} | ${a.proposedAction ?? '-'} | ${a.reasonCode ?? '-'} | ${a.confidence ?? '-'} | ${a.executionBlocked ? 'Yes' : 'No'} |\n`;
  }

  return md;
}

// ─── Main ───────────────────────────────────────────────────────────

export async function generateReport(): Promise<void> {
  const date = today();
  console.log(`[generate_report] Starting for ${date}`);

  // Read data
  const [regime] = await db
    .select()
    .from(regimeScoresWeekly)
    .orderBy(desc(regimeScoresWeekly.date))
    .limit(1);

  const sectors = await db
    .select()
    .from(sectorScoresWeekly)
    .where(eq(sectorScoresWeekly.date, date));

  const tiers = await db
    .select()
    .from(tierRecommendationsWeekly)
    .where(eq(tierRecommendationsWeekly.date, date));

  const actions = await db
    .select()
    .from(portfolioActionsWeekly)
    .where(eq(portfolioActionsWeekly.date, date));

  // Generate reports
  const regimeDir = resolve(ROOT, 'outputs', 'regime');
  const sectorsDir = resolve(ROOT, 'outputs', 'sectors');
  const portfolioDir = resolve(ROOT, 'outputs', 'portfolio');

  ensureDir(regimeDir);
  ensureDir(sectorsDir);
  ensureDir(portfolioDir);

  if (regime) {
    writeFileSync(resolve(regimeDir, `regime-${date}.md`), generateRegimeMarkdown(regime));
  }

  if (sectors.length > 0) {
    writeFileSync(resolve(sectorsDir, `sectors-${date}.md`), generateSectorsMarkdown(sectors, tiers));
  }

  if (actions.length > 0) {
    writeFileSync(resolve(portfolioDir, `portfolio-${date}.md`), generatePortfolioMarkdown(actions));
  }

  console.log(`[generate_report] Done for ${date}`);
}
