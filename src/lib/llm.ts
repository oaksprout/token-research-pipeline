import { execFile } from 'node:child_process';
import { trace } from './trace.js';

interface LlmResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * Call an LLM via Codex CLI in headless mode.
 * Uses the user's authenticated Codex session (ChatGPT or API).
 */
export async function llm(
  prompt: string,
  phase: string,
  step: string,
): Promise<LlmResult> {
  const start = Date.now();

  const result = await new Promise<LlmResult>((resolve, reject) => {
    const child = execFile(
      'codex',
      [
        'exec',
        '--skip-git-repo-check',
        '--json',
        '-c', 'model_reasoning_effort="high"',
        prompt,
      ],
      { maxBuffer: 1024 * 1024, timeout: 120_000 },
      (err, stdout, stderr) => {
        if (err && !stdout) {
          reject(new Error(`Codex exec failed: ${err.message}\n${stderr}`));
          return;
        }

        // Parse JSONL output
        const lines = (stdout || '').trim().split('\n');
        let text = '';
        let inputTokens = 0;
        let outputTokens = 0;
        let model = 'unknown';

        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.type === 'item.completed' && event.item?.text) {
              text = event.item.text;
            }
            if (event.type === 'turn.completed' && event.usage) {
              inputTokens = event.usage.input_tokens ?? 0;
              outputTokens = event.usage.output_tokens ?? 0;
            }
          } catch {
            // skip non-JSON lines
          }
        }

        resolve({ text, inputTokens, outputTokens, model: 'codex-default' });
      },
    );
  });

  const duration = Date.now() - start;

  await trace(phase, step, 'api_call', {
    type: 'llm_call',
    engine: 'codex-cli',
    model: result.model,
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, 300),
    responseLength: result.text.length,
    responsePreview: result.text.slice(0, 500),
    fullPrompt: prompt,
    fullResponse: result.text,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    totalTokens: result.inputTokens + result.outputTokens,
    durationMs: duration,
  }, duration);

  return result;
}

/**
 * Call LLM expecting a JSON response. Parses the response and retries once on parse failure.
 */
export async function llmJson<T>(
  prompt: string,
  phase: string,
  step: string,
): Promise<T | null> {
  const result = await llm(prompt, phase, step);

  // Try to extract JSON from the response (might be wrapped in markdown code fences)
  let jsonStr = result.text;
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    await trace(phase, `${step}_parse_error`, 'error', {
      rawResponse: result.text,
      error: 'Failed to parse LLM response as JSON',
    });
    return null;
  }
}
