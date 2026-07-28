// ═══════════════════════════════════════
// ORACLE — Agency Command Center Dashboard
// Master Dashboard · Metrics · Visualization · Real-Time Updates
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';
import {
  getCRMDashboard,
  generateForecast,
  getPipelineMetrics,
  type CRMDashboard,
  type ForecastResult,
  type PipelineMetrics,
} from '@/lib/crm';
import { getAgentPerformance, type AgentPerformance } from '@/lib/model-selector';
import { getTokenBudget, type TokenBudget } from '@/lib/model-selector';

const log = createLogger('CommandCenter');

// ─── Types ─────────────────────────────

export type DashboardWidget =
  | 'revenue'
  | 'pipeline'
  | 'leads'
  | 'deals'
  | 'activities'
  | 'agent-health'
  | 'tool-health'
  | 'memory-health'
  | 'seo-rankings'
  | 'ad-performance'
  | 'cost-tracking'
  | 'learning-metrics';

export interface DashboardConfig {
  widgets: DashboardWidget[];
  refreshInterval: number; // seconds
  dateRange: 'today' | 'week' | 'month' | 'quarter' | 'year';
  compareWithPrevious: boolean;
}

export type DateRangeOption = 'today' | 'week' | 'month' | 'quarter' | 'year';

export interface DashboardMetrics {
  timestamp: number;
  revenue: RevenueMetrics;
  pipeline: PipelineDashboardMetrics;
  leads: LeadMetrics;
  deals: DealMetrics;
  activities: ActivityMetrics;
  agentHealth: AgentHealthMetrics;
  toolHealth: ToolHealthMetrics;
  memoryHealth: MemoryHealthMetrics;
  costTracking: CostMetrics;
  learning: LearningMetrics;
}

export interface RevenueMetrics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  totalRevenue: number;
  revenueGrowth: number; // percentage
  averageDealSize: number;
  ltv: number; // Lifetime Value
  cac: number; // Customer Acquisition Cost
  ltvCacRatio: number;
}

export interface PipelineDashboardMetrics {
  totalValue: number;
  weightedValue: number;
  dealCount: number;
  averageProbability: number;
  conversionRate: number;
  averageSalesCycle: number; // days
  forecast: ForecastResult;
  stageBreakdown: PipelineMetrics[];
}

export interface LeadMetrics {
  totalLeads: number;
  newLeadsThisMonth: number;
  leadsBySource: Record<string, number>;
  leadsByStatus: Record<string, number>;
  conversionRate: number;
  averageResponseTime: number; // hours
}

export interface DealMetrics {
  activeDeals: number;
  closedWon: number;
  closedLost: number;
  winRate: number;
  averageDealSize: number;
  dealsClosingThisMonth: number;
  overdueDeals: number;
}

export interface ActivityMetrics {
  totalActivities: number;
  activitiesThisWeek: number;
  callsMade: number;
  emailsSent: number;
  meetingsHeld: number;
  tasksCompleted: number;
  pendingTasks: number;
}

export interface AgentHealthMetrics {
  totalAgents: number;
  activeAgents: number;
  averageSuccessRate: number;
  averageResponseTime: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  topPerformingAgent: string;
  worstPerformingAgent: string;
}

export interface CostMetrics {
  totalCostUsd: number;
  totalCostInr: number;
  costByProvider: Record<string, number>;
  costByAgent: Record<string, number>;
  budgetUtilization: number; // percentage
  costTrend: { date: string; cost: number }[];
}

export interface LearningMetrics {
  totalTasksCompleted: number;
  averageQualityScore: number;
  improvementRate: number; // percentage
  learningEntries: number;
  patternMatches: number;
  accuracyRate: number;
}

export interface ToolHealthMetrics {
  totalServers: number;
  healthyServers: number;
  degradedServers: number;
  unhealthyServers: number;
  unknownServers: number;
  totalTools: number;
  averageLatencyMs: number;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  serverDetails: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    latencyMs: number;
    toolCount: number;
  }>;
}

export interface MemoryHealthMetrics {
  totalMemories: number;
  memoriesByCategory: Record<string, number>;
  memoriesByImportance: Record<string, number>;
  averageAccessCount: number;
  oldestMemoryAge: number; // days
  newestMemoryAge: number; // days
  storageUsage: 'low' | 'medium' | 'high';
  healthScore: number; // 0-100
}

export interface WidgetData {
  widget: DashboardWidget;
  data: unknown;
  lastUpdated: number;
  status: 'healthy' | 'warning' | 'error';
}

// ─── Dashboard Generation ──────────────

// ─── Date Range Helpers ────────────────

/** Returns a scaling factor based on date range to adjust metrics proportionally */
function getDateRangeScaleFactor(dateRange: DateRangeOption): number {
  switch (dateRange) {
    case 'today':
      return 1 / 30; // ~3% of monthly
    case 'week':
      return 1 / 4; // ~25% of monthly
    case 'month':
      return 1; // baseline
    case 'quarter':
      return 3; // 3x monthly
    case 'year':
      return 12; // 12x monthly
    default:
      return 1;
  }
}

/** Returns the number of days for the selected date range */
function getDateRangeDays(dateRange: DateRangeOption): number {
  switch (dateRange) {
    case 'today':
      return 1;
    case 'week':
      return 7;
    case 'month':
      return 30;
    case 'quarter':
      return 90;
    case 'year':
      return 365;
    default:
      return 30;
  }
}

export const DATE_RANGE_OPTIONS: { value: DateRangeOption; label: string; icon: string }[] = [
  { value: 'today', label: 'Today', icon: '📅' },
  { value: 'week', label: 'Week', icon: '📆' },
  { value: 'month', label: 'Month', icon: '🗓️' },
  { value: 'quarter', label: 'Quarter', icon: '📊' },
  { value: 'year', label: 'Year', icon: '📈' },
];

export async function generateDashboardMetrics(dateRange: DateRangeOption = 'month'): Promise<DashboardMetrics> {
  const startTime = Date.now();
  log.info('Generating dashboard metrics', { dateRange });

  const scaleFactor = getDateRangeScaleFactor(dateRange);
  const daysInRange = getDateRangeDays(dateRange);

  // Gather data from all sources
  const crmDashboard = getCRMDashboard();
  const forecast = generateForecast();
  const pipelineMetrics = getPipelineMetrics();
  const agentPerformance = getAgentPerformance();
  const tokenBudget = getTokenBudget();

  // Calculate revenue metrics
  const revenue = calculateRevenueMetrics(crmDashboard, forecast);

  // Calculate pipeline metrics
  const pipeline = calculatePipelineMetrics(crmDashboard, forecast, pipelineMetrics);

  // Calculate lead metrics
  const leads = calculateLeadMetrics(crmDashboard);

  // Calculate deal metrics
  const deals = calculateDealMetrics(crmDashboard, forecast);

  // Calculate activity metrics
  const activities = calculateActivityMetrics(crmDashboard);

  // Calculate agent health metrics
  const agentHealth = calculateAgentHealthMetrics(agentPerformance);

  // Calculate tool health metrics
  const toolHealth = await calculateToolHealthMetrics();

  // Calculate memory health metrics
  const memoryHealth = await calculateMemoryHealthMetrics();

  // Calculate cost metrics
  const costTracking = calculateCostMetrics(agentPerformance, tokenBudget);

  // Calculate learning metrics
  const learning = calculateLearningMetrics(agentPerformance);

  // Apply date range scaling to metrics
  const scaledRevenue = scaleRevenueMetrics(revenue, scaleFactor);
  const scaledPipeline = scalePipelineMetrics(pipeline, scaleFactor);
  const scaledLeads = scaleLeadsMetrics(leads, scaleFactor);
  const scaledDeals = scaleDealMetrics(deals, scaleFactor);
  const scaledActivities = scaleActivityMetrics(activities, scaleFactor);
  const scaledCostTracking = scaleCostMetrics(costTracking, scaleFactor, daysInRange);
  const scaledLearning = scaleLearningMetrics(learning, scaleFactor);

  const metrics: DashboardMetrics = {
    timestamp: Date.now(),
    revenue: scaledRevenue,
    pipeline: scaledPipeline,
    leads: scaledLeads,
    deals: scaledDeals,
    activities: scaledActivities,
    agentHealth,
    toolHealth,
    memoryHealth,
    costTracking: scaledCostTracking,
    learning: scaledLearning,
  };

  log.info('Dashboard metrics generated', {
    duration: Date.now() - startTime,
  });

  return metrics;
}

// ─── Revenue Calculations ──────────────

function calculateRevenueMetrics(
  crmDashboard: CRMDashboard,
  forecast: ForecastResult,
): RevenueMetrics {
  const mrr = forecast.closedWon / 3; // Assume quarterly data
  const arr = mrr * 12;
  const totalRevenue = forecast.closedWon;
  const revenueGrowth = forecast.winRate > 50 ? 15 : -5; // Simplified

  return {
    mrr: Math.round(mrr),
    arr: Math.round(arr),
    totalRevenue,
    revenueGrowth,
    averageDealSize: forecast.avgDealSize,
    ltv: forecast.avgDealSize * 3, // Assume 3-year retention
    cac: forecast.avgDealSize * 0.2, // Assume 20% CAC ratio
    ltvCacRatio: 15, // Simplified
  };
}

// ─── Pipeline Calculations ─────────────

function calculatePipelineMetrics(
  crmDashboard: CRMDashboard,
  forecast: ForecastResult,
  pipelineMetrics: PipelineMetrics[],
): PipelineDashboardMetrics {
  return {
    totalValue: crmDashboard.totalPipelineValue,
    weightedValue: crmDashboard.weightedPipelineValue,
    dealCount: crmDashboard.activeDeals,
    averageProbability: forecast.weightedPipeline > 0
      ? Math.round((forecast.weightedPipeline / forecast.totalPipeline) * 100)
      : 0,
    conversionRate: forecast.winRate,
    averageSalesCycle: forecast.avgSalesCycleDays,
    forecast,
    stageBreakdown: pipelineMetrics,
  };
}

// ─── Lead Calculations ─────────────────

function calculateLeadMetrics(crmDashboard: CRMDashboard): LeadMetrics {
  return {
    totalLeads: crmDashboard.contactsByType.lead + crmDashboard.contactsByType.prospect,
    newLeadsThisMonth: Math.round(crmDashboard.contactsByType.lead * 0.3), // Simplified
    leadsBySource: {
      'Google Maps': 5,
      LinkedIn: 8,
      Website: 12,
      Referral: 3,
    },
    leadsByStatus: {
      New: crmDashboard.contactsByType.lead,
      Qualified: crmDashboard.contactsByType.prospect,
      Client: crmDashboard.contactsByType.client,
    },
    conversionRate: 25, // Simplified
    averageResponseTime: 4.5, // hours
  };
}

// ─── Deal Calculations ─────────────────

function calculateDealMetrics(
  crmDashboard: CRMDashboard,
  forecast: ForecastResult,
): DealMetrics {
  return {
    activeDeals: crmDashboard.activeDeals,
    closedWon: Math.round(forecast.closedWon / forecast.avgDealSize) || 0,
    closedLost: Math.round(forecast.closedLost / forecast.avgDealSize) || 0,
    winRate: forecast.winRate,
    averageDealSize: forecast.avgDealSize,
    dealsClosingThisMonth: crmDashboard.dealsClosingThisMonth,
    overdueDeals: crmDashboard.overdueTasks.length,
  };
}

// ─── Activity Calculations ─────────────

function calculateActivityMetrics(crmDashboard: CRMDashboard): ActivityMetrics {
  const recentActivities = crmDashboard.recentActivities;

  return {
    totalActivities: recentActivities.length * 10, // Simplified
    activitiesThisWeek: recentActivities.length,
    callsMade: recentActivities.filter((a) => a.type === 'call').length,
    emailsSent: recentActivities.filter((a) => a.type === 'email').length,
    meetingsHeld: recentActivities.filter((a) => a.type === 'meeting').length,
    tasksCompleted: recentActivities.filter((a) => a.completedAt).length,
    pendingTasks: crmDashboard.overdueTasks.length,
  };
}

// ─── Agent Health Calculations ─────────

function calculateAgentHealthMetrics(
  agentPerformance: AgentPerformance[],
): AgentHealthMetrics {
  if (agentPerformance.length === 0) {
    return {
      totalAgents: 0,
      activeAgents: 0,
      averageSuccessRate: 0,
      averageResponseTime: 0,
      totalTokensUsed: 0,
      totalCostUsd: 0,
      topPerformingAgent: 'N/A',
      worstPerformingAgent: 'N/A',
    };
  }

  const totalAgents = agentPerformance.length;
  const activeAgents = agentPerformance.filter(
    (a) => Date.now() - a.lastUsed < 7 * 24 * 60 * 60 * 1000,
  ).length;

  const averageSuccessRate = Math.round(
    agentPerformance.reduce((sum, a) => {
      const total = a.successCount + a.failCount;
      return sum + (total > 0 ? (a.successCount / total) * 100 : 0);
    }, 0) / totalAgents,
  );

  const averageResponseTime = Math.round(
    agentPerformance.reduce((sum, a) => sum + a.avgLatency, 0) / totalAgents,
  );

  const totalTokensUsed = agentPerformance.reduce((sum, a) => sum + a.totalTokens, 0);
  const totalCostUsd = agentPerformance.reduce((sum, a) => sum + a.totalCostUsd, 0);

  // Find top and worst performing agents
  const sortedBySuccess = [...agentPerformance].sort((a, b) => {
    const rateA = a.successCount / (a.successCount + a.failCount || 1);
    const rateB = b.successCount / (b.successCount + b.failCount || 1);
    return rateB - rateA;
  });

  return {
    totalAgents,
    activeAgents,
    averageSuccessRate,
    averageResponseTime,
    totalTokensUsed,
    totalCostUsd,
    topPerformingAgent: sortedBySuccess[0]?.agent || 'N/A',
    worstPerformingAgent: sortedBySuccess[sortedBySuccess.length - 1]?.agent || 'N/A',
  };
}

// ─── Cost Calculations ─────────────────

function calculateCostMetrics(
  agentPerformance: AgentPerformance[],
  tokenBudget: TokenBudget,
): CostMetrics {
  const costByProvider: Record<string, number> = {};
  const costByAgent: Record<string, number> = {};

  for (const agent of agentPerformance) {
    costByProvider[agent.provider] = (costByProvider[agent.provider] || 0) + agent.totalCostUsd;
    costByAgent[agent.agent] = (costByAgent[agent.agent] || 0) + agent.totalCostUsd;
  }

  const totalCostUsd = agentPerformance.reduce((sum, a) => sum + a.totalCostUsd, 0);
  const totalCostInr = Math.round(totalCostUsd * 84);
  const budgetUtilization = Math.round((tokenBudget.usedToday / tokenBudget.dailyLimit) * 100);

  // Generate cost trend (last 7 days)
  const costTrend = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    costTrend.push({
      date: date.toISOString().split('T')[0],
      cost: Math.round(totalCostUsd / 7), // Simplified
    });
  }

  return {
    totalCostUsd: Math.round(totalCostUsd * 100) / 100,
    totalCostInr,
    costByProvider,
    costByAgent,
    budgetUtilization,
    costTrend,
  };
}

// ─── Date Range Scaling Functions ─────

function scaleRevenueMetrics(
  revenue: RevenueMetrics,
  scaleFactor: number,
): RevenueMetrics {
  const scaled = Math.round;
  return {
    ...revenue,
    totalRevenue: scaled(revenue.totalRevenue * scaleFactor),
    // Keep MRR, ARR as-is (they represent current rates, not totals)
    // Keep percentages/ratios as-is
  };
}

function scalePipelineMetrics(
  pipeline: PipelineDashboardMetrics,
  _scaleFactor: number,
): PipelineDashboardMetrics {
  // Note: dealCount is a point-in-time snapshot (active deals), not historical
  // totalValue and weightedValue represent current pipeline state
  // So we leave these unchanged as they reflect current state, not period totals
  return {
    ...pipeline,
    // Keep all pipeline metrics as-is (point-in-time state)
  };
}

function scaleLeadsMetrics(
  leads: LeadMetrics,
  _scaleFactor: number,
): LeadMetrics {
  // Note: totalLeads is cumulative (all leads ever), not a period metric
  // newLeadsThisMonth already represents a specific period
  // So we leave these unchanged to avoid double-counting
  return {
    ...leads,
    // Keep all lead metrics as-is (cumulative/period-specific)
  };
}

function scaleDealMetrics(
  deals: DealMetrics,
  scaleFactor: number,
): DealMetrics {
  const scaled = Math.round;
  return {
    ...deals,
    closedWon: scaled(deals.closedWon * scaleFactor),
    closedLost: scaled(deals.closedLost * scaleFactor),
    // Keep activeDeals as-is (current state, not historical)
    // Keep win rate, average deal size as-is
  };
}

function scaleActivityMetrics(
  activities: ActivityMetrics,
  scaleFactor: number,
): ActivityMetrics {
  const scaled = Math.round;
  return {
    ...activities,
    totalActivities: scaled(activities.totalActivities * scaleFactor),
    activitiesThisWeek: scaled(activities.activitiesThisWeek * scaleFactor),
    callsMade: scaled(activities.callsMade * scaleFactor),
    emailsSent: scaled(activities.emailsSent * scaleFactor),
    meetingsHeld: scaled(activities.meetingsHeld * scaleFactor),
    tasksCompleted: scaled(activities.tasksCompleted * scaleFactor),
    pendingTasks: activities.pendingTasks, // Keep pending tasks as-is (current state)
  };
}

function scaleCostMetrics(
  costTracking: CostMetrics,
  scaleFactor: number,
  daysInRange: number,
): CostMetrics {
  const scaled = Math.round;
  // Regenerate costTrend based on date range
  const costTrend: { date: string; cost: number }[] = [];
  const baseCostPerDay = costTracking.totalCostUsd / 7; // Average daily cost
  for (let i = daysInRange - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    costTrend.push({
      date: date.toISOString().split('T')[0],
      cost: scaled(baseCostPerDay * 100) / 100,
    });
  }
  // Scale USD first, then convert to INR for accuracy
  const scaledCostUsd = scaled(costTracking.totalCostUsd * scaleFactor * 100) / 100;
  const scaledCostInr = Math.round(scaledCostUsd * 84);
  return {
    ...costTracking,
    totalCostUsd: scaledCostUsd,
    totalCostInr: scaledCostInr,
    costTrend,
  };
}

function scaleLearningMetrics(
  learning: LearningMetrics,
  scaleFactor: number,
): LearningMetrics {
  const scaled = Math.round;
  return {
    ...learning,
    totalTasksCompleted: scaled(learning.totalTasksCompleted * scaleFactor),
    learningEntries: scaled(learning.learningEntries * scaleFactor),
    patternMatches: scaled(learning.patternMatches * scaleFactor),
    // Keep quality-based metrics as-is (percentages/rates)
  };
}

// ─── Tool Health Calculations ─────────

async function calculateToolHealthMetrics(): Promise<ToolHealthMetrics> {
  try {
    const { getMCPClient } = await import('@/lib/agents/mcp-servers');
    const client = getMCPClient();
    const healthResults = await client.healthCheck({ parallel: true });
    const summary = client.getHealthSummary(healthResults);
    const serverDetails: ToolHealthMetrics['serverDetails'] = [];
    let totalLatency = 0;
    let latencyCount = 0;

    for (const [name, result] of Object.entries(healthResults)) {
      const server = client.listServers().find((s) => s.name.toLowerCase().replace(/\s+/g, '-') === name);
      serverDetails.push({
        name: (result.details?.server as string) || name,
        status: result.status,
        latencyMs: result.latencyMs,
        toolCount: server?.tools.length || 0,
      });
      if (result.latencyMs > 0) {
        totalLatency += result.latencyMs;
        latencyCount++;
      }
    }

    return {
      totalServers: summary.total,
      healthyServers: summary.healthy,
      degradedServers: summary.degraded,
      unhealthyServers: summary.unhealthy,
      unknownServers: summary.unknown,
      totalTools: client.getTotalToolCount(),
      averageLatencyMs: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
      overallStatus: summary.unhealthy > 0 ? 'unhealthy' : summary.degraded > 0 ? 'degraded' : 'healthy',
      serverDetails,
    };
  } catch (error) {
    log.error('Failed to calculate tool health metrics', { error });
    return {
      totalServers: 0,
      healthyServers: 0,
      degradedServers: 0,
      unhealthyServers: 0,
      unknownServers: 0,
      totalTools: 0,
      averageLatencyMs: 0,
      overallStatus: 'unhealthy',
      serverDetails: [],
    };
  }
}

// ─── Memory Health Calculations ────────

async function calculateMemoryHealthMetrics(): Promise<MemoryHealthMetrics> {
  try {
    const { getMemorySystem } = await import('@/lib/agents/memory-system');
    const { ALL_AGENT_NAMES } = await import('@/lib/agents/registry');
    const memorySystem = getMemorySystem();

    // Aggregate stats across all registered agents
    let totalMemories = 0;
    const memoriesByCategory: Record<string, number> = {};
    const memoriesByImportance: Record<string, number> = {};
    let totalAccessCount = 0;
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;
    let agentCount = 0;

    for (const agentId of ALL_AGENT_NAMES) {
      const stats = await memorySystem.getMemoryStats('system', agentId);
      if (stats.totalMemories > 0) {
        agentCount++;
        totalMemories += stats.totalMemories;
        totalAccessCount += stats.avgAccessCount * stats.totalMemories;

        // Merge category counts
        for (const [cat, count] of Object.entries(stats.byCategory)) {
          memoriesByCategory[cat] = (memoriesByCategory[cat] || 0) + count;
        }

        // Merge importance counts
        for (const [imp, count] of Object.entries(stats.byImportance)) {
          memoriesByImportance[imp] = (memoriesByImportance[imp] || 0) + count;
        }

        // Track age range
        if (stats.oldestMemory < oldestTimestamp) oldestTimestamp = stats.oldestMemory;
        if (stats.newestMemory > newestTimestamp) newestTimestamp = stats.newestMemory;
      }
    }

    const averageAccessCount = totalMemories > 0 ? totalAccessCount / totalMemories : 0;

    // Calculate age in days
    const now = Date.now();
    const oldestMemoryAge = totalMemories > 0 ? Math.floor((now - oldestTimestamp) / (24 * 60 * 60 * 1000)) : 0;
    const newestMemoryAge = totalMemories > 0 ? Math.floor((now - newestTimestamp) / (24 * 60 * 60 * 1000)) : 0;

    // Storage usage classification
    const storageUsage: MemoryHealthMetrics['storageUsage'] =
      totalMemories > 1000 ? 'high' : totalMemories > 500 ? 'medium' : 'low';

    // Health score: 100 = perfect, degrades with age and overuse
    const agePenalty = Math.min(30, oldestMemoryAge / 3); // Max 30 point penalty for old memories
    const usageBonus = Math.min(20, averageAccessCount * 2); // Max 20 point bonus for active memories
    const healthScore = Math.round(Math.min(100, Math.max(0, 70 - agePenalty + usageBonus)));

    return {
      totalMemories,
      memoriesByCategory,
      memoriesByImportance,
      averageAccessCount: Math.round(averageAccessCount * 10) / 10,
      oldestMemoryAge,
      newestMemoryAge,
      storageUsage,
      healthScore,
    };
  } catch (error) {
    log.error('Failed to calculate memory health metrics', { error });
    return {
      totalMemories: 0,
      memoriesByCategory: {},
      memoriesByImportance: {},
      averageAccessCount: 0,
      oldestMemoryAge: 0,
      newestMemoryAge: 0,
      storageUsage: 'low',
      healthScore: 0,
    };
  }
}

// ─── Learning Calculations ─────────────

function calculateLearningMetrics(
  agentPerformance: AgentPerformance[],
): LearningMetrics {
  const totalTasksCompleted = agentPerformance.reduce(
    (sum, a) => sum + a.successCount + a.failCount,
    0,
  );

  const averageQualityScore = agentPerformance.length > 0
    ? Math.round(
        agentPerformance.reduce((sum, a) => sum + a.avgQuality, 0) /
          agentPerformance.length * 100,
      )
    : 0;

  return {
    totalTasksCompleted,
    averageQualityScore,
    improvementRate: 12, // Simplified
    learningEntries: totalTasksCompleted,
    patternMatches: Math.round(totalTasksCompleted * 0.3),
    accuracyRate: averageQualityScore,
  };
}

// ─── Widget Data Generation ────────────

export async function getWidgetData(widget: DashboardWidget): Promise<WidgetData> {
  const metrics = await generateDashboardMetrics();

  let data: unknown;
  let status: WidgetData['status'] = 'healthy';

  switch (widget) {
    case 'revenue':
      data = metrics.revenue;
      status = metrics.revenue.revenueGrowth >= 0 ? 'healthy' : 'warning';
      break;
    case 'pipeline':
      data = metrics.pipeline;
      status = metrics.pipeline.dealCount > 0 ? 'healthy' : 'warning';
      break;
    case 'leads':
      data = metrics.leads;
      status = metrics.leads.newLeadsThisMonth > 0 ? 'healthy' : 'warning';
      break;
    case 'deals':
      data = metrics.deals;
      status = metrics.deals.winRate >= 30 ? 'healthy' : 'warning';
      break;
    case 'activities':
      data = metrics.activities;
      status = metrics.activities.pendingTasks < 5 ? 'healthy' : 'warning';
      break;
    case 'agent-health':
      data = metrics.agentHealth;
      status = metrics.agentHealth.averageSuccessRate >= 80 ? 'healthy' : 'warning';
      break;
    case 'seo-rankings':
      data = { rankings: [], averagePosition: 0 }; // Would integrate with SEO tools
      status = 'healthy';
      break;
    case 'ad-performance':
      data = { campaigns: [], totalSpend: 0, roas: 0 }; // Would integrate with ad platforms
      status = 'healthy';
      break;
    case 'cost-tracking':
      data = metrics.costTracking;
      status = metrics.costTracking.budgetUtilization < 80 ? 'healthy' : 'warning';
      break;
    case 'learning-metrics':
      data = metrics.learning;
      status = metrics.learning.averageQualityScore >= 70 ? 'healthy' : 'warning';
      break;
    case 'tool-health':
      data = metrics.toolHealth;
      status = metrics.toolHealth.overallStatus === 'healthy' ? 'healthy' : metrics.toolHealth.overallStatus === 'degraded' ? 'warning' : 'error';
      break;
    case 'memory-health':
      data = metrics.memoryHealth;
      status = metrics.memoryHealth.healthScore >= 70 ? 'healthy' : metrics.memoryHealth.healthScore >= 40 ? 'warning' : 'error';
      break;
  }

  return {
    widget,
    data,
    lastUpdated: Date.now(),
    status,
  };
}

// ─── Dashboard Summary ─────────────────

export function formatDashboardSummary(metrics: DashboardMetrics): string {
  let summary = `## Agency Command Center\n\n`;
  summary += `**Last Updated:** ${new Date(metrics.timestamp).toLocaleString('en-IN')}\n\n`;

  // Revenue Summary
  summary += `### 💰 Revenue\n`;
  summary += `| Metric | Value |\n`;
  summary += `|--------|-------|\n`;
  summary += `| MRR | ₹${metrics.revenue.mrr.toLocaleString('en-IN')} |\n`;
  summary += `| ARR | ₹${metrics.revenue.arr.toLocaleString('en-IN')} |\n`;
  summary += `| Revenue Growth | ${metrics.revenue.revenueGrowth}% |\n`;
  summary += `| Average Deal Size | ₹${metrics.revenue.averageDealSize.toLocaleString('en-IN')} |\n\n`;

  // Pipeline Summary
  summary += `### 📊 Pipeline\n`;
  summary += `| Metric | Value |\n`;
  summary += `|--------|-------|\n`;
  summary += `| Total Pipeline | ₹${metrics.pipeline.totalValue.toLocaleString('en-IN')} |\n`;
  summary += `| Weighted Pipeline | ₹${metrics.pipeline.weightedValue.toLocaleString('en-IN')} |\n`;
  summary += `| Active Deals | ${metrics.pipeline.dealCount} |\n`;
  summary += `| Win Rate | ${metrics.pipeline.conversionRate}% |\n\n`;

  // Leads Summary
  summary += `### 🎯 Leads\n`;
  summary += `| Metric | Value |\n`;
  summary += `|--------|-------|\n`;
  summary += `| Total Leads | ${metrics.leads.totalLeads} |\n`;
  summary += `| New This Month | ${metrics.leads.newLeadsThisMonth} |\n`;
  summary += `| Conversion Rate | ${metrics.leads.conversionRate}% |\n\n`;

  // Agent Health
  summary += `### 🤖 Agent Health\n`;
  summary += `| Metric | Value |\n`;
  summary += `|--------|-------|\n`;
  summary += `| Active Agents | ${metrics.agentHealth.activeAgents}/${metrics.agentHealth.totalAgents} |\n`;
  summary += `| Success Rate | ${metrics.agentHealth.averageSuccessRate}% |\n`;
  summary += `| Top Performer | ${metrics.agentHealth.topPerformingAgent} |\n\n`;

  // Cost Tracking
  summary += `### 💵 Cost Tracking\n`;
  summary += `| Metric | Value |\n`;
  summary += `|--------|-------|\n`;
  summary += `| Total Cost | $${metrics.costTracking.totalCostUsd} (₹${metrics.costTracking.totalCostInr.toLocaleString('en-IN')}) |\n`;
  summary += `| Budget Utilization | ${metrics.costTracking.budgetUtilization}% |\n\n`;

  // Learning
  summary += `### 📚 Learning\n`;
  summary += `| Metric | Value |\n`;
  summary += `|--------|-------|\n`;
  summary += `| Tasks Completed | ${metrics.learning.totalTasksCompleted} |\n`;
  summary += `| Quality Score | ${metrics.learning.averageQualityScore}/100 |\n`;
  summary += `| Accuracy Rate | ${metrics.learning.accuracyRate}% |\n`;

  return summary;
}
