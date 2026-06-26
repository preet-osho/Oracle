// ═══════════════════════════════════════
// ORACLE — Intelligent Model Selector
// Task Complexity · Model Tiers · Cost Optimization · Learning
// ═══════════════════════════════════════

import { PROVIDERS } from '@/data/providers';

// ─── Model Tiers (Free → Elite) ────────

export type ModelTier = 'free' | 'budget' | 'standard' | 'premium' | 'elite';

export interface TierConfig {
  tier: ModelTier;
  maxCostPer1k: number;  // Max cost per 1K tokens (output)
  description: string;
  useCases: string[];
}

export const MODEL_TIERS: Record<ModelTier, TierConfig> = {
  free: {
    tier: 'free',
    maxCostPer1k: 0,
    description: 'Free models - no cost, good for simple tasks',
    useCases: ['classification', 'extraction', 'simple Q&A', 'draft generation'],
  },
  budget: {
    tier: 'budget',
    maxCostPer1k: 0.001,
    description: 'Budget models - minimal cost, decent quality',
    useCases: ['general tasks', 'summarization', 'translation', 'basic writing'],
  },
  standard: {
    tier: 'standard',
    maxCostPer1k: 0.005,
    description: 'Standard models - good balance of cost and quality',
    useCases: ['content creation', 'code generation', 'analysis', 'research'],
  },
  premium: {
    tier: 'premium',
    maxCostPer1k: 0.02,
    description: 'Premium models - high quality, higher cost',
    useCases: ['complex reasoning', 'long-form writing', 'strategic planning', 'client deliverables'],
  },
  elite: {
    tier: 'elite',
    maxCostPer1k: 0.1,
    description: 'Elite models - maximum quality, highest cost',
    useCases: ['critical tasks', 'complex multi-step reasoning', 'high-stakes decisions'],
  },
};

// ─── Task Complexity Analysis ──────────

export interface TaskComplexity {
  level: 'trivial' | 'simple' | 'moderate' | 'complex' | 'critical';
  factors: {
    length: number;        // Input length factor
    complexity: number;    // Linguistic complexity
    domain: string;        // Domain specificity
    reasoning: number;     // Reasoning requirement
    creativity: number;    // Creativity requirement
  };
  recommendedTier: ModelTier;
  estimatedTokens: number;
}

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  technical: ['code', 'api', 'database', 'algorithm', 'architecture', 'debug', 'implement'],
  creative: ['write', 'create', 'design', 'story', 'blog', 'content', 'marketing'],
  analytical: ['analyze', 'research', 'data', 'metrics', 'benchmark', 'compare'],
  strategic: ['strategy', 'plan', 'roadmap', 'vision', 'goals', 'objectives'],
  financial: ['budget', 'pricing', 'roi', 'revenue', 'profit', 'cost', 'finance'],
  legal: ['contract', 'agreement', 'terms', 'compliance', 'regulation', 'legal'],
};

const REASONING_KEYWORDS = [
  'explain', 'why', 'how', 'reason', 'logic', 'because', 'therefore',
  'analyze', 'evaluate', 'compare', 'contrast', 'assess', 'determine',
];

const CREATIVITY_KEYWORDS = [
  'create', 'write', 'design', 'imagine', 'innovate', 'brainstorm',
  'generate', 'draft', 'compose', 'craft', 'develop concept',
];

export function analyzeTaskComplexity(task: string): TaskComplexity {
  const lowerTask = task.toLowerCase();
  const words = lowerTask.split(/\s+/);
  const wordCount = words.length;

  // Length factor (0-1)
  const lengthFactor = Math.min(wordCount / 500, 1);

  // Domain detection
  let detectedDomain = 'general';
  let maxDomainScore = 0;
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const score = keywords.filter(k => lowerTask.includes(k)).length;
    if (score > maxDomainScore) {
      maxDomainScore = score;
      detectedDomain = domain;
    }
  }

  // Reasoning requirement (0-1)
  const reasoningScore = REASONING_KEYWORDS.filter(k => lowerTask.includes(k)).length;
  const reasoningFactor = Math.min(reasoningScore / 3, 1);

  // Creativity requirement (0-1)
  const creativityScore = CREATIVITY_KEYWORDS.filter(k => lowerTask.includes(k)).length;
  const creativityFactor = Math.min(creativityScore / 3, 1);

  // Overall complexity score (0-1)
  const complexityScore = (
    lengthFactor * 0.2 +
    maxDomainScore * 0.15 +
    reasoningFactor * 0.35 +
    creativityFactor * 0.3
  );

  // Determine complexity level and tier
  let level: TaskComplexity['level'];
  let recommendedTier: ModelTier;

  if (complexityScore < 0.15) {
    level = 'trivial';
    recommendedTier = 'free';
  } else if (complexityScore < 0.3) {
    level = 'simple';
    recommendedTier = 'budget';
  } else if (complexityScore < 0.5) {
    level = 'moderate';
    recommendedTier = 'standard';
  } else if (complexityScore < 0.75) {
    level = 'complex';
    recommendedTier = 'premium';
  } else {
    level = 'critical';
    recommendedTier = 'elite';
  }

  // Estimate tokens needed (rough: 1.5x input + output buffer)
  const estimatedTokens = Math.ceil(wordCount * 1.5 * 1.3); // words → tokens × buffer

  return {
    level,
    factors: {
      length: lengthFactor,
      complexity: complexityScore,
      domain: detectedDomain,
      reasoning: reasoningFactor,
      creativity: creativityFactor,
    },
    recommendedTier,
    estimatedTokens,
  };
}

// ─── Agent-Specific Model Preferences ──

export interface AgentModelPreference {
  agent: string;
  tierPreferences: {
    tier: ModelTier;
    preferredProviders: string[];  // Provider IDs in priority order
    preferredModels: string[];     // Model IDs (backup if providers unavailable)
  }[];
}

export const AGENT_MODEL_PREFERENCES: AgentModelPreference[] = [
  {
    agent: 'researcher',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'together'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['openai', 'anthropic'], preferredModels: ['gpt-4o-mini', 'claude-haiku-4-5'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'writer',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'mistral'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5', 'gpt-4o-mini'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6', 'gpt-4o'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'developer',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['openrouter', 'groq'], preferredModels: ['deepseek/deepseek-r1'] },
      { tier: 'budget', preferredProviders: ['together', 'mistral'], preferredModels: ['deepseek-ai/DeepSeek-R1'] },
      { tier: 'standard', preferredProviders: ['openai', 'anthropic'], preferredModels: ['o3-mini', 'claude-haiku-4-5'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6', 'gpt-4o'] },
      { tier: 'elite', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'analyst',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'together'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['openai', 'anthropic'], preferredModels: ['gpt-4o-mini'] },
      { tier: 'premium', preferredProviders: ['openai', 'anthropic'], preferredModels: ['gpt-4o', 'claude-sonnet-4-6'] },
      { tier: 'elite', preferredProviders: ['openai', 'anthropic'], preferredModels: ['gpt-4o', 'claude-opus-4-7'] },
    ],
  },
  {
    agent: 'strategist',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'mistral'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5', 'gpt-4o-mini'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6', 'gpt-4o'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'marketer',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'together'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6', 'gpt-4o'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'designer',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'together'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5', 'gpt-4o-mini'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'finance',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'mistral'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['openai', 'anthropic'], preferredModels: ['gpt-4o-mini'] },
      { tier: 'premium', preferredProviders: ['openai', 'anthropic'], preferredModels: ['gpt-4o', 'claude-sonnet-4-6'] },
      { tier: 'elite', preferredProviders: ['openai'], preferredModels: ['gpt-4o'] },
    ],
  },
  {
    agent: 'voice',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'cerebras'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['openai', 'anthropic'], preferredModels: ['gpt-4o-mini', 'claude-haiku-4-5'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'qa',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['openrouter', 'groq'], preferredModels: ['deepseek/deepseek-r1'] },
      { tier: 'budget', preferredProviders: ['together', 'mistral'], preferredModels: ['deepseek-ai/DeepSeek-R1'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5', 'o3-mini'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6', 'gpt-4o'] },
      { tier: 'elite', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'coordinator',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'together'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'workflow',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'mistral'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5', 'gpt-4o-mini'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6', 'gpt-4o'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'legal',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'mistral'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5', 'gpt-4o-mini'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6', 'gpt-4o'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'security-auditor',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['openrouter', 'groq'], preferredModels: ['deepseek/deepseek-r1'] },
      { tier: 'budget', preferredProviders: ['together', 'mistral'], preferredModels: ['deepseek-ai/DeepSeek-R1'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5', 'o3-mini'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6', 'gpt-4o'] },
      { tier: 'elite', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'data-scientist',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'together'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['openai', 'anthropic'], preferredModels: ['gpt-4o-mini', 'claude-haiku-4-5'] },
      { tier: 'premium', preferredProviders: ['openai', 'anthropic'], preferredModels: ['gpt-4o', 'claude-sonnet-4-6'] },
      { tier: 'elite', preferredProviders: ['openai', 'anthropic'], preferredModels: ['gpt-4o', 'claude-opus-4-7'] },
    ],
  },
  {
    agent: 'competitor-intel',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'together'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6', 'gpt-4o'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'editor',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'mistral'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5', 'gpt-4o-mini'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'localization',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'together'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5', 'gpt-4o-mini'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  // ── Agency Operations agents ──
  {
    agent: 'agency-brain',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'mistral'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5', 'gpt-4o-mini'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6', 'gpt-4o'] },
      { tier: 'elite', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'lead-hunter',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'mistral'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5', 'gpt-4o-mini'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'offer-strategist',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'mistral'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5', 'gpt-4o-mini'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6', 'gpt-4o'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'video-specialist',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'together'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5', 'gpt-4o-mini'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'web-designer',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['groq', 'openrouter'], preferredModels: ['llama-3.3-70b-versatile'] },
      { tier: 'budget', preferredProviders: ['google', 'together'], preferredModels: ['gemini-2.0-flash'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5', 'gpt-4o-mini'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6', 'gpt-4o'] },
      { tier: 'elite', preferredProviders: ['anthropic'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
  {
    agent: 'agent-builder',
    tierPreferences: [
      { tier: 'free', preferredProviders: ['openrouter', 'groq'], preferredModels: ['deepseek/deepseek-r1'] },
      { tier: 'budget', preferredProviders: ['together', 'mistral'], preferredModels: ['deepseek-ai/DeepSeek-R1'] },
      { tier: 'standard', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-haiku-4-5', 'o3-mini'] },
      { tier: 'premium', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-sonnet-4-6', 'gpt-4o'] },
      { tier: 'elite', preferredProviders: ['anthropic', 'openai'], preferredModels: ['claude-opus-4-7'] },
    ],
  },
];

// ─── Model Selection Engine ────────────

export interface ModelSelection {
  providerId: string;
  modelId: string;
  tier: ModelTier;
  reasoning: string;
  costEstimate: { usd: number; inr: number };
}

export function selectModel(
  task: string,
  agentRole: string,
  availableProviders: string[],
  forceTier?: ModelTier
): ModelSelection {
  // 1. Analyze task complexity
  const complexity = analyzeTaskComplexity(task);
  const tier = forceTier || complexity.recommendedTier;

  // 2. Check learning data first — if this agent+model combo performed well before, prefer it
  const bestPerforming = getBestPerformingModel(agentRole, tier);
  if (bestPerforming && availableProviders.includes(bestPerforming.providerId)) {
    const provider = PROVIDERS.find(p => p.id === bestPerforming.providerId);
    const model = provider?.models.find(m => m.id === bestPerforming.modelId);
    if (model) {
      const cost = estimateCost(bestPerforming.providerId, bestPerforming.modelId, complexity.estimatedTokens);
      return {
        providerId: bestPerforming.providerId,
        modelId: bestPerforming.modelId,
        tier,
        reasoning: `Learning: ${agentRole} performed best with ${bestPerforming.providerId}/${bestPerforming.modelId}. Task complexity: ${complexity.level}.`,
        costEstimate: cost,
      };
    }
  }

  // 3. Get agent preferences
  const agentPrefs = AGENT_MODEL_PREFERENCES.find(p => p.agent === agentRole);
  if (!agentPrefs) {
    return selectFallbackModel(tier, availableProviders, complexity);
  }

  // 4. Find tier preferences
  const tierPrefs = agentPrefs.tierPreferences.find(p => p.tier === tier);
  if (!tierPrefs) {
    return selectFallbackModel(tier, availableProviders, complexity);
  }

  // 5. Find best available provider+model
  for (const providerId of tierPrefs.preferredProviders) {
    if (!availableProviders.includes(providerId)) continue;

    const provider = PROVIDERS.find(p => p.id === providerId);
    if (!provider) continue;

    // Try preferred models first
    for (const modelId of tierPrefs.preferredModels) {
      const model = provider.models.find(m => m.id === modelId);
      if (model) {
        const cost = estimateCost(providerId, modelId, complexity.estimatedTokens);
        return {
          providerId,
          modelId,
          tier,
          reasoning: `Task complexity: ${complexity.level} (${(complexity.factors.complexity * 100).toFixed(0)}%). Domain: ${complexity.factors.domain}. Using ${tier} tier for ${agentRole} agent.`,
          costEstimate: cost,
        };
      }
    }

    // Fallback to any model in tier
    const suitableModel = provider.models.find(m => {
      const cost = m.costPer1k?.output || 0;
      return cost <= MODEL_TIERS[tier].maxCostPer1k;
    });

    if (suitableModel) {
      const cost = estimateCost(providerId, suitableModel.id, complexity.estimatedTokens);
      return {
        providerId,
        modelId: suitableModel.id,
        tier,
        reasoning: `Task complexity: ${complexity.level}. Using ${tier} tier with ${providerId}/${suitableModel.id}.`,
        costEstimate: cost,
      };
    }
  }

  // 5. Fallback to any available free model
  return selectFallbackModel(tier, availableProviders, complexity);
}

function selectFallbackModel(
  tier: ModelTier,
  availableProviders: string[],
  complexity: TaskComplexity
): ModelSelection {
  // Try to find any free model first
  for (const providerId of availableProviders) {
    const provider = PROVIDERS.find(p => p.id === providerId);
    if (!provider) continue;

    const freeModel = provider.models.find(m => m.isFree);
    if (freeModel) {
      const cost = estimateCost(providerId, freeModel.id, complexity.estimatedTokens);
      return {
        providerId,
        modelId: freeModel.id,
        tier: 'free',
        reasoning: `Fallback to free model. Task complexity: ${complexity.level}.`,
        costEstimate: cost,
      };
    }
  }

  // Last resort - use first available provider's first model
  const firstProvider = PROVIDERS.find(p => availableProviders.includes(p.id));
  if (firstProvider && firstProvider.models.length > 0) {
    const model = firstProvider.models[0];
    const cost = estimateCost(firstProvider.id, model.id, complexity.estimatedTokens);
    return {
      providerId: firstProvider.id,
      modelId: model.id,
      tier,
      reasoning: `Last resort fallback to ${firstProvider.id}/${model.id}.`,
      costEstimate: cost,
    };
  }

  return {
    providerId: 'none',
    modelId: 'none',
    tier: 'free',
    reasoning: 'No providers available.',
    costEstimate: { usd: 0, inr: 0 },
  };
}

// ─── Cost Estimation ───────────────────

function estimateCost(
  providerId: string,
  modelId: string,
  estimatedTokens: number
): { usd: number; inr: number } {
  const provider = PROVIDERS.find(p => p.id === providerId);
  if (!provider) return { usd: 0, inr: 0 };

  const model = provider.models.find(m => m.id === modelId);
  if (!model || !model.costPer1k) return { usd: 0, inr: 0 };

  const inputCost = (estimatedTokens / 1000) * (model.costPer1k.input || 0);
  const outputCost = (estimatedTokens / 1000) * (model.costPer1k.output || 0);
  const totalUsd = inputCost + outputCost;

  return {
    usd: Math.round(totalUsd * 10000) / 10000,
    inr: Math.round(totalUsd * 84 * 100) / 100,
  };
}

// ─── Performance Tracking ──────────────

export interface AgentPerformance {
  agent: string;
  model: string;
  provider: string;
  successCount: number;
  failCount: number;
  avgQuality: number;    // 0-1 quality score
  avgLatency: number;    // ms
  totalTokens: number;
  totalCostUsd: number;
  lastUsed: number;
}

const PERFORMANCE_KEY = 'oracle_agent_performance';
const HISTORY_KEY = 'oracle_agent_performance_history';
const MAX_HISTORY_ENTRIES = 500;

export function getAgentPerformance(): AgentPerformance[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PERFORMANCE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Performance History (time-series snapshots) ──

export interface PerformanceHistoryEntry {
  agent: string;
  model: string;
  provider: string;
  timestamp: number;
  success: boolean;
  quality: number;
  latencyMs: number;
  tokens: number;
  costUsd: number;
}

export function getPerformanceHistory(): PerformanceHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function pushHistoryEntry(entry: PerformanceHistoryEntry): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getPerformanceHistory();
    history.push(entry);
    // Cap history size to avoid localStorage bloat
    const trimmed = history.length > MAX_HISTORY_ENTRIES
      ? history.slice(history.length - MAX_HISTORY_ENTRIES)
      : history;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    console.warn('[ModelSelector] Failed to save performance history');
  }
}

export function logAgentPerformance(
  agent: string,
  model: string,
  provider: string,
  success: boolean,
  quality?: number,
  latencyMs?: number,
  tokens?: number,
  costUsd?: number
): void {
  if (typeof window === 'undefined') return;

  const performance = getAgentPerformance();
  const existing = performance.find(
    p => p.agent === agent && p.model === model && p.provider === provider
  );

  if (existing) {
    existing.successCount += success ? 1 : 0;
    existing.failCount += success ? 0 : 1;
    if (quality !== undefined) {
      existing.avgQuality = (existing.avgQuality * 0.8) + (quality * 0.2); // Moving average
    }
    if (latencyMs !== undefined) {
      existing.avgLatency = (existing.avgLatency * 0.8) + (latencyMs * 0.2);
    }
    existing.totalTokens += tokens || 0;
    existing.totalCostUsd += costUsd || 0;
    existing.lastUsed = Date.now();
  } else {
    performance.push({
      agent,
      model,
      provider,
      successCount: success ? 1 : 0,
      failCount: success ? 0 : 1,
      avgQuality: quality || 0.5,
      avgLatency: latencyMs || 0,
      totalTokens: tokens || 0,
      totalCostUsd: costUsd || 0,
      lastUsed: Date.now(),
    });
  }

  try {
    localStorage.setItem(PERFORMANCE_KEY, JSON.stringify(performance));
  } catch {
    console.warn('[ModelSelector] Failed to save performance data');
  }

  // Push a timestamped snapshot for the trend chart
  pushHistoryEntry({
    agent,
    model,
    provider,
    timestamp: Date.now(),
    success,
    quality: quality ?? 0.5,
    latencyMs: latencyMs ?? 0,
    tokens: tokens ?? 0,
    costUsd: costUsd ?? 0,
  });
}

export function getBestPerformingModel(
  agent: string,
  tier: ModelTier
): { providerId: string; modelId: string } | null {
  const performance = getAgentPerformance();
  const tierModels = performance
    .filter(p => {
      if (p.agent !== agent || p.successCount <= p.failCount) return false;
      // Check if this model's cost fits within the requested tier
      const provider = PROVIDERS.find(pr => pr.id === p.provider);
      const model = provider?.models.find(m => m.id === p.model);
      if (!model) return false;
      const cost = model.costPer1k?.output ?? 0;
      return cost <= MODEL_TIERS[tier].maxCostPer1k;
    })
    .sort((a, b) => {
      // Score = quality * 0.6 + successRate * 0.4
      const scoreA = (a.avgQuality * 0.6) + ((a.successCount / (a.successCount + a.failCount)) * 0.4);
      const scoreB = (b.avgQuality * 0.6) + ((b.successCount / (b.successCount + b.failCount)) * 0.4);
      return scoreB - scoreA;
    });

  return tierModels.length > 0
    ? { providerId: tierModels[0].provider, modelId: tierModels[0].model }
    : null;
}

// ─── Token Budget Management ───────────

export interface TokenBudget {
  dailyLimit: number;
  usedToday: number;
  lastReset: string; // ISO date
}

const BUDGET_KEY = 'oracle_token_budget';

export function getTokenBudget(): TokenBudget {
  if (typeof window === 'undefined') {
    return { dailyLimit: 1000000, usedToday: 0, lastReset: new Date().toISOString().split('T')[0] };
  }

  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    if (!raw) {
      return { dailyLimit: 1000000, usedToday: 0, lastReset: new Date().toISOString().split('T')[0] };
    }

    const budget: TokenBudget = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];

    // Reset if new day
    if (budget.lastReset !== today) {
      budget.usedToday = 0;
      budget.lastReset = today;
      localStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
    }

    return budget;
  } catch {
    return { dailyLimit: 1000000, usedToday: 0, lastReset: new Date().toISOString().split('T')[0] };
  }
}

export function setBudgetDailyLimit(newLimit: number): void {
  if (typeof window === 'undefined') return;
  const budget = getTokenBudget();
  budget.dailyLimit = Math.max(0, newLimit);
  try {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
  } catch {
    console.warn('[ModelSelector] Failed to save budget limit');
  }
}

export function trackTokenUsage(tokens: number): boolean {
  if (typeof window === 'undefined') return true;

  const budget = getTokenBudget();
  if (budget.usedToday + tokens > budget.dailyLimit) {
    return false; // Budget exceeded
  }

  budget.usedToday += tokens;
  try {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
  } catch {
    console.warn('[ModelSelector] Failed to save token budget');
  }

  return true;
}

export function shouldDowngradeDueToBudget(
  estimatedTokens: number,
  currentTier: ModelTier
): ModelTier {
  const budget = getTokenBudget();
  const remaining = budget.dailyLimit - budget.usedToday;

  // If less than 20% budget remaining, downgrade one tier
  if (remaining < budget.dailyLimit * 0.2) {
    const tiers: ModelTier[] = ['free', 'budget', 'standard', 'premium', 'elite'];
    const currentIndex = tiers.indexOf(currentTier);
    if (currentIndex > 0) {
      return tiers[currentIndex - 1];
    }
  }

  // If estimated tokens would use more than 10% of remaining, downgrade
  if (estimatedTokens > remaining * 0.1) {
    const tiers: ModelTier[] = ['free', 'budget', 'standard', 'premium', 'elite'];
    const currentIndex = tiers.indexOf(currentTier);
    if (currentIndex > 0) {
      return tiers[currentIndex - 1];
    }
  }

  return currentTier;
}
