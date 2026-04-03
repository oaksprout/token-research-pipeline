import { db } from '../src/db/client.js';
import { runTrace, runLog } from '../src/db/schema.js';
import { desc, eq } from 'drizzle-orm';

async function main() {
  // Get latest run
  const [latestRun] = await db.select().from(runLog).orderBy(desc(runLog.startedAt)).limit(1);
  console.log('Latest run:', latestRun?.script, latestRun?.status, latestRun?.id);

  if (!latestRun) { process.exit(0); }

  // Get traces for that run
  const traces = await db.select().from(runTrace).where(eq(runTrace.runId, latestRun.id)).orderBy(runTrace.timestamp);
  console.log(`\nFound ${traces.length} trace entries:\n`);

  for (const t of traces) {
    const detail = JSON.parse(t.detail);
    console.log(`[${t.phase}/${t.step}] ${t.category} (${t.durationMs ?? '?'}ms)`);
    console.log('  ', JSON.stringify(detail).slice(0, 200));
    console.log();
  }

  process.exit(0);
}
main();
