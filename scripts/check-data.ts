import { db } from '../src/db/client.js';
import { marketDaily, flowsDaily, tokenMetricsDaily, regimeScoresWeekly, sectorScoresWeekly } from '../src/db/schema.js';
import { desc } from 'drizzle-orm';

async function main() {
  const [m] = await db.select().from(marketDaily).orderBy(desc(marketDaily.date)).limit(1);
  console.log('=== Market Daily ===');
  console.log(JSON.stringify(m, null, 2));

  const [f] = await db.select().from(flowsDaily).orderBy(desc(flowsDaily.date)).limit(1);
  console.log('\n=== Flows Daily ===');
  console.log(JSON.stringify(f, null, 2));

  const tokens = await db.select().from(tokenMetricsDaily).orderBy(desc(tokenMetricsDaily.date)).limit(3);
  console.log('\n=== Token Metrics (first 3) ===');
  console.log(JSON.stringify(tokens, null, 2));

  const [r] = await db.select().from(regimeScoresWeekly).orderBy(desc(regimeScoresWeekly.date)).limit(1);
  console.log('\n=== Regime Score ===');
  console.log(JSON.stringify(r, null, 2));

  const sectors = await db.select().from(sectorScoresWeekly).orderBy(desc(sectorScoresWeekly.date)).limit(3);
  console.log('\n=== Sector Scores (first 3) ===');
  console.log(JSON.stringify(sectors, null, 2));

  process.exit(0);
}
main();
