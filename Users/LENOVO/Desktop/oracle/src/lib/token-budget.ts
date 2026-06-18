// ═══════════════════════════════════════
// ORACLE — Token Budget Tracker
// Estimate system prompt cost per request across all providers
// ═══════════════════════════════════════

import { PROVIDERS } from '@/data/providers';
import { AI_OPERATING_SYSTEM, ORACLE_SYSTEM } from '@/lib/system-prompt';
import { estimateTokens } from '@/lib/utils';

// ─── Prompt Sizes ──────────────────────

export interface PromptSize {
  name: string;
  chars: number;
  tokens: number;
}

/** Get the size of each system prompt constant */
export function getPromptSizes(): PromptSize[] {
  return [
    {
      name: 'AI_OPERATING_SYSTEM',
      chars: AI_OPERATING_SYSTEM.length,
      tokens: estimateTokens(AI_OPERATING_SYSTEM),
    },
    {
      name: 'ORACLE_SYSTEM (combined)',
      chars: ORACLE_SYSTEM.length,
      tokens: estimateTokens(ORACLE_SYSTEM),
    },
  ];
}

// ─── Cost Calculation ──────────────────

export interface ModelCost {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  isFree: boolean;
  contextWindow: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  /** Cost in USD for this system prompt + assumed 500 token user message */
  systemPromptCostUSD: number;
  /** Cost in INR for this system prompt + assumed 500 token user message */
  systemPromptCostINR: number;
  /** Cost in USD for a full request (system prompt + 500 user tokens + 1000 output tokens) */
  fullRequestCostUSD: number;
  /** Cost in INR for a full request */
  fullRequestCostINR: number;
}

const USD_TO_INR = 84;

/**
 * Calculate cost per request for every model across all 10 providers.
 * Assumes:
 *   - System prompt: ORACLE_SYSTEM (the combined prompt)
 *   - User message: 500 tokens (average)
 *   - Output: 1000 tokens (average response)
 */
export function calculateAllCosts(): ModelCost[] {
  const systemPromptTokens = estimateTokens(ORACLE_SYSTEM);
  const avgUserTokens = 500;
  const avgOutputTokens = 1000;
  const totalInputTokens = systemPromptTokens + avgUserTokens;

  const results: ModelCost[] = [];

  for (const provider of PROVIDERS) {
    for (const model of provider.models) {
      const inputCost = model.costPer1k?.input ?? 0;
      const outputCost = model.costPer1k?.output ?? 0;

      const systemPromptCostUSD = (systemPromptTokens / 1000) * inputCost;
      const fullRequestCostUSD =
        (totalInputTokens / 1000) * inputCost +
        (avgOutputTokens / 1000) * outputCost;

      results.push({
        providerId: provider.id,
        providerName: provider.name,
        modelId: model.id,
        modelName: model.name,
        isFree: model.isFree,
        contextWindow: model.contextWindow,
        inputCostPer1k: inputCost,
        outputCostPer1k: outputCost,
        systemPromptCostUSD: Math.round(systemPromptCostUSD * 10000) / 10000,
        systemPromptCostINR: Math.round(systemPromptCostUSD * USD_TO_INR * 100) / 100,
        fullRequestCostUSD: Math.round(fullRequestCostUSD * 10000) / 10000,
        fullRequestCostINR: Math.round(fullRequestCostUSD * USD_TO_INR * 100) / 100,
      });
    }
  }

  return results;
}

// ─── Budget Summary ────────────────────

export interface BudgetSummary {
  systemPromptTokens: number;
  cheapestFree: ModelCost | null;
  cheapestPaid: ModelCost | null;
  mostExpensive: ModelCost | null;
  /** Cost at 100, 1000, 10000 requests per month for the cheapest paid model */
  monthlyEstimates: {
    requests: number;
    costUSD: number;
    costINR: number;
  }[];
}

/** Get a budget summary with cheapest/most expensive options and monthly projections */
export function getBudgetSummary(): BudgetSummary {
  const costs = calculateAllCosts();
  const systemPromptTokens = estimateTokens(ORACLE_SYSTEM);

  const freeModels = costs.filter((c) => c.isFree);
  const paidModels = costs.filter((c) => !c.isFree);

  const cheapestFree = freeModels.length > 0
    ? freeModels.reduce((a, b) => (a.fullRequestCostUSD <= b.fullRequestCostUSD ? a : b))
    : null;

  const cheapestPaid = paidModels.length > 0
    ? paidModels.reduce((a, b) => (a.fullRequestCostUSD <= b.fullRequestCostUSD ? a : b))
    : null;

  const mostExpensive = costs.length > 0
    ? costs.reduce((a, b) => (a.fullRequestCostUSD >= b.fullRequestCostUSD ? a : b))
    : null;

  const monthlyEstimates = [100, 1000, 10000].map((requests) => {
    const costPerRequest = cheapestPaid?.fullRequestCostUSD ?? 0;
    const costUSD = Math.round(costPerRequest * requests * 10000) / 10000;
    return {
      requests,
      costUSD,
      costINR: Math.round(costUSD * USD_TO_INR * 100) / 100,
    };
  });

  return {
    systemPromptTokens,
    cheapestFree,
    cheapestPaid,
    mostExpensive,
    monthlyEstimates,
  };
}

// ─── Pretty Print ──────────────────────

/** Format cost as a readable string */
export function formatCost(usd: number, inr: number): string {
  if (usd === 0) return 'FREE';
  if (usd < 0.0001) return `<$0.0001 (₹${inr.toFixed(4)})`;
  return `$${usd.toFixed(4)} (₹${inr.toFixed(2)})`;
}

/** Print a budget report to console (useful for debugging) */
export function printBudgetReport(): void {
  const sizes = getPromptSizes();
  const summary = getBudgetSummary();

  console.log('\n═══════════════════════════════════════');
  console.log('  ORACLE — Token Budget Report');
  console.log('═══════════════════════════════════════\n');

  console.log('System Prompt Sizes:');
  for (const s of sizes) {
    console.log(`  ${s.name}: ${s.tokens.toLocaleString()} tokens (${s.chars.toLocaleString()} chars)`);
  }

  console.log(`\nAssumptions: ${summary.systemPromptTokens} system tokens + 500 user tokens + 1000 output tokens\n`);

  console.log('Cost per Request (all models):');
  console.log('─'.repeat(90));
  console.log(
    'Provider'.padEnd(14) +
    'Model'.padEnd(32) +
    'Input/1k'.padEnd(12) +
    'Output/1k'.padEnd(12) +
    'Full Request'.padEnd(20) +
    'Free?'
  );
  console.log('─'.repeat(90));

  const costs = calculateAllCosts();
  for (const c of costs) {
    console.log(
      c.providerName.padEnd(14) +
      c.modelName.substring(0, 30).padEnd(32) +
      formatCost(c.inputCostPer1k / 1000 * 1000, 0).padEnd(12) +
      formatCost(c.outputCostPer1k / 1000 * 1000, 0).padEnd(12) +
      formatCost(c.fullRequestCostUSD, c.fullRequestCostINR).padEnd(20) +
      (c.isFree ? '✅' : '')
    );
  }

  console.log('\nBudget Summary:');
  console.log('─'.repeat(90));
  if (summary.cheapestFree) {
    console.log(`  Cheapest FREE: ${summary.cheapestFree.providerName} / ${summary.cheapestFree.modelName}`);
  }
  if (summary.cheapestPaid) {
    console.log(`  Cheapest PAID: ${summary.cheapestPaid.providerName} / ${summary.cheapestPaid.modelName}`);
  }
  if (summary.mostExpensive) {
    console.log(`  Most Expensive: ${summary.mostExpensive.providerName} / ${summary.mostExpensive.modelName}`);
  }

  console.log('\nMonthly Estimates (cheapest paid model):');
  for (const e of summary.monthlyEstimates) {
    console.log(`  ${e.requests.toLocaleString().padStart(6)} requests/mo → $${e.costUSD.toFixed(2)} USD (₹${e.costINR.toFixed(0)})`);
  }

  console.log('\n═══════════════════════════════════════\n');
}
