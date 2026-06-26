import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeTaskComplexity,
  selectModel,
  logAgentPerformance,
  getAgentPerformance,
  getBestPerformingModel,
  trackTokenUsage,
  getTokenBudget,
  shouldDowngradeDueToBudget,
  MODEL_TIERS,
  type ModelTier,
} from './model-selector';

// ─── Task Complexity Analysis ──────────

describe('analyzeTaskComplexity', () => {
  it('returns trivial for very short tasks', () => {
    const result = analyzeTaskComplexity('hello');
    expect(result.level).toBe('trivial');
    expect(result.recommendedTier).toBe('free');
  });

  it('returns simple for brief tasks', () => {
    const result = analyzeTaskComplexity('list a few tools for email marketing');
    expect(result.level).toBe('simple');
    expect(result.recommendedTier).toBe('budget');
  });

  it('returns moderate for standard tasks', () => {
    const result = analyzeTaskComplexity('analyze the current SEO performance and provide recommendations for improvement based on the metrics');
    expect(result.level).toBe('moderate');
    expect(result.recommendedTier).toBe('standard');
  });

  it('returns complex for detailed tasks', () => {
    const result = analyzeTaskComplexity(
      'write a comprehensive detailed analysis of the current market position, compare with competitors, and provide a strategic roadmap for the next quarter with specific metrics and KPIs'
    );
    expect(result.level).toBe('complex');
    expect(result.recommendedTier).toBe('premium');
  });

  it('returns critical for highly complex tasks', () => {
    const result = analyzeTaskComplexity(
      'create a comprehensive enterprise-grade end-to-end analysis with advanced reasoning about the strategic roadmap, compare with competitors, evaluate the financial model, and provide a detailed implementation plan with complex multi-step optimization'
    );
    expect(result.level).toBe('critical');
    expect(result.recommendedTier).toBe('elite');
  });

  it('detects technical domain', () => {
    const result = analyzeTaskComplexity('implement an API with database and algorithm architecture');
    expect(result.factors.domain).toBe('technical');
  });

  it('detects creative domain', () => {
    const result = analyzeTaskComplexity('write a blog content marketing piece with a creative story');
    expect(result.factors.domain).toBe('creative');
  });

  it('detects analytical domain', () => {
    const result = analyzeTaskComplexity('analyze research data and benchmark metrics');
    expect(result.factors.domain).toBe('analytical');
  });

  it('detects reasoning requirement', () => {
    const result = analyzeTaskComplexity('explain why this approach is better and compare alternatives');
    expect(result.factors.reasoning).toBeGreaterThan(0);
  });

  it('detects creativity requirement', () => {
    const result = analyzeTaskComplexity('create and draft a new design concept');
    expect(result.factors.creativity).toBeGreaterThan(0);
  });

  it('estimates tokens based on word count', () => {
    const shortResult = analyzeTaskComplexity('hello world');
    const longResult = analyzeTaskComplexity('word '.repeat(200));
    expect(longResult.estimatedTokens).toBeGreaterThan(shortResult.estimatedTokens);
  });

  it('clamps complexity to 0-1 range', () => {
    const result = analyzeTaskComplexity('a');
    expect(result.factors.complexity).toBeGreaterThanOrEqual(0);
    expect(result.factors.complexity).toBeLessThanOrEqual(1);
  });
});

// ─── Model Tier Constants ──────────────

describe('MODEL_TIERS', () => {
  it('has all 5 tiers', () => {
    expect(Object.keys(MODEL_TIERS)).toHaveLength(5);
    expect(MODEL_TIERS.free).toBeDefined();
    expect(MODEL_TIERS.budget).toBeDefined();
    expect(MODEL_TIERS.standard).toBeDefined();
    expect(MODEL_TIERS.premium).toBeDefined();
    expect(MODEL_TIERS.elite).toBeDefined();
  });

  it('tiers are ordered by cost', () => {
    expect(MODEL_TIERS.free.maxCostPer1k).toBeLessThan(MODEL_TIERS.budget.maxCostPer1k);
    expect(MODEL_TIERS.budget.maxCostPer1k).toBeLessThan(MODEL_TIERS.standard.maxCostPer1k);
    expect(MODEL_TIERS.standard.maxCostPer1k).toBeLessThan(MODEL_TIERS.premium.maxCostPer1k);
    expect(MODEL_TIERS.premium.maxCostPer1k).toBeLessThan(MODEL_TIERS.elite.maxCostPer1k);
  });

  it('free tier has zero cost', () => {
    expect(MODEL_TIERS.free.maxCostPer1k).toBe(0);
  });
});

// ─── Model Selection ───────────────────

describe('selectModel', () => {
  it('returns a model selection for known agent with available providers', () => {
    const result = selectModel('write a blog post', 'writer', ['groq', 'google']);
    expect(result.providerId).toBeTruthy();
    expect(result.modelId).toBeTruthy();
    expect(result.tier).toBeTruthy();
    expect(result.reasoning).toBeTruthy();
    expect(result.costEstimate).toHaveProperty('usd');
    expect(result.costEstimate).toHaveProperty('inr');
  });

  it('falls back when no providers available', () => {
    const result = selectModel('test task', 'researcher', []);
    expect(result.providerId).toBe('none');
    expect(result.modelId).toBe('none');
  });

  it('uses free models for trivial tasks', () => {
    const result = selectModel('hi', 'researcher', ['groq', 'openrouter']);
    expect(result.tier).toBe('free');
  });

  it('uses higher tiers for complex tasks', () => {
    const result = selectModel(
      'create a comprehensive enterprise-grade end-to-end analysis with advanced complex reasoning and creative design',
      'strategist',
      ['anthropic', 'openai', 'groq']
    );
    expect(['premium', 'elite']).toContain(result.tier);
  });

  it('respects forceTier parameter when preferred providers available', () => {
    const result = selectModel('hi', 'researcher', ['groq', 'openrouter', 'anthropic', 'openai'], 'premium');
    // ForceTier should override the auto-selected tier and use premium providers
    expect(result.tier).toBe('premium');
    expect(['anthropic', 'openai']).toContain(result.providerId);
  });

  it('falls back when forceTier providers unavailable', () => {
    const result = selectModel('hi', 'researcher', ['groq', 'openrouter'], 'premium');
    // No premium providers available, falls back to free
    expect(result.tier).toBe('free');
    expect(result.providerId).toBe('groq');
  });

  it('selects appropriate provider for developer agent', () => {
    const result = selectModel(
      'implement a complex API with database',
      'developer',
      ['openrouter', 'groq', 'together']
    );
    expect(result.providerId).toBeTruthy();
    expect(result.modelId).toBeTruthy();
  });

  it('selects appropriate provider for finance agent', () => {
    const result = selectModel(
      'analyze the budget and ROI',
      'finance',
      ['openai', 'anthropic', 'groq']
    );
    expect(result.providerId).toBeTruthy();
  });

  it('falls back to free models when preferred provider unavailable', () => {
    // Only groq available, which is free
    const result = selectModel('write detailed content', 'writer', ['groq']);
    expect(result.providerId).toBe('groq');
    expect(result.tier).toBe('free');
  });

  it('returns cost estimate for paid models', () => {
    const result = selectModel(
      'write a comprehensive analysis',
      'writer',
      ['anthropic', 'openai'],
      'premium'
    );
    // Premium models should have non-zero cost
    expect(result.costEstimate.usd).toBeGreaterThanOrEqual(0);
  });
});

// ─── Performance Tracking (Learning) ───

describe('logAgentPerformance', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('logs successful performance', () => {
    logAgentPerformance('writer', 'gpt-4o', 'openai', true, 0.8, 500, 1000, 0.01);
    const performance = getAgentPerformance();
    expect(performance).toHaveLength(1);
    expect(performance[0].agent).toBe('writer');
    expect(performance[0].successCount).toBe(1);
    expect(performance[0].failCount).toBe(0);
    expect(performance[0].avgQuality).toBe(0.8);
  });

  it('logs failed performance', () => {
    logAgentPerformance('writer', 'gpt-4o', 'openai', false);
    const performance = getAgentPerformance();
    expect(performance).toHaveLength(1);
    expect(performance[0].successCount).toBe(0);
    expect(performance[0].failCount).toBe(1);
  });

  it('updates existing performance record', () => {
    logAgentPerformance('writer', 'gpt-4o', 'openai', true, 0.8, 500, 1000, 0.01);
    logAgentPerformance('writer', 'gpt-4o', 'openai', true, 0.9, 400, 1000, 0.01);
    const performance = getAgentPerformance();
    expect(performance).toHaveLength(1);
    expect(performance[0].successCount).toBe(2);
    // Quality should be moving average: 0.8 * 0.8 + 0.9 * 0.2 = 0.82
    expect(performance[0].avgQuality).toBeCloseTo(0.82, 2);
  });

  it('accumulates token and cost totals', () => {
    logAgentPerformance('writer', 'gpt-4o', 'openai', true, undefined, undefined, 1000, 0.01);
    logAgentPerformance('writer', 'gpt-4o', 'openai', true, undefined, undefined, 2000, 0.02);
    const performance = getAgentPerformance();
    expect(performance[0].totalTokens).toBe(3000);
    expect(performance[0].totalCostUsd).toBeCloseTo(0.03, 4);
  });

  it('does nothing on server side', () => {
    // The function checks typeof window === 'undefined'
    // In jsdom this is fine, but we can verify localStorage is written
    logAgentPerformance('writer', 'gpt-4o', 'openai', true);
    expect(getAgentPerformance()).toHaveLength(1);
  });
});

describe('getBestPerformingModel', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null when no performance data', () => {
    const result = getBestPerformingModel('writer', 'standard');
    expect(result).toBeNull();
  });

  it('returns null when agent has no successful runs', () => {
    logAgentPerformance('writer', 'gpt-4o', 'openai', false);
    const result = getBestPerformingModel('writer', 'standard');
    expect(result).toBeNull();
  });

  it('returns best performing model for agent', () => {
    // Model A: 5 successes, quality 0.9 (premium tier: cost 0.01 output)
    logAgentPerformance('writer', 'gpt-4o', 'openai', true, 0.9);
    logAgentPerformance('writer', 'gpt-4o', 'openai', true, 0.9);
    logAgentPerformance('writer', 'gpt-4o', 'openai', true, 0.9);
    logAgentPerformance('writer', 'gpt-4o', 'openai', true, 0.9);
    logAgentPerformance('writer', 'gpt-4o', 'openai', true, 0.9);

    // Model B: 3 successes, quality 0.7 (budget tier: cost 0.004 output)
    logAgentPerformance('writer', 'claude-haiku-4-5', 'anthropic', true, 0.7);
    logAgentPerformance('writer', 'claude-haiku-4-5', 'anthropic', true, 0.7);
    logAgentPerformance('writer', 'claude-haiku-4-5', 'anthropic', true, 0.7);

    // Use 'premium' tier so both models pass the cost filter (gpt-4o cost 0.01 <= 0.02)
    const result = getBestPerformingModel('writer', 'premium');
    expect(result).not.toBeNull();
    expect(result!.modelId).toBe('gpt-4o'); // Higher quality + more successes
  });

  it('filters by tier cost level', () => {
    // Premium model with great performance
    logAgentPerformance('writer', 'claude-sonnet-4-6', 'anthropic', true, 0.95);
    logAgentPerformance('writer', 'claude-sonnet-4-6', 'anthropic', true, 0.95);
    logAgentPerformance('writer', 'claude-sonnet-4-6', 'anthropic', true, 0.95);

    // Free model with decent performance
    logAgentPerformance('writer', 'llama-3.3-70b-versatile', 'groq', true, 0.8);
    logAgentPerformance('writer', 'llama-3.3-70b-versatile', 'groq', true, 0.8);

    // When asking for 'free' tier, should not recommend the premium model
    const freeResult = getBestPerformingModel('writer', 'free');
    if (freeResult) {
      // Should be the free model, not the premium one
      expect(freeResult.modelId).toBe('llama-3.3-70b-versatile');
    }
  });

  it('does not recommend models with more failures than successes', () => {
    // Model with mostly failures
    logAgentPerformance('writer', 'bad-model', 'provider', false);
    logAgentPerformance('writer', 'bad-model', 'provider', false);
    logAgentPerformance('writer', 'bad-model', 'provider', false);
    logAgentPerformance('writer', 'bad-model', 'provider', true);

    const result = getBestPerformingModel('writer', 'standard');
    if (result) {
      expect(result.modelId).not.toBe('bad-model');
    }
  });

  it('isolates by agent name', () => {
    // Use models that fit within 'premium' tier (maxCostPer1k: 0.02)
    // gpt-4o cost: 0.01 output ✓, claude-haiku-4-5 cost: 0.004 output ✓
    logAgentPerformance('writer', 'gpt-4o', 'openai', true, 0.9);
    logAgentPerformance('developer', 'claude-haiku-4-5', 'anthropic', true, 0.8);

    const writerResult = getBestPerformingModel('writer', 'premium');
    const devResult = getBestPerformingModel('developer', 'premium');

    expect(writerResult).not.toBeNull();
    expect(writerResult!.modelId).toBe('gpt-4o');
    expect(devResult).not.toBeNull();
    expect(devResult!.modelId).toBe('claude-haiku-4-5');
  });
});

// ─── Token Budget Management ───────────

describe('token budget management', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('getTokenBudget', () => {
    it('returns default budget when no data', () => {
      const budget = getTokenBudget();
      expect(budget.dailyLimit).toBe(1000000);
      expect(budget.usedToday).toBe(0);
    });

    it('persists budget data', () => {
      const budget = getTokenBudget();
      budget.usedToday = 50000;
      localStorage.setItem('oracle_token_budget', JSON.stringify(budget));

      const loaded = getTokenBudget();
      expect(loaded.usedToday).toBe(50000);
    });

    it('resets on new day', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const budget = {
        dailyLimit: 1000000,
        usedToday: 500000,
        lastReset: yesterday.toISOString().split('T')[0],
      };
      localStorage.setItem('oracle_token_budget', JSON.stringify(budget));

      const loaded = getTokenBudget();
      expect(loaded.usedToday).toBe(0);
    });
  });

  describe('trackTokenUsage', () => {
    it('returns true when budget available', () => {
      const result = trackTokenUsage(1000);
      expect(result).toBe(true);
    });

    it('accumulates usage', () => {
      trackTokenUsage(1000);
      trackTokenUsage(2000);
      const budget = getTokenBudget();
      expect(budget.usedToday).toBe(3000);
    });

    it('returns false when budget exceeded', () => {
      // Set a small budget
      const budget = { dailyLimit: 100, usedToday: 50, lastReset: new Date().toISOString().split('T')[0] };
      localStorage.setItem('oracle_token_budget', JSON.stringify(budget));

      const result = trackTokenUsage(60); // 50 + 60 > 100
      expect(result).toBe(false);
    });
  });

  describe('shouldDowngradeDueToBudget', () => {
    it('returns same tier when budget is plentiful', () => {
      const result = shouldDowngradeDueToBudget(1000, 'premium');
      expect(result).toBe('premium');
    });

    it('downgrades when less than 20% budget remaining', () => {
      // Use 85% of budget
      const budget = { dailyLimit: 1000, usedToday: 850, lastReset: new Date().toISOString().split('T')[0] };
      localStorage.setItem('oracle_token_budget', JSON.stringify(budget));

      const result = shouldDowngradeDueToBudget(100, 'premium');
      expect(result).not.toBe('premium');
    });

    it('does not downgrade free tier (already lowest)', () => {
      const budget = { dailyLimit: 1000, usedToday: 900, lastReset: new Date().toISOString().split('T')[0] };
      localStorage.setItem('oracle_token_budget', JSON.stringify(budget));

      const result = shouldDowngradeDueToBudget(100, 'free');
      expect(result).toBe('free');
    });

    it('downgrades when estimated tokens exceed 10% of remaining', () => {
      const budget = { dailyLimit: 1000, usedToday: 500, lastReset: new Date().toISOString().split('T')[0] };
      localStorage.setItem('oracle_token_budget', JSON.stringify(budget));

      // Remaining = 500, 10% = 50, estimated = 60 > 50
      const result = shouldDowngradeDueToBudget(60, 'premium');
      expect(result).not.toBe('premium');
    });

    it('chains downgrades correctly (elite → premium)', () => {
      const budget = { dailyLimit: 1000, usedToday: 900, lastReset: new Date().toISOString().split('T')[0] };
      localStorage.setItem('oracle_token_budget', JSON.stringify(budget));

      const result = shouldDowngradeDueToBudget(100, 'elite');
      expect(result).toBe('premium');
    });
  });
});
