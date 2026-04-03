import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema.js';
import { runLog } from './schema.js';
import { setRunId } from '../lib/trace.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = postgres(connectionString);
export const db = drizzle(sql, { schema });

export async function logRun(
  scriptName: string,
  fn: () => Promise<void>,
): Promise<void> {
  const [row] = await db
    .insert(runLog)
    .values({ script: scriptName })
    .returning({ id: runLog.id });

  // Enable tracing for this run
  setRunId(row.id);

  const errors: string[] = [];
  let status = 'success';

  try {
    await fn();
  } catch (err) {
    status = 'failed';
    errors.push(err instanceof Error ? err.message : String(err));
  }

  await db
    .update(runLog)
    .set({
      finishedAt: new Date(),
      status,
      errors: errors.length > 0 ? JSON.stringify(errors) : null,
    })
    .where(eq(runLog.id, row.id));

  // Clear trace context
  setRunId('');
}

export async function closeDb(): Promise<void> {
  await sql.end();
}
