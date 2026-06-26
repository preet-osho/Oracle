// ═══════════════════════════════════════
// ORACLE — Client-Isolated Task Queue
// Multi-client task storage · Classification · Isolation
// ═══════════════════════════════════════

import { analyzeTask, type TaskAnalysis, type TaskCategory } from '@/lib/task-analyzer';

// ─── Types ─────────────────────────────

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'queued' | 'analyzing' | 'researching' | 'planning' | 'review' | 'executing' | 'completed' | 'failed' | 'on-hold';

export interface ClientTask {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  analysis?: TaskAnalysis;
  approaches?: TaskApproach[];
  selectedApproach?: number;
  assignedAgents: string[];
  results: TaskResult[];
  skills?: SkillTemplate[];
  reviewNotes?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  deadline?: number;
  tags: string[];
  estimatedCost?: number;
  actualCost?: number;
}

export interface TaskApproach {
  id: string;
  name: string;
  description: string;
  agents: string[];
  estimatedTime: string;
  estimatedCost: string;
  pros: string[];
  cons: string[];
  riskLevel: 'low' | 'medium' | 'high';
  recommendedFor: string;
}

export interface TaskResult {
  agent: string;
  output: string;
  qualityScore?: number;
  timestamp: number;
  duration: number;
  tokensUsed: number;
}

export interface SkillTemplate {
  id: string;
  name: string;
  category: TaskCategory;
  description: string;
  agents: string[];
  promptTemplate: string;
  usageCount: number;
  avgQuality: number;
  createdAt: number;
  lastUsedAt: number;
}

export interface ClientTaskSummary {
  clientId: string;
  clientName: string;
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalCost: number;
  avgQuality: number;
  lastActivity: number;
}

export interface ReviewCheckpoint {
  taskId: string;
  type: 'pre-execution' | 'post-execution' | 'quality-gate';
  status: 'pending' | 'approved' | 'rejected' | 'needs-changes';
  notes: string;
  checkedBy: string;
  checkedAt?: number;
  issues?: string[];
  recommendations?: string[];
}

// ─── Storage Keys ──────────────────────

const TASKS_KEY = 'oracle_client_tasks';
const SKILLS_KEY = 'oracle_skill_templates';
const REVIEWS_KEY = 'oracle_review_checkpoints';
const MAX_TASKS = 500;
const MAX_SKILLS = 200;

// ─── Task Operations ───────────────────

export function addClientTask(task: Omit<ClientTask, 'id' | 'createdAt' | 'updatedAt' | 'results'>): ClientTask {
  const newTask: ClientTask = {
    ...task,
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    results: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const tasks = getClientTasks();
  tasks.unshift(newTask);
  saveClientTasks(tasks.slice(0, MAX_TASKS));

  return newTask;
}

export function getClientTasks(): ClientTask[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getClientTasksById(clientId: string): ClientTask[] {
  return getClientTasks().filter(t => t.clientId === clientId);
}

export function getTaskById(taskId: string): ClientTask | undefined {
  return getClientTasks().find(t => t.id === taskId);
}

export function updateClientTask(taskId: string, updates: Partial<ClientTask>): ClientTask | null {
  const tasks = getClientTasks();
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return null;

  tasks[idx] = { ...tasks[idx], ...updates, updatedAt: Date.now() };
  saveClientTasks(tasks);
  return tasks[idx];
}

export function deleteClientTask(taskId: string): boolean {
  const tasks = getClientTasks();
  const filtered = tasks.filter(t => t.id !== taskId);
  if (filtered.length === tasks.length) return false;
  saveClientTasks(filtered);
  return true;
}

export function addTaskResult(taskId: string, result: Omit<TaskResult, 'timestamp'>): boolean {
  const tasks = getClientTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return false;

  task.results.push({ ...result, timestamp: Date.now() });
  task.updatedAt = Date.now();
  saveClientTasks(tasks);
  return true;
}

// ─── Batch Analysis ────────────────────

export interface BatchAnalysisResult {
  taskId: string;
  clientName: string;
  analysis: TaskAnalysis;
  approaches: TaskApproach[];
  priority: TaskPriority;
}

export function analyzeBatchTasks(tasks: ClientTask[]): BatchAnalysisResult[] {
  return tasks.map(task => {
    const analysis = analyzeTask(`${task.title} ${task.description}`);
    const approaches = generateApproaches(task, analysis);
    const priority = inferPriority(analysis);

    return {
      taskId: task.id,
      clientName: task.clientName,
      analysis,
      approaches,
      priority,
    };
  });
}

function generateApproaches(task: ClientTask, analysis: TaskAnalysis): TaskApproach[] {
  const approaches: TaskApproach[] = [];
  const agents = analysis.agents.map(a => a.role);

  // Approach 1: Recommended (balanced)
  approaches.push({
    id: 'balanced',
    name: '🎯 Balanced Approach',
    description: `Optimal mix of speed and quality using ${agents.length} specialist agents. Best for most client work.`,
    agents: agents.slice(0, Math.min(agents.length, 3)),
    estimatedTime: analysis.complexity > 0.7 ? '45-60 min' : '20-30 min',
    estimatedCost: `$${(analysis.estimatedTokens * 0.000002).toFixed(2)}`,
    pros: ['Best quality-to-cost ratio', 'Multiple specialist perspectives', 'Built-in review step'],
    cons: ['Moderate token usage', 'Requires coordination between agents'],
    riskLevel: 'low',
    recommendedFor: 'Standard client deliverables',
  });

  // Approach 2: Premium (thorough)
  if (analysis.complexity > 0.5) {
    approaches.push({
      id: 'premium',
      name: '🏆 Premium Thorough',
      description: `Maximum quality with all available specialists. Includes QA review and multiple revision passes.`,
      agents: agents,
      estimatedTime: '60-90 min',
      estimatedCost: `$${(analysis.estimatedTokens * 0.000004).toFixed(2)}`,
      pros: ['Highest quality output', 'Comprehensive coverage', 'QA validation included'],
      cons: ['Higher token cost', 'Longer execution time'],
      riskLevel: 'low',
      recommendedFor: 'High-value client deliverables (₹50,000+)',
    });
  }

  // Approach 3: Fast (budget)
  approaches.push({
    id: 'fast',
    name: '⚡ Fast Track',
    description: `Quick delivery using primary specialist only. Good for straightforward tasks or tight deadlines.`,
    agents: [agents[0]],
    estimatedTime: '10-15 min',
    estimatedCost: `$${(analysis.estimatedTokens * 0.000001).toFixed(2)}`,
    pros: ['Fastest delivery', 'Lowest cost', 'Simple coordination'],
    cons: ['Single perspective', 'May miss edge cases', 'No built-in review'],
    riskLevel: 'medium',
    recommendedFor: 'Simple tasks or urgent deadlines',
  });

  return approaches;
}

function inferPriority(analysis: TaskAnalysis): TaskPriority {
  if (analysis.complexity > 0.8) return 'critical';
  if (analysis.complexity > 0.6) return 'high';
  if (analysis.complexity > 0.3) return 'medium';
  return 'low';
}

// ─── Client Summaries ──────────────────

export function getClientSummaries(): ClientTaskSummary[] {
  const tasks = getClientTasks();
  const clientMap = new Map<string, {
    name: string;
    total: number;
    active: number;
    completed: number;
    failed: number;
    costs: number[];
    qualities: number[];
    lastActivity: number;
  }>();

  for (const task of tasks) {
    const existing = clientMap.get(task.clientId) || {
      name: task.clientName,
      total: 0,
      active: 0,
      completed: 0,
      failed: 0,
      costs: [],
      qualities: [],
      lastActivity: 0,
    };

    existing.total++;
    if (['queued', 'analyzing', 'researching', 'planning', 'review', 'executing'].includes(task.status)) {
      existing.active++;
    }
    if (task.status === 'completed') existing.completed++;
    if (task.status === 'failed') existing.failed++;
    if (task.actualCost) existing.costs.push(task.actualCost);
    if (task.results.length > 0) {
      const avg = task.results.reduce((s, r) => s + (r.qualityScore || 0), 0) / task.results.length;
      existing.qualities.push(avg);
    }
    if (task.updatedAt > existing.lastActivity) existing.lastActivity = task.updatedAt;

    clientMap.set(task.clientId, existing);
  }

  return Array.from(clientMap.entries()).map(([clientId, data]) => ({
    clientId,
    clientName: data.name,
    totalTasks: data.total,
    activeTasks: data.active,
    completedTasks: data.completed,
    failedTasks: data.failed,
    totalCost: data.costs.reduce((a, b) => a + b, 0),
    avgQuality: data.qualities.length > 0
      ? Math.round(data.qualities.reduce((a, b) => a + b, 0) / data.qualities.length)
      : 0,
    lastActivity: data.lastActivity,
  }));
}

// ─── Skill Templates ───────────────────

export function getSkillTemplates(): SkillTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SKILLS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function createSkillTemplate(skill: Omit<SkillTemplate, 'id' | 'createdAt' | 'lastUsedAt' | 'usageCount' | 'avgQuality'>): SkillTemplate {
  const newSkill: SkillTemplate = {
    ...skill,
    id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    usageCount: 0,
    avgQuality: 0,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  };

  const skills = getSkillTemplates();
  skills.unshift(newSkill);
  saveSkillTemplates(skills.slice(0, MAX_SKILLS));

  return newSkill;
}

export function updateSkillTemplate(skillId: string, updates: Partial<SkillTemplate>): SkillTemplate | null {
  const skills = getSkillTemplates();
  const idx = skills.findIndex(s => s.id === skillId);
  if (idx === -1) return null;

  skills[idx] = { ...skills[idx], ...updates };
  saveSkillTemplates(skills);
  return skills[idx];
}

export function recordSkillUsage(skillId: string, quality: number): void {
  const skills = getSkillTemplates();
  const skill = skills.find(s => s.id === skillId);
  if (!skill) return;

  const totalQuality = skill.avgQuality * skill.usageCount + quality;
  skill.usageCount++;
  skill.avgQuality = Math.round(totalQuality / skill.usageCount);
  skill.lastUsedAt = Date.now();

  saveSkillTemplates(skills);
}

export function getSkillsByCategory(category: TaskCategory): SkillTemplate[] {
  return getSkillTemplates().filter(s => s.category === category);
}

// ─── Auto-Skill Creator ────────────────

export function autoCreateSkillsFromTask(task: ClientTask): SkillTemplate[] {
  if (task.results.length < 3) return []; // Need at least 3 results to establish a pattern

  const newSkills: SkillTemplate[] = [];
  const existingSkills = getSkillTemplates();

  // Check if a skill already exists for this task category
  const existingForCategory = existingSkills.filter(s => s.category === task.category);

  // If we have 3+ completed tasks in the same category, create a skill
  if (existingForCategory.length < 2) {
    const avgQuality = task.results.reduce((s, r) => s + (r.qualityScore || 0), 0) / task.results.length;

    const skill = createSkillTemplate({
      name: `Auto: ${task.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      category: task.category,
      description: `Auto-generated skill from ${task.clientName}'s task: ${task.title}`,
      agents: task.assignedAgents,
      promptTemplate: `${task.title}\n\n${task.description}\n\n---\n[Auto-generated template from successful task execution]`,
    });

    newSkills.push(skill);
  }

  return newSkills;
}

// ─── Review Checkpoints ────────────────

export function getReviewCheckpoints(): ReviewCheckpoint[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addReviewCheckpoint(checkpoint: ReviewCheckpoint): void {
  const checkpoints = getReviewCheckpoints();
  const existingIdx = checkpoints.findIndex(
    c => c.taskId === checkpoint.taskId && c.type === checkpoint.type
  );

  if (existingIdx >= 0) {
    checkpoints[existingIdx] = checkpoint;
  } else {
    checkpoints.push(checkpoint);
  }

  localStorage.setItem(REVIEWS_KEY, JSON.stringify(checkpoints));
}

export function getCheckpointForTask(taskId: string): ReviewCheckpoint[] {
  return getReviewCheckpoints().filter(c => c.taskId === taskId);
}

// ─── Storage Helpers ───────────────────

function saveClientTasks(tasks: ClientTask[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch {
    // Silently fail
  }
}

function saveSkillTemplates(skills: SkillTemplate[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SKILLS_KEY, JSON.stringify(skills));
  } catch {
    // Silently fail
  }
}

// ─── Demo Data ─────────────────────────

export function populateDemoTasks(): void {
  const demoClients = [
    { id: 'client-1', name: 'Priya Sharma - Dental Clinic' },
    { id: 'client-2', name: 'Rajesh Patel - Restaurant Chain' },
    { id: 'client-3', name: 'Anita Desai - E-commerce Brand' },
  ];

  const demoTasks: Omit<ClientTask, 'id' | 'createdAt' | 'updatedAt' | 'results'>[] = [
    {
      clientId: 'client-1',
      clientName: demoClients[0].name,
      title: 'Google Ads Campaign Setup',
      description: 'Create and configure Google Ads campaigns for dental implant services targeting Mumbai professionals aged 30-50',
      category: 'marketing',
      priority: 'high',
      status: 'queued',
      assignedAgents: ['researcher', 'marketer', 'analyst'],
      tags: ['google-ads', 'dental', 'mumbai'],
      estimatedCost: 15.50,
    },
    {
      clientId: 'client-1',
      clientName: demoClients[0].name,
      title: 'Website SEO Audit & Fix',
      description: 'Comprehensive SEO audit of dental clinic website with technical fixes and content optimization',
      category: 'quality-assurance',
      priority: 'medium',
      status: 'analyzing',
      assignedAgents: ['researcher', 'developer', 'qa'],
      tags: ['seo', 'technical-audit'],
      estimatedCost: 8.25,
    },
    {
      clientId: 'client-2',
      clientName: demoClients[1].name,
      title: 'Social Media Content Calendar',
      description: '30-day Instagram and Facebook content calendar for a restaurant chain with 5 locations in Delhi NCR',
      category: 'content-creation',
      priority: 'high',
      status: 'planning',
      assignedAgents: ['writer', 'designer', 'marketer'],
      tags: ['social-media', 'restaurant', 'content'],
      estimatedCost: 12.00,
    },
    {
      clientId: 'client-2',
      clientName: demoClients[1].name,
      title: 'Competitor Analysis Report',
      description: 'Deep analysis of top 5 restaurant competitors in Delhi NCR with pricing, menu, and marketing strategy comparison',
      category: 'research',
      priority: 'medium',
      status: 'queued',
      assignedAgents: ['researcher', 'analyst'],
      tags: ['competitor-analysis', 'restaurant'],
      estimatedCost: 6.50,
    },
    {
      clientId: 'client-3',
      clientName: demoClients[2].name,
      title: 'E-commerce Product Page Optimization',
      description: 'Optimize 50 product pages with SEO-friendly descriptions, better images, and conversion-focused copy',
      category: 'code-generation',
      priority: 'critical',
      status: 'executing',
      assignedAgents: ['developer', 'writer', 'designer', 'qa'],
      tags: ['ecommerce', 'product-pages', 'conversion'],
      estimatedCost: 22.00,
    },
    {
      clientId: 'client-3',
      clientName: demoClients[2].name,
      title: 'WhatsApp Automation Setup',
      description: 'Configure WhatsApp Business API for order confirmations, delivery tracking, and customer support',
      category: 'workflow-design',
      priority: 'high',
      status: 'queued',
      assignedAgents: ['developer', 'coordinator', 'workflow'],
      tags: ['whatsapp', 'automation', 'ecommerce'],
      estimatedCost: 18.50,
    },
  ];

  // Clear existing and add demos
  const existing = getClientTasks();
  if (existing.length === 0) {
    demoTasks.forEach(task => addClientTask(task));
  }
}
