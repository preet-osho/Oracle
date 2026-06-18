// ═══════════════════════════════════════
// ORACLE — Shared AI Provider Constants
// Used by both client-side router and server-side proxy
// ═══════════════════════════════════════

// ─── Pricing Data (USD per 1K tokens) ──

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'openai/gpt-4o': { input: 0.0025, output: 0.01 },
  'openai/gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'openai/o3-mini': { input: 0.0011, output: 0.0044 },
  'anthropic/claude-opus-4-7': { input: 0.015, output: 0.075 },
  'anthropic/claude-sonnet-4-6': { input: 0.003, output: 0.015 },
  'anthropic/claude-haiku-4-5': { input: 0.0008, output: 0.004 },
  'groq/llama-3.3-70b-versatile': { input: 0, output: 0 },
  'groq/llama3-8b-8192': { input: 0, output: 0 },
  'groq/mixtral-8x7b': { input: 0, output: 0 },
  'google/gemini-2.0-flash': { input: 0.000075, output: 0.0003 },
  'google/gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'google/gemini-2.0-flash-thinking': { input: 0.000075, output: 0.0003 },
  'openrouter/deepseek/deepseek-r1': { input: 0, output: 0 },
  'openrouter/meta-llama/llama-3.3-70b-instruct:free': { input: 0, output: 0 },
  'openrouter/anthropic/claude-sonnet-4': { input: 0.003, output: 0.015 },
  'openrouter/openai/gpt-4o': { input: 0.0025, output: 0.01 },
  'together/meta-llama/Llama-3.3-70B-Turbo-Free': { input: 0, output: 0 },
  'together/meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo': { input: 0.0035, output: 0.0035 },
  'together/deepseek-ai/DeepSeek-R1': { input: 0.00055, output: 0.00219 },
  'cerebras/llama-3.3-70b': { input: 0, output: 0 },
  'cerebras/llama-3.1-8b': { input: 0, output: 0 },
  'mistral/mistral-large-latest': { input: 0.002, output: 0.006 },
  'mistral/mistral-small-latest': { input: 0.0001, output: 0.0003 },
  'mistral/open-mixtral-8x22b': { input: 0, output: 0 },
  'cohere/command-r-plus': { input: 0.0015, output: 0.002 },
  'cohere/command-r': { input: 0.00015, output: 0.0002 },
  'cohere/command-light': { input: 0, output: 0 },
  'perplexity/llama-3.1-sonar-large-128k-online': { input: 0.001, output: 0.001 },
  'perplexity/llama-3.1-sonar-small-32k-online': { input: 0.0002, output: 0.0002 },
  'perplexity/llama-3.1-sonar-large-128k-chat': { input: 0.001, output: 0.001 },
};

// ─── Provider Failover Order ───────────

export const FAILOVER_ORDER = ['groq', 'google', 'cerebras', 'openrouter', 'together', 'mistral', 'cohere', 'anthropic', 'openai', 'perplexity'];

// ─── Conversion Rate ───────────────────

export const USD_TO_INR = 84;

// ─── Calculate Cost ────────────────────

export function calculateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): { usd: number; inr: number } {
  const key = `${provider}/${model}`;
  const pricing = MODEL_PRICING[key];

  if (!pricing) {
    return { usd: 0, inr: 0 };
  }

  const usd = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
  return {
    usd: Math.round(usd * 10000) / 10000,
    inr: Math.round(usd * USD_TO_INR * 100) / 100,
  };
}
