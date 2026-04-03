import { llmJson } from '../lib/llm.js';
import { trace } from '../lib/trace.js';

export interface RegimeLlmAnalysis {
  narrative_assessment: string;
  risk_flags: string[];
  label_agreement: boolean;
  label_override: string | null;
  confidence_adjustment: number; // -1, 0, or +1
  reasoning: string;
}

export async function analyseRegime(context: {
  scoreTotal: number;
  label: string;
  confidence: string;
  subStructure: number;
  subLeverage: number;
  subFlows: number;
  subOnchain: number;
  subAltStrength: number;
  btcPrice: number;
  ethPrice: number;
  solPrice: number;
  btcDominance: number | null;
  dataCompleteness: Record<string, boolean>;
}): Promise<RegimeLlmAnalysis | null> {
  const prompt = `You are a crypto macro analyst. Analyse this regime assessment and return ONLY a JSON object.

REGIME DATA:
- Total score: ${context.scoreTotal} (range: -100 to +100)
- Label: ${context.label}
- Confidence: ${context.confidence}
- Sub-scores (each -20 to +20):
  - Market Structure: ${context.subStructure}
  - Leverage Stress: ${context.subLeverage}
  - Flow Support: ${context.subFlows}
  - On-Chain Stress: ${context.subOnchain}
  - Alt Relative Strength: ${context.subAltStrength}

MARKET CONTEXT:
- BTC: $${context.btcPrice.toLocaleString()}
- ETH: $${context.ethPrice.toLocaleString()}
- SOL: $${context.solPrice.toLocaleString()}
- BTC Dominance: ${context.btcDominance?.toFixed(1) ?? 'unknown'}%

DATA QUALITY:
${Object.entries(context.dataCompleteness).map(([k, v]) => `- ${k}: ${v ? 'available' : 'MISSING'}`).join('\n')}

TASK:
1. Do you agree with the "${context.label}" label given the sub-scores? If not, what should it be?
2. What risks is the quantitative model missing right now? (regulatory, macro events, structural changes)
3. Are there narrative factors (crypto twitter sentiment, major protocol events, regulatory news) that the numbers can't capture?
4. Should confidence be adjusted? (-1 = lower, 0 = keep, +1 = raise)

Return ONLY this JSON (no markdown, no explanation):
{
  "narrative_assessment": "1-2 sentence assessment of current crypto narrative",
  "risk_flags": ["list", "of", "risks", "the", "model", "misses"],
  "label_agreement": true/false,
  "label_override": null or "deteriorating"/"stabilising"/"improving",
  "confidence_adjustment": 0,
  "reasoning": "2-3 sentences explaining your analysis"
}`;

  return llmJson<RegimeLlmAnalysis>(prompt, 'scoring', 'llm_regime_analysis');
}
