import { llmJson } from '../lib/llm.js';

export interface SectorLlmAnalysis {
  sector: string;
  narrative_score: number;    // 0-20, replaces the price-proxy narrative sub-score
  funding_score: number;      // 0-20, replaces the stubbed funding sub-score
  thesis_notes: string;
  risks: string[];
  catalysts: string[];
}

export async function analyseSectors(sectors: Array<{
  key: string;
  name: string;
  scoreTotal: number;
  tierCandidate: string;
  basketReturn7d: number | null;
  basketReturn30d: number | null;
  tvlTotal: number | null;
  tvlChange30d: number | null;
  leaderToken: string | null;
  tokenUniverse: string[];
}>): Promise<SectorLlmAnalysis[]> {
  const sectorSummaries = sectors.map((s) =>
    `- ${s.key} (${s.name}): score=${s.scoreTotal}, tier=${s.tierCandidate}, ` +
    `7d=${s.basketReturn7d?.toFixed(1) ?? '?'}%, 30d=${s.basketReturn30d?.toFixed(1) ?? '?'}%, ` +
    `TVL=${s.tvlTotal ? '$' + (s.tvlTotal / 1e9).toFixed(2) + 'B' : 'n/a'}, ` +
    `TVL Δ30d=${s.tvlChange30d?.toFixed(1) ?? '?'}%, ` +
    `leader=${s.leaderToken ?? 'none'}, tokens=[${s.tokenUniverse.join(', ')}]`
  ).join('\n');

  const prompt = `You are a crypto sector analyst. Assess each sector's narrative momentum and funding activity.

The quantitative model scores narrative using 7-day price returns (a weak proxy) and has NO automated funding data (defaults to neutral). Your job is to provide better scores for these two dimensions based on your knowledge.

SECTORS:
${sectorSummaries}

For EACH sector, assess:
1. **Narrative score (0-20)**: Is there genuine buzz, developer interest, institutional attention, or media coverage? Not just price — actual narrative momentum. 0 = dead narrative, 10 = neutral, 20 = dominant narrative.
2. **Funding score (0-20)**: Any known funding rounds, grants, or major capital inflows in the last 30 days? 0 = nothing, 8 = minor, 14 = significant, 20 = major.
3. **Thesis notes**: 1 sentence on the sector's current positioning.
4. **Risks**: What could derail this sector?
5. **Catalysts**: What could accelerate it?

Return ONLY a JSON array (no markdown):
[
  {
    "sector": "sector_key",
    "narrative_score": 0-20,
    "funding_score": 0-20,
    "thesis_notes": "...",
    "risks": ["..."],
    "catalysts": ["..."]
  }
]`;

  const result = await llmJson<SectorLlmAnalysis[]>(prompt, 'scoring', 'llm_sector_analysis');
  return result ?? [];
}
