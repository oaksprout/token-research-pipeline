import { logRun, closeDb } from './db/client.js';
import { scoreRegime } from './scoring/run-regime.js';
import { scoreSectors } from './scoring/run-sectors.js';
import { scoreTokens } from './scoring/run-tokens.js';
import { applyDecisionRules } from './engine/run-decision-rules.js';
import { generatePortfolioActions } from './engine/run-portfolio-actions.js';
import { generateReport } from './report/generate.js';
import { buildContext } from './engine/context-builder.js';

async function main() {
  await logRun('weekly-scoring', async () => {
    await scoreRegime();
    await scoreSectors();
    await scoreTokens();
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
