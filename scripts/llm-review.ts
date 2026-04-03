/**
 * LLM Review Script
 *
 * Reads the weekly context bundle and a prompt template, sends to OpenAI,
 * and writes the review output.
 *
 * Usage:
 *   npx tsx scripts/llm-review.ts [--date YYYY-MM-DD] [--prompt regime|sector|portfolio]
 *
 * Authentication:
 *   Uses OpenAI via Codex CLI OAuth (preferred) or OPENAI_API_KEY env var.
 *   To use Codex OAuth: run `codex auth login` first — the script reads
 *   the cached token from ~/.codex/auth.json.
 *   Fallback: set OPENAI_API_KEY environment variable.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(import.meta.dirname, '..');

// ─── Auth ──────────────────────────────────────────────────────────

function getOpenAIAuth(): { apiKey?: string; accessToken?: string } {
  // 1. Try Codex OAuth token
  const codexAuthPath = resolve(homedir(), '.codex', 'auth.json');
  if (existsSync(codexAuthPath)) {
    try {
      const auth = JSON.parse(readFileSync(codexAuthPath, 'utf-8'));
      if (auth.access_token) {
        return { accessToken: auth.access_token };
      }
      if (auth.token) {
        return { accessToken: auth.token };
      }
    } catch {
      // Fall through to API key
    }
  }

  // 2. Try OPENAI_API_KEY env var
  if (process.env.OPENAI_API_KEY) {
    return { apiKey: process.env.OPENAI_API_KEY };
  }

  throw new Error(
    'No OpenAI authentication found.\n' +
    'Either:\n' +
    '  1. Run `codex auth login` to authenticate via Codex OAuth\n' +
    '  2. Set OPENAI_API_KEY environment variable'
  );
}

// ─── OpenAI call ───────────────────────────────────────────────────

async function callOpenAI(systemPrompt: string, userContent: string): Promise<string> {
  const auth = getOpenAIAuth();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth.accessToken) {
    headers['Authorization'] = `Bearer ${auth.accessToken}`;
  } else if (auth.apiKey) {
    headers['Authorization'] = `Bearer ${auth.apiKey}`;
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content ?? '';
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

  console.log(`[llm-review] Running ${promptType} review for ${date}`);

  // Read context bundle
  const contextPath = resolve(ROOT, 'outputs', 'context', `context-${date}.md`);
  if (!existsSync(contextPath)) {
    console.error(`Context file not found: ${contextPath}`);
    console.error('Run the weekly pipeline first to generate the context bundle.');
    process.exit(1);
  }
  const context = readFileSync(contextPath, 'utf-8');

  // Read prompt template
  const promptPath = resolve(ROOT, 'prompts', PROMPT_FILE_MAP[promptType]);
  if (!existsSync(promptPath)) {
    console.error(`Prompt file not found: ${promptPath}`);
    process.exit(1);
  }
  const systemPrompt = readFileSync(promptPath, 'utf-8');

  // Call OpenAI
  console.log('[llm-review] Sending to OpenAI...');
  const review = await callOpenAI(systemPrompt, context);

  // Write output
  const outDir = resolve(ROOT, 'outputs', 'review');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `review-${promptType}-${date}.md`);
  writeFileSync(outPath, review);

  console.log(`[llm-review] Written to ${outPath}`);
  console.log('---');
  console.log(review);
}

main().catch((err) => {
  console.error('llm-review failed:', err);
  process.exit(1);
});
