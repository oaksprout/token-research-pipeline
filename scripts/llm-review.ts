/**
 * LLM Review Script
 *
 * Reads the weekly context bundle and a prompt template, sends to OpenAI,
 * and writes the review output. All calls are traced to the run_trace table.
 *
 * Usage:
 *   npx tsx scripts/llm-review.ts [--date YYYY-MM-DD] [--prompt regime|sector|portfolio]
 *
 * Authentication:
 *   Uses OpenAI via Codex CLI OAuth (preferred) or OPENAI_API_KEY env var.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { logRun, closeDb } from '../src/db/client.js';
import { trace } from '../src/lib/trace.js';

const ROOT = resolve(import.meta.dirname, '..');

// ─── Auth ──────────────────────────────────────────────────────────

function getOpenAIAuth(): { apiKey?: string; accessToken?: string; method: string } {
  const codexAuthPath = resolve(homedir(), '.codex', 'auth.json');
  if (existsSync(codexAuthPath)) {
    try {
      const auth = JSON.parse(readFileSync(codexAuthPath, 'utf-8'));
      if (auth.access_token) return { accessToken: auth.access_token, method: 'codex_oauth' };
      if (auth.token) return { accessToken: auth.token, method: 'codex_oauth' };
    } catch { /* fall through */ }
  }

  if (process.env.OPENAI_API_KEY) {
    return { apiKey: process.env.OPENAI_API_KEY, method: 'api_key' };
  }

  throw new Error(
    'No OpenAI authentication found.\n' +
    'Either:\n' +
    '  1. Run `codex auth login` to authenticate via Codex OAuth\n' +
    '  2. Set OPENAI_API_KEY environment variable'
  );
}

// ─── OpenAI call ───────────────────────────────────────────────────

const MODEL = 'gpt-4o';

interface OpenAIResponse {
  id: string;
  model: string;
  choices: Array<{ message: { content: string }; finish_reason: string }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

async function callOpenAI(
  systemPrompt: string,
  userContent: string,
  promptType: string,
): Promise<{ content: string; response: OpenAIResponse }> {
  const auth = getOpenAIAuth();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.accessToken) headers['Authorization'] = `Bearer ${auth.accessToken}`;
  else if (auth.apiKey) headers['Authorization'] = `Bearer ${auth.apiKey}`;

  const requestBody = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  };

  // Trace: what we're about to send
  await trace('llm', `llm_request_${promptType}`, 'api_call', {
    model: MODEL,
    authMethod: auth.method,
    systemPromptLength: systemPrompt.length,
    userContentLength: userContent.length,
    systemPromptPreview: systemPrompt.slice(0, 500),
    temperature: 0.3,
    maxTokens: 2000,
  });

  const start = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  const duration = Date.now() - start;

  if (!res.ok) {
    const body = await res.text();
    await trace('llm', `llm_error_${promptType}`, 'error', {
      model: MODEL,
      httpStatus: res.status,
      errorBody: body.slice(0, 1000),
    }, duration);
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }

  const data = await res.json() as OpenAIResponse;
  const content = data.choices[0]?.message?.content ?? '';

  // Trace: full response details
  await trace('llm', `llm_response_${promptType}`, 'computation', {
    model: data.model,
    responseId: data.id,
    finishReason: data.choices[0]?.finish_reason,
    usage: data.usage,
    responseLength: content.length,
    responsePreview: content.slice(0, 500),
    fullResponse: content,
    fullSystemPrompt: systemPrompt,
    fullUserContent: userContent,
  }, duration);

  return { content, response: data };
}

// ─── CLI ───────────────────────────────────────────────────────────

type PromptType = 'regime' | 'sector' | 'portfolio';

function parseArgs(): { date: string; promptType: PromptType } {
  const args = process.argv.slice(2);
  let date = new Date().toISOString().slice(0, 10);
  let promptType: PromptType = 'regime';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      date = args[++i];
    } else if (args[i] === '--prompt' && args[i + 1]) {
      const val = args[++i] as PromptType;
      if (!['regime', 'sector', 'portfolio'].includes(val)) {
        console.error(`Invalid prompt type: ${val}. Must be regime, sector, or portfolio.`);
        process.exit(1);
      }
      promptType = val;
    }
  }

  return { date, promptType };
}

const PROMPT_FILE_MAP: Record<PromptType, string> = {
  regime: 'weekly-regime-review.md',
  sector: 'weekly-sector-review.md',
  portfolio: 'weekly-portfolio-briefing.md',
};

async function main(): Promise<void> {
  const { date, promptType } = parseArgs();

  await logRun(`llm-review-${promptType}`, async () => {
    console.log(`[llm-review] Running ${promptType} review for ${date}`);

    // Read context bundle
    const contextPath = resolve(ROOT, 'outputs', 'context', `context-${date}.md`);
    if (!existsSync(contextPath)) {
      throw new Error(`Context file not found: ${contextPath}. Run the weekly pipeline first.`);
    }
    const context = readFileSync(contextPath, 'utf-8');

    // Read prompt template
    const promptPath = resolve(ROOT, 'prompts', PROMPT_FILE_MAP[promptType]);
    if (!existsSync(promptPath)) {
      throw new Error(`Prompt file not found: ${promptPath}`);
    }
    const systemPrompt = readFileSync(promptPath, 'utf-8');

    // Trace: inputs
    await trace('llm', `llm_inputs_${promptType}`, 'computation', {
      promptType,
      date,
      contextFile: contextPath,
      promptFile: promptPath,
      contextSizeBytes: context.length,
      promptSizeBytes: systemPrompt.length,
    });

    // Call OpenAI
    console.log(`[llm-review] Sending to ${MODEL}...`);
    const { content, response } = await callOpenAI(systemPrompt, context, promptType);

    console.log(`[llm-review] Got response: ${content.length} chars, ${response.usage.total_tokens} tokens`);

    // Write output
    const outDir = resolve(ROOT, 'outputs', 'review');
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `review-${promptType}-${date}.md`);
    writeFileSync(outPath, content);

    console.log(`[llm-review] Written to ${outPath}`);
    console.log('---');
    console.log(content);
  });

  await closeDb();
}

main().catch((err) => {
  console.error('llm-review failed:', err);
  process.exit(1);
});
