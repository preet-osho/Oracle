import type { ModelTier } from '@/lib/model-selector';
import { AGENT_REGISTRY, getAgentsByCategory, getAllCategories, type AgentName } from '@/lib/agents/registry';

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
  | 'legal-compliance'
  | 'security-audit'
  | 'data-science'
  | 'competitive-intelligence'
  | 'editorial'
  | 'localization'
  | 'sales'
  | 'technical-writing'
  | 'lead-generation'
  | 'offer-strategy'
  | 'video-production'
  | 'web-design'
  | 'agent-building'
  | 'general';

// ─── Agent Mapping ─────────────────────
// Built dynamically from the centralized agent registry (src/lib/agents/registry.ts).
// The registry's `category` field is the single source of truth for agent routing.

export interface AgentAssignment {
  role: string;
  priority: number;      // 1 = primary, 2 = secondary, 3 = support
  taskFocus: string;     // What this agent should focus on
  requiredTier: ModelTier;
}

/** Agent name → task category overrides for cases where names don't match exactly */
const AGENT_CATEGORY_OVERRIDES: Record<string, TaskCategory> = {
  'competitor-intel': 'competitive-intelligence',
  'data-scientist': 'data-science',
  'editor': 'editorial',
  'workflow': 'workflow-design',
  'localization': 'localization',
  'lead-hunter': 'lead-generation',
  'offer-strategist': 'offer-strategy',
  'video-specialist': 'video-production',
  'web-designer': 'web-design',
  'agent-builder': 'agent-building',
};

/** Registry category → task-analyzer category mapping */
const CATEGORY_MAP: Record<string, TaskCategory> = {
  'research': 'research',
  'content': 'content-creation',
  'technical': 'code-generation',
  'analysis': 'data-analysis',
  'strategy': 'strategic-planning',
  'marketing': 'marketing',
  'design': 'design',
  'finance': 'finance',
  'voice': 'voice-config',
  'quality': 'quality-assurance',
  'coordination': 'project-management',
  'compliance': 'legal-compliance',
  'security': 'security-audit',
  'sales': 'sales',
  'technical-writing': 'technical-writing',
  'lead-generation': 'lead-generation',
  'offer-strategy': 'offer-strategy',
  'video-production': 'video-production',
  'web-design': 'web-design',
  'agent-building': 'agent-building',
  'orchestration': 'workflow-design',
};

/**
 * Single function mapping agent name → task category.
 * Combines registry category lookup with name-based overrides.
 * This is the single source of truth for agent-to-task-category routing.
 */
export function agentToTaskCategory(agentName: string): TaskCategory | undefined {
  if (AGENT_CATEGORY_OVERRIDES[agentName]) return AGENT_CATEGORY_OVERRIDES[agentName];
  const meta = AGENT_REGISTRY[agentName as AgentName];
  if (!meta) return undefined;
  return CATEGORY_MAP[meta.category];
}

/**
 * Get task focus and default tier from the centralized registry.
 * These are derived from AgentMetadata, not hardcoded separately.
 */
/* v8 ignore start -- module-init helpers only called from buildCategoryAgentMap */
function getAgentFocus(agentName: string): string {
  const meta = AGENT_REGISTRY[agentName as AgentName];
  return meta?.taskFocus || meta?.description || agentName;
}

function getAgentDefaultTier(agentName: string): ModelTier {
  const meta = AGENT_REGISTRY[agentName as AgentName];
  return (meta?.defaultTier as ModelTier) || 'standard';
}

/**
 * Build CATEGORY_AGENT_MAP dynamically from the centralized agent registry.
 * Each task category gets agents whose registry `category` matches.
 * Agents whose names match a task category name are also added there.
 * Fallback agents from related categories are added for multi-agent support.
 */
function buildCategoryAgentMap(): Record<TaskCategory, AgentAssignment[]> {
  const map: Record<string, AgentAssignment[]> = {};

  // Step 1: Group agents by registry category, then map to task categories
  for (const registryCategory of getAllCategories()) {
    const agentsInCategory = getAgentsByCategory(registryCategory);
    // Map the first agent's registry category to a task category
    const firstAgent = agentsInCategory[0];
    if (!firstAgent) continue;
    const taskCategory = agentToTaskCategory(firstAgent);
    if (!taskCategory) continue;

    if (!map[taskCategory]) map[taskCategory] = [];

    for (const agentName of agentsInCategory) {
      map[taskCategory].push({
        role: agentName,
        priority: 1,
        taskFocus: getAgentFocus(agentName),
        requiredTier: getAgentDefaultTier(agentName),
      });
    }
  }

  // Also add agents whose overrides point to a different task category
  for (const [agentName, overrideTaskCategory] of Object.entries(AGENT_CATEGORY_OVERRIDES)) {
    // Check if this agent was already added to this override category
    if (!map[overrideTaskCategory]) map[overrideTaskCategory] = [];
    const alreadyAdded = map[overrideTaskCategory].some((a) => a.role === agentName);
    if (alreadyAdded) continue;
    map[overrideTaskCategory].push({
      role: agentName,
      priority: 1,
      taskFocus: getAgentFocus(agentName),
      requiredTier: getAgentDefaultTier(agentName),
    });
  }

  // Step 2: Add cross-category support agents
  const supportMap: Partial<Record<TaskCategory, { role: string; taskFocus: string }[]>> = {
    'research': [{ role: 'analyst', taskFocus: 'Analyze findings and provide insights' }],
    'content-creation': [{ role: 'designer', taskFocus: 'Visual elements and formatting' }],
    'code-generation': [{ role: 'qa', taskFocus: 'Review code quality and security' }],
    'data-analysis': [{ role: 'researcher', taskFocus: 'Gather additional data sources' }],
    'strategic-planning': [
      { role: 'analyst', taskFocus: 'Data-driven recommendations' },
      { role: 'coordinator', taskFocus: 'Project breakdown and timeline' },
    ],
    'marketing': [
      { role: 'writer', taskFocus: 'Marketing copy and content' },
      { role: 'designer', taskFocus: 'Visual campaign assets' },
    ],
    'design': [{ role: 'developer', taskFocus: 'Implementation specifications' }],
    'finance': [{ role: 'analyst', taskFocus: 'ROI analysis and benchmarks' }],
    'voice-config': [{ role: 'developer', taskFocus: 'Technical integration' }],
    'quality-assurance': [{ role: 'developer', taskFocus: 'Fix issues and optimizations' }],
    'project-management': [{ role: 'strategist', taskFocus: 'Strategic alignment' }],
    'workflow-design': [{ role: 'coordinator', taskFocus: 'Dependency management' }],
    'legal-compliance': [{ role: 'analyst', taskFocus: 'Support with data and analysis' }],
    'security-audit': [{ role: 'qa', taskFocus: 'Quality assurance and testing' }],
    'data-science': [{ role: 'analyst', taskFocus: 'Business analytics support' }],
    'competitive-intelligence': [
      { role: 'researcher', taskFocus: 'Data gathering and source verification' },
      { role: 'analyst', taskFocus: 'Data analysis and benchmarking' },
    ],
    'localization': [{ role: 'writer', taskFocus: 'Content refinement' }],
    'editorial': [],
    'sales': [{ role: 'analyst', taskFocus: 'Revenue analytics and forecasting' }],
    'technical-writing': [{ role: 'developer', taskFocus: 'Technical accuracy review' }],
    'lead-generation': [{ role: 'sales-optimizer', taskFocus: 'Pipeline and outreach optimization' }, { role: 'writer', taskFocus: 'Outreach copywriting' }],
    'offer-strategy': [{ role: 'finance', taskFocus: 'Pricing and ROI analysis' }, { role: 'writer', taskFocus: 'Proposal writing' }],
    'video-production': [{ role: 'designer', taskFocus: 'Visual elements and thumbnails' }, { role: 'writer', taskFocus: 'Video scripts and captions' }],
    'web-design': [{ role: 'developer', taskFocus: 'Technical implementation' }, { role: 'conversion-optimizer', taskFocus: 'Conversion optimization' }],
    'agent-building': [{ role: 'developer', taskFocus: 'Technical integration' }, { role: 'qa', taskFocus: 'Testing and quality gates' }],
    'general': [{ role: 'researcher', taskFocus: 'Generate relevant information' }],
  };

  for (const [category, supports] of Object.entries(supportMap)) {
    if (!map[category]) map[category] = [];
    const existing = new Set(map[category].map((a) => a.role));
    for (const support of supports) {
      if (!existing.has(support.role)) {
        map[category].push({
          role: support.role,
          priority: 0, // Will be assigned in Step 3
          taskFocus: support.taskFocus,
          requiredTier: getAgentDefaultTier(support.role),
        });
      }
    }
  }

  // Step 3: Assign priority ordering within each category (after all agents are added)
  for (const category of Object.keys(map)) {
    map[category].forEach((agent, i) => {
      agent.priority = i + 1;
    });
  }

  // Step 4: Ensure all task categories have entries
  if (!map.general) map.general = [{ role: 'researcher', priority: 1, taskFocus: 'Gather relevant information', requiredTier: 'budget' }];

  return map as Record<TaskCategory, AgentAssignment[]>;
}
// Build once at module load time from the registry
const CATEGORY_AGENT_MAP = buildCategoryAgentMap();
/* v8 ignore stop */

// ─── Task Analysis Keywords ────────────

const CATEGORY_KEYWORDS: Record<TaskCategory, string[]> = {
  'research': ['research', 'find', 'search', 'investigate', 'discover', 'learn about', 'what is', 'how does'],
  'content-creation': ['write', 'create', 'draft', 'compose', 'blog', 'article', 'content', 'post', 'copy'],
  'code-generation': ['code', 'implement', 'build', 'develop', 'program', 'script', 'function', 'api', 'database'],
  'data-analysis': ['analyze', 'data', 'metrics', 'statistics', 'benchmark', 'compare', 'measure', 'track'],
  'strategic-planning': ['strategy', 'plan', 'roadmap', 'vision', 'goals', 'objectives', 'long-term', 'growth'],
  'marketing': ['marketing', 'campaign', 'seo', 'social media', 'ads', 'brand', 'audience', 'conversion'],
  'design': ['design', 'ui', 'ux', 'layout', 'wireframe', 'mockup', 'visual', 'brand identity', 'figma', 'design system', 'prototype'],
  'finance': ['budget', 'pricing', 'roi', 'revenue', 'profit', 'cost', 'financial', 'invoice', 'gst', 'tax', 'accounting', 'cash flow'],
  'voice-config': ['voice agent', 'call', 'telephony', 'ivr', 'phone', 'conversation flow', 'tts', 'speech recognition', 'voice clone', 'sip trunk'],
  'quality-assurance': ['test', 'review', 'audit', 'security', 'performance', 'quality', 'bug', 'error'],
  'lead-generation': ['lead gen', 'prospect', 'cold email', 'cold dm', 'outreach', 'lead list', 'icp', 'ideal client', 'scoring', 'qualification'],
  'offer-strategy': ['offer', 'proposal', 'pricing', 'package', 'retainer', 'value proposition', 'objection', 'close', 'deal structure'],
  'video-production': ['video', 'reel', 'youtube', 'short', 'script', 'shot list', 'b-roll', 'editing', 'hook', 'retention'],
  'web-design': ['website', 'landing page', 'wireframe', 'ux', 'web design', 'cta', 'conversion flow', 'above the fold', 'trust signal'],
  'agent-building': ['agent', 'chatbot', 'ai bot', 'voice agent', 'build agent', 'tool call', 'routing logic', 'memory rule', 'quality gate'],
  'project-management': ['project', 'timeline', 'deadline', 'milestone', 'task', 'assign', 'coordinate'],
  'workflow-design': ['workflow', 'automation', 'process', 'pipeline', 'sequence', 'orchestrate'],
  'legal-compliance': ['legal', 'compliance', 'contract', 'agreement', 'gst', 'sebi', 'terms', 'regulation', 'license', 'disclosure', 'disclaimer', 'privacy', 'data protection', 'liability', 'indemnity', 'arbitration', 'intellectual property'],
  'security-audit': ['security', 'vulnerability', 'penetration', 'owasp', 'encryption', 'authentication', 'hack', 'breach', 'ssl', 'firewall', 'intrusion'],
  'data-science': ['machine learning', 'artificial intelligence', 'prediction', 'forecast', 'statistical', 'regression', 'classification', 'clustering', 'dashboard', 'visualization', 'dataset', 'model'],
  'competitive-intelligence': ['competitor', 'competitive', 'swot', 'market analysis', 'benchmark', 'positioning', 'differentiation', 'market share', 'threat', 'opportunity'],
  'editorial': ['proofread', 'edit', 'grammar', 'spell', 'consistency', 'tone', 'polish', 'final review', 'quality check', 'formatting'],
  'localization': ['hindi', 'hinglish', 'regional', 'translate', 'localize', 'vernacular', 'multilingual', 'dialect', 'cultural adaptation'],
  'sales': ['sales', 'pipeline', 'outreach', 'demo', 'proposal', 'lead', 'prospect', 'crm', 'deal', 'closing', 'revenue', 'quota', 'negotiation', 'upsell', 'commission'],
  'technical-writing': ['documentation', 'api reference', 'tutorial', 'developer guide', 'readme', 'openapi', 'swagger', 'changelog', 'migration guide', 'sdk', 'developer experience', 'code example'],
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
    'legal-compliance': [
      'Identify applicable regulations',
      'Review compliance requirements',
      'Flag legal risks',
      'Provide compliance checklist',
      'Add required disclaimers',
    ],
    'security-audit': [
      'Map attack surface',
      'Audit against OWASP Top 10',
      'Identify vulnerabilities',
      'Provide remediation with code',
      'Verify with security tools',
    ],
    'data-science': [
      'Define business question',
      'Assess data availability',
      'Apply statistical methods',
      'Create visualizations',
      'Recommend actions',
    ],
    'competitive-intelligence': [
      'Identify top competitors',
      'Gather public data',
      'Build comparison matrix',
      'Analyze market gaps',
      'Recommend differentiation',
    ],
    'editorial': [
      'Read output end-to-end',
      'Flag all issues',
      'Fix grammar and consistency',
      'Verify cross-references',
      'Final professional polish',
    ],
    'localization': [
      'Identify target audience tier',
      'Map cultural context',
      'Convert to natural Hinglish',
      'Adapt for regional variants',
      'Validate cultural accuracy',
    ],
    'sales': [
      'Define ideal customer profile',
      'Build prospect list and outreach sequences',
      'Craft pitch and proposal materials',
      'Handle objections and negotiate terms',
      'Track pipeline and forecast revenue',
    ],
    'technical-writing': [
      'Audit existing documentation',
      'Structure information architecture',
      'Write reference documentation',
      'Add code examples and tutorials',
      'Validate accuracy and publish',
    ],
    'lead-generation': [
      'Define Ideal Client Profile',
      'Source leads across platforms',
      'Score and segment prospects',
      'Create outreach angles',
      'Generate outreach assets',
    ],
    'offer-strategy': [
      'Diagnose client problem and cost of inaction',
      'Frame service as outcome-based offer',
      'Build 3-tier pricing structure',
      'Create proposal with proof and risk reversal',
      'Prepare objection handlers',
    ],
    'video-production': [
      'Design hook and story arc',
      'Write full script',
      'Plan shots and B-roll',
      'Create editing notes',
      'Build repurposing plan',
    ],
    'web-design': [
      'Map user journey and site architecture',
      'Create wireframe and content hierarchy',
      'Design conversion flow and CTA strategy',
      'Define mobile-first responsive behavior',
      'Set performance and trust signal targets',
    ],
    'agent-building': [
      'Define agent role and mission',
      'Configure tools and function calling',
      'Set memory rules and context management',
      'Design routing and escalation logic',
      'Build quality gates and failure handling',
    ],
    'general': [
      'Understand the request',
      'Gather necessary information',
      'Provide response',
    ],
  };

  return breakdowns[category] || breakdowns.general;
}
