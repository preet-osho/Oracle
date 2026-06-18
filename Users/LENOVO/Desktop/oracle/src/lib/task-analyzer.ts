// ═══════════════════════════════════════
// ORACLE — Intelligent Task Analyzer
// Task Decomposition · Agent Selection · Complexity Scoring
// ═══════════════════════════════════════

import type { ModelTier } from '@/lib/model-selector';

// ─── Task Categories ───────────────────

export type TaskCategory =
  | 'research'
  | 'content-creation'
  | 'code-generation'
  | 'data-analysis'
  | 'strategic-planning'
  | 'marketing'
  | 'design'
  | 'finance'
  | 'voice-config'
  | 'quality-assurance'
  | 'project-management'
  | 'workflow-design'
  | 'general';

// ─── Agent Mapping ─────────────────────

export interface AgentAssignment {
  role: string;
  priority: number;      // 1 = primary, 2 = secondary, 3 = support
  taskFocus: string;     // What this agent should focus on
  requiredTier: ModelTier;
}

const CATEGORY_AGENT_MAP: Record<TaskCategory, AgentAssignment[]> = {
  'research': [
    { role: 'researcher', priority: 1, taskFocus: 'Gather data, tools, benchmarks, market info', requiredTier: 'standard' },
    { role: 'analyst', priority: 2, taskFocus: 'Analyze findings and provide insights', requiredTier: 'standard' },
  ],
  'content-creation': [
    { role: 'writer', priority: 1, taskFocus: 'Create polished, ready-to-publish content', requiredTier: 'premium' },
    { role: 'designer', priority: 2, taskFocus: 'Visual elements and formatting', requiredTier: 'standard' },
  ],
  'code-generation': [
    { role: 'developer', priority: 1, taskFocus: 'Write complete, runnable code', requiredTier: 'premium' },
    { role: 'qa', priority: 2, taskFocus: 'Review code quality and security', requiredTier: 'standard' },
  ],
  'data-analysis': [
    { role: 'analyst', priority: 1, taskFocus: 'Data analysis, metrics, benchmarks', requiredTier: 'premium' },
    { role: 'researcher', priority: 2, taskFocus: 'Gather additional data sources', requiredTier: 'standard' },
  ],
  'strategic-planning': [
    { role: 'strategist', priority: 1, taskFocus: 'Strategic planning and roadmap', requiredTier: 'premium' },
    { role: 'analyst', priority: 2, taskFocus: 'Data-driven recommendations', requiredTier: 'standard' },
    { role: 'coordinator', priority: 3, taskFocus: 'Project breakdown and timeline', requiredTier: 'standard' },
  ],
  'marketing': [
    { role: 'marketer', priority: 1, taskFocus: 'Digital marketing strategy and campaigns', requiredTier: 'premium' },
    { role: 'writer', priority: 2, taskFocus: 'Marketing copy and content', requiredTier: 'standard' },
    { role: 'designer', priority: 3, taskFocus: 'Visual campaign assets', requiredTier: 'standard' },
  ],
  'design': [
    { role: 'designer', priority: 1, taskFocus: 'UI/UX design and brand identity', requiredTier: 'premium' },
    { role: 'developer', priority: 2, taskFocus: 'Implementation specifications', requiredTier: 'standard' },
  ],
  'finance': [
    { role: 'finance', priority: 1, taskFocus: 'Financial modeling and pricing', requiredTier: 'premium' },
    { role: 'analyst', priority: 2, taskFocus: 'ROI analysis and benchmarks', requiredTier: 'standard' },
  ],
  'voice-config': [
    { role: 'voice', priority: 1, taskFocus: 'Voice agent configuration', requiredTier: 'standard' },
    { role: 'developer', priority: 2, taskFocus: 'Technical integration', requiredTier: 'standard' },
  ],
  'quality-assurance': [
    { role: 'qa', priority: 1, taskFocus: 'Code review and testing', requiredTier: 'premium' },
    { role: 'developer', priority: 2, taskFocus: 'Fix issues and optimizations', requiredTier: 'standard' },
  ],
  'project-management': [
    { role: 'coordinator', priority: 1, taskFocus: 'Project planning and coordination', requiredTier: 'standard' },
    { role: 'strategist', priority: 2, taskFocus: 'Strategic alignment', requiredTier: 'standard' },
  ],
  'workflow-design': [
    { role: 'workflow', priority: 1, taskFocus: 'Multi-phase workflow design', requiredTier: 'premium' },
    { role: 'coordinator', priority: 2, taskFocus: 'Dependency management', requiredTier: 'standard' },
  ],
  'general': [
    { role: 'researcher', priority: 1, taskFocus: 'Gather relevant information', requiredTier: 'budget' },
  ],
};

// ─── Task Analysis Keywords ────────────

const CATEGORY_KEYWORDS: Record<TaskCategory, string[]> = {
  'research': ['research', 'find', 'search', 'investigate', 'discover', 'learn about', 'what is', 'how does'],
  'content-creation': ['write', 'create', 'draft', 'compose', 'blog', 'article', 'content', 'post', 'copy'],
  'code-generation': ['code', 'implement', 'build', 'develop', 'program', 'script', 'function', 'api', 'database'],
  'data-analysis': ['analyze', 'data', 'metrics', 'statistics', 'benchmark', 'compare', 'measure', 'track'],
  'strategic-planning': ['strategy', 'plan', 'roadmap', 'vision', 'goals', 'objectives', 'long-term', 'growth'],
  'marketing': ['marketing', 'campaign', 'seo', 'social media', 'ads', 'brand', 'audience', 'conversion'],
  'design': ['design', 'ui', 'ux', 'layout', 'wireframe', 'mockup', 'visual', 'brand identity'],
  'finance': ['budget', 'pricing', 'roi', 'revenue', 'profit', 'cost', 'financial', 'invoice'],
  'voice-config': ['voice agent', 'call', 'telephony', 'ivr', 'phone', 'conversation flow'],
  'quality-assurance': ['test', 'review', 'audit', 'security', 'performance', 'quality', 'bug', 'error'],
  'project-management': ['project', 'timeline', 'deadline', 'milestone', 'task', 'assign', 'coordinate'],
  'workflow-design': ['workflow', 'automation', 'process', 'pipeline', 'sequence', 'orchestrate'],
  'general': [],
};

// ─── Complexity Keywords ───────────────

const COMPLEXITY_MULTIPLIERS: Record<string, number> = {
  // High complexity indicators
  'comprehensive': 1.5,
  'detailed': 1.4,
  'in-depth': 1.5,
  'thorough': 1.4,
  'complete': 1.3,
  'enterprise': 1.5,
  'production': 1.4,
  'scalable': 1.3,
  'optimization': 1.3,
  'advanced': 1.4,
  'complex': 1.5,
  'multi-step': 1.4,
  'end-to-end': 1.5,

  // Simple indicators
  'quick': 0.7,
  'simple': 0.6,
  'basic': 0.6,
  'brief': 0.7,
  'summary': 0.7,
  'overview': 0.7,
  'list': 0.6,
  'bullet': 0.6,
};

// ─── Main Analysis Function ────────────

export interface TaskAnalysis {
  category: TaskCategory;
  complexity: number;         // 0-1 scale
  estimatedTokens: number;
  agents: AgentAssignment[];
  parallelizable: boolean;
  requiresWebSearch: boolean;
  suggestedTier: ModelTier;
  breakdown?: string[];       // Sub-tasks if complex
}

export function analyzeTask(task: string): TaskAnalysis {
  const lowerTask = task.toLowerCase();
  const words = lowerTask.split(/\s+/);
  const wordCount = words.length;

  // 1. Detect category
  let bestCategory: TaskCategory = 'general';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(k => lowerTask.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category as TaskCategory;
    }
  }

  // 2. Calculate complexity
  let complexityScore = 0.5; // Base complexity

  // Word count factor
  if (wordCount > 200) complexityScore += 0.2;
  else if (wordCount > 100) complexityScore += 0.1;
  else if (wordCount < 20) complexityScore -= 0.1;

  // Complexity keywords
  for (const [keyword, multiplier] of Object.entries(COMPLEXITY_MULTIPLIERS)) {
    if (lowerTask.includes(keyword)) {
      complexityScore *= multiplier;
    }
  }

  // Clamp to 0-1
  complexityScore = Math.max(0, Math.min(1, complexityScore));

  // 3. Get agent assignments
  const agents = CATEGORY_AGENT_MAP[bestCategory] || CATEGORY_AGENT_MAP.general;

  // 4. Adjust tiers based on complexity
  const adjustedAgents = agents.map(agent => ({
    ...agent,
    requiredTier: getTierForComplexity(complexityScore, agent.requiredTier),
  }));

  // 5. Estimate tokens (rough: 1.5x word count for input, 2x for output)
  const estimatedTokens = Math.ceil(wordCount * 1.5 * 2.5);

  // 6. Determine if parallelizable
  const parallelizable = agents.length > 1 && complexityScore < 0.7;

  // 7. Check for web search needs
  const searchKeywords = ['search', 'find', 'current', 'latest', 'recent', 'today', 'now', 'web'];
  const requiresWebSearch = searchKeywords.some(k => lowerTask.includes(k));

  // 8. Overall suggested tier
  const suggestedTier = getTierForComplexity(complexityScore, 'standard');

  // 9. Break down complex tasks
  let breakdown: string[] | undefined;
  if (complexityScore > 0.6 && wordCount > 100) {
    breakdown = generateTaskBreakdown(task, bestCategory);
  }

  return {
    category: bestCategory,
    complexity: complexityScore,
    estimatedTokens,
    agents: adjustedAgents,
    parallelizable,
    requiresWebSearch,
    suggestedTier,
    breakdown,
  };
}

// ─── Helper Functions ──────────────────

function getTierForComplexity(complexity: number, baseTier: string): ModelTier {
  const tiers: ModelTier[] = ['free', 'budget', 'standard', 'premium', 'elite'];
  const baseIndex = tiers.indexOf(baseTier as ModelTier);

  if (complexity < 0.2) return tiers[Math.max(0, baseIndex - 2)];
  if (complexity < 0.4) return tiers[Math.max(0, baseIndex - 1)];
  if (complexity < 0.6) return baseTier as ModelTier;
  if (complexity < 0.8) return tiers[Math.min(4, baseIndex + 1)];
  return tiers[Math.min(4, baseIndex + 2)];
}

function generateTaskBreakdown(task: string, category: TaskCategory): string[] {
  const breakdowns: Record<TaskCategory, string[]> = {
    'research': [
      'Identify key research questions',
      'Gather relevant data and sources',
      'Analyze findings',
      'Synthesize into actionable insights',
    ],
    'content-creation': [
      'Define content structure and outline',
      'Create initial draft',
      'Add supporting details and examples',
      'Polish and finalize',
    ],
    'code-generation': [
      'Understand requirements and constraints',
      'Design solution architecture',
      'Implement core functionality',
      'Add error handling and tests',
      'Review and optimize',
    ],
    'data-analysis': [
      'Define analysis objectives',
      'Collect and clean data',
      'Perform statistical analysis',
      'Visualize results',
      'Provide recommendations',
    ],
    'strategic-planning': [
      'Assess current state',
      'Define goals and objectives',
      'Identify strategies and tactics',
      'Create implementation roadmap',
      'Define success metrics',
    ],
    'marketing': [
      'Define target audience',
      'Set marketing objectives',
      'Develop channel strategy',
      'Create campaign plan',
      'Define measurement approach',
    ],
    'design': [
      'Gather design requirements',
      'Create wireframes/mockups',
      'Design visual elements',
      'Ensure accessibility',
      'Document specifications',
    ],
    'finance': [
      'Gather financial data',
      'Build financial model',
      'Analyze projections',
      'Create recommendations',
      'Document assumptions',
    ],
    'voice-config': [
      'Design conversation flow',
      'Configure voice agent',
      'Set up telephony integration',
      'Test and optimize',
    ],
    'quality-assurance': [
      'Define testing strategy',
      'Execute test cases',
      'Identify issues',
      'Provide fix recommendations',
      'Verify resolution',
    ],
    'project-management': [
      'Define project scope',
      'Break down tasks',
      'Create timeline',
      'Assign responsibilities',
      'Set up tracking',
    ],
    'workflow-design': [
      'Map current workflow',
      'Identify optimization opportunities',
      'Design new workflow',
      'Implement automation',
      'Test and validate',
    ],
    'general': [
      'Understand the request',
      'Gather necessary information',
      'Provide response',
    ],
  };

  return breakdowns[category] || breakdowns.general;
}


