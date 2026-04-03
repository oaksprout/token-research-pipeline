import { llmJson } from '../lib/llm.js';

export interface ThesisEvaluation {
  symbol: string;
  thesis_still_valid: boolean;
  thesis_assessment: string;
  risk_factors: string[];
  conviction_delta: number; // -2 to +2
}

export interface PortfolioLlmAnalysis {
  evaluations: ThesisEvaluation[];
  top_actions: string[];
  overall_assessment: string;
}

export async function analysePortfolio(context: {
  regimeLabel: string;
  regimeScore: number;
  holdings: Array<{
    symbol: string;
    bucket: string;
    thesis: string;
    thesis_status: string;
    currentPct: number;
    proposedAction: string;
    reasonCode: string;
    sectorTier: string | null;
    tokenScore: number | null;
  }>;
}): Promise<PortfolioLlmAnalysis | null> {
  const holdingLines = context.holdings.map((h) =>
    `- ${h.symbol} (${h.bucket}): thesis="${h.thesis}", status=${h.thesis_status}, ` +
    `weight=${(h.currentPct * 100).toFixed(1)}%, action=${h.proposedAction} (${h.reasonCode}), ` +
    `sector_tier=${h.sectorTier ?? 'n/a'}, token_score=${h.tokenScore ?? 'n/a'}`
  ).join('\n');

  const prompt = `You are a crypto portfolio analyst. Evaluate whether each holding's thesis is still valid based on current market conditions.

REGIME: ${context.regimeLabel} (score: ${context.regimeScore})

HOLDINGS:
${holdingLines}

For each holding:
1. Is the original thesis still valid? Consider market structure, competitive landscape, and recent developments.
2. What are the current risk factors?
3. Conviction delta: -2 (thesis broken), -1 (weakening), 0 (unchanged), +1 (strengthening), +2 (strongly confirmed)

Then provide:
- Top 5 concrete actions for this week (not "consider" — specific: "Sell X at market", "Add $Y to Z")
- Overall portfolio assessment in 2-3 sentences

Return ONLY this JSON (no markdown):
{
  "evaluations": [
    {
      "symbol": "TOKEN",
      "thesis_still_valid": true/false,
      "thesis_assessment": "1-2 sentences",
      "risk_factors": ["..."],
      "conviction_delta": 0
    }
  ],
  "top_actions": ["Action 1", "Action 2", ...],
  "overall_assessment": "2-3 sentences"
}`;

  return llmJson<PortfolioLlmAnalysis>(prompt, 'engine', 'llm_portfolio_analysis');
}
