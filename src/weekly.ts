import { logRun, closeDb } from './db/client.js';
import { scoreRegime } from './scoring/run-regime.js';
import { scoreSectors } from './scoring/run-sectors.js';
import { scoreTokens } from './scoring/run-tokens.js';
import { runLlmAnalysis } from './scoring/run-llm-analysis.js';
import { applyDecisionRules } from './engine/run-decision-rules.js';
import { generatePortfolioActions } from './engine/run-portfolio-actions.js';
import { generateReport } from './report/generate.js';
import { buildContext } from './engine/context-builder.js';

async function main() {
  await logRun('weekly-scoring', async () => {
    // Phase 1: Deterministic scoring
    await scoreRegime();
    await scoreSectors();
    await scoreTokens();

    // Phase 2: LLM enrichment (updates sector scores, adds analysis)
    await runLlmAnalysis();

    // Phase 3: Decision engine (uses LLM-enriched scores)
    await applyDecisionRules();
    await generatePortfolioActions();
    await generateReport();
    await buildContext();
  });
  await closeDb();
}

main().catch((err) => {
  console.error('weekly-scoring failed:', err);
  process.exit(1);
});
