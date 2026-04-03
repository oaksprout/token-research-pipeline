import { logRun, closeDb } from './db/client.js';
import { ingestMarket } from './ingest/market.js';
import { ingestSectors } from './ingest/sectors.js';

async function main() {
  await logRun('daily-ingest', async () => {
    await ingestMarket();
    await ingestSectors();
  });
  await closeDb();
}

main().catch((err) => {
  console.error('daily-ingest failed:', err);
  process.exit(1);
});
