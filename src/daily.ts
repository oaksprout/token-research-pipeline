import { logRun, closeDb } from './db/client.js';
import { ingestMarket } from './ingest/market.js';

async function main() {
  await logRun('daily-ingest', async () => {
    await ingestMarket();
    // ingestSectors() added in Phase 2
  });
  await closeDb();
}

main().catch((err) => {
  console.error('daily-ingest failed:', err);
  process.exit(1);
});
