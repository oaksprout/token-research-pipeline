import { db } from '../db/client.js';
import { runTrace } from '../db/schema.js';

let currentRunId: string | null = null;

export function setRunId(runId: string): void {
  currentRunId = runId;
}

export function getRunId(): string | null {
  return currentRunId;
}

export async function trace(
  phase: string,
  step: string,
  category: 'api_call' | 'computation' | 'decision' | 'upsert' | 'error',
  detail: Record<string, unknown>,
  durationMs?: number,
): Promise<void> {
  if (!currentRunId) return;
  try {
    await db.insert(runTrace).values({
      runId: currentRunId,
      phase,
      step,
      category,
      detail: JSON.stringify(detail),
      durationMs: durationMs ?? null,
    });
  } catch {
    // Never let tracing crash the pipeline
  }
}

export async function traceApiCall(
  phase: string,
  step: string,
  url: string,
  fn: () => Promise<unknown>,
): Promise<unknown> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    await trace(phase, step, 'api_call', {
      url,
      status: 'success',
      durationMs: duration,
      resultSummary: result == null ? 'null' : typeof result === 'object' && Array.isArray(result) ? `${result.length} items` : 'object',
    }, duration);
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    await trace(phase, step, 'error', {
      url,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      durationMs: duration,
    }, duration);
    throw err;
  }
}

export async function traceComputation(
  phase: string,
  step: string,
  inputs: Record<string, unknown>,
  fn: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  await trace(phase, step, 'computation', {
    inputs,
    output: result,
    durationMs: duration,
  }, duration);
  return result;
}
