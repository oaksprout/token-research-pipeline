import { logRun, closeDb } from './db/client.js';
import { scoreRegime } from './scoring/run-regime.js';

async function main() {
  await logRun('weekly-scoring', async () => {
    await scoreRegime();
    // Phase 2: scoreSectors(), scoreTokens(), applyDecisionRules(),
    //          generatePortfolioActions(), generateReport(), buildPromptContext()
  });
  await closeDb();
}

main().catch((err) => {
  console.error('weekly-scoring failed:', err);
  process.exit(1);
});
