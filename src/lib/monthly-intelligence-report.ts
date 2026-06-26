// ═══════════════════════════════════════
// ORACLE — Monthly Intelligence Report
// Summarise learnings · Track patterns · Generate insights
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export interface IntelligenceReport {
  id: string;
  month: string; // YYYY-MM
  generatedAt: number;
  summary: {
    totalTasks: number;
    tasksByCategory: Record<string, number>;
    topProviders: Array<{ provider: string; usage: number; cost: number }>;
    avgQualityScore: number;
    totalCostINR: number;
    totalTokens: number;
  };
  learnings: LearningSummary;
  recommendations: string[];
  trends: TrendObservation[];
}

export interface LearningSummary {
  totalLearnings: number;
  topDomains: Array<{ domain: string; count: number }>;
  keyInsights: string[];
  patternsDetected: string[];
}

export interface TrendObservation {
  trend: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  actionRequired: boolean;
}

// ─── Report Generator ──────────────────

export function generateMonthlyReport(month: string): IntelligenceReport {
  const now = Date.now();
  const monthStart = new Date(`${month}-01T00:00:00`).getTime();
  const monthEnd = new Date(`${month}-28T23:59:59`).getTime() + 4 * 24 * 60 * 60 * 1000; // approx end of month

  // Gather data from localStorage
  const usageHistory = getUsageHistory(monthStart, monthEnd);
  const taskHistory = getTaskHistoryForPeriod(monthStart, monthEnd);
  const qualityScores = getQualityScoresForPeriod(monthStart, monthEnd);

  // Aggregate summary
  const tasksByCategory: Record<string, number> = {};
  for (const task of taskHistory) {
    tasksByCategory[task.category] = (tasksByCategory[task.category] || 0) + 1;
  }

  const providerUsage: Record<string, { usage: number; cost: number }> = {};
  for (const usage of usageHistory) {
    const existing = providerUsage[usage.provider] || { usage: 0, cost: 0 };
    existing.usage++;
    existing.cost += usage.costINR;
    providerUsage[usage.provider] = existing;
  }

  const topProviders = Object.entries(providerUsage)
    .map(([provider, data]) => ({ provider, ...data }))
    .sort((a, b) => b.usage - a.usage);

  const avgQualityScore = qualityScores.length > 0
    ? Math.round(qualityScores.reduce((s, q) => s + q, 0) / qualityScores.length)
    : 0;

  const totalCostINR = usageHistory.reduce((s, u) => s + u.costINR, 0);
  const totalTokens = usageHistory.reduce((s, u) => s + u.inputTokens + u.outputTokens, 0);

  // Generate recommendations
  const recommendations = generateRecommendations(tasksByCategory, topProviders, avgQualityScore);

  // Detect trends
  const trends = detectTrends(taskHistory, qualityScores, usageHistory);

  return {
    id: `report-${month}-${now}`,
    month,
    generatedAt: now,
    summary: {
      totalTasks: taskHistory.length,
      tasksByCategory,
      topProviders,
      avgQualityScore,
      totalCostINR: Math.round(totalCostINR * 100) / 100,
      totalTokens,
    },
    learnings: {
      totalLearnings: taskHistory.length,
      topDomains: Object.entries(tasksByCategory)
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      keyInsights: generateKeyInsights(tasksByCategory, avgQualityScore, totalCostINR),
      patternsDetected: detectPatterns(taskHistory),
    },
    recommendations,
    trends,
  };
}

// ─── Recommendation Engine ─────────────

function generateRecommendations(
  tasksByCategory: Record<string, number>,
  topProviders: Array<{ provider: string; usage: number; cost: number }>,
  avgQuality: number
): string[] {
  const recs: string[] = [];

  // Quality-based recommendations
  if (avgQuality < 70) {
    recs.push('Quality scores are below target. Consider using more detailed system prompts and providing context in your requests.');
  } else if (avgQuality >= 90) {
    recs.push('Excellent quality scores! The current approach is working well. Consider documenting what works for consistency.');
  }

  // Cost optimisation
  if (topProviders.length > 0) {
    const topProvider = topProviders[0];
    if (topProvider.cost > 0) {
      recs.push(`Consider using free models from ${topProvider.provider} for non-critical tasks to reduce costs.`);
    }
  }

  // Task diversification
  const totalTasks = Object.values(tasksByCategory).reduce((s, c) => s + c, 0);
  if (totalTasks > 10) {
    const topCategory = Object.entries(tasksByCategory).sort(([, a], [, b]) => b - a)[0];
    if (topCategory && topCategory[1] / totalTasks > 0.6) {
      recs.push(`You're primarily doing "${topCategory[0]}" tasks. Consider diversifying to explore other service opportunities.`);
    }
  }

  // General recommendations
  recs.push('Run a weekly quality review to identify areas for improvement.');
  recs.push('Update LEARNINGS.md with new patterns discovered this month.');

  return recs.slice(0, 5);
}

function generateKeyInsights(
  tasksByCategory: Record<string, number>,
  avgQuality: number,
  totalCost: number
): string[] {
  const insights: string[] = [];

  const totalTasks = Object.values(tasksByCategory).reduce((s, c) => s + c, 0);
  insights.push(`Completed ${totalTasks} tasks this month.`);

  if (totalTasks > 0) {
    const topTask = Object.entries(tasksByCategory).sort(([, a], [, b]) => b - a)[0];
    insights.push(`Most common task: "${topTask[0]}" (${topTask[1]} times).`);
  }

  if (totalCost > 0) {
    const avgCostPerTask = totalTasks > 0 ? totalCost / totalTasks : 0;
    insights.push(`Average cost per task: ₹${avgCostPerTask.toFixed(2)}.`);
  }

  if (avgQuality >= 80) {
    insights.push('Quality scores consistently above 80. Output is client-ready.');
  } else if (avgQuality > 0) {
    insights.push(`Average quality score: ${avgQuality}/100. Focus on improving specificity and actionability.`);
  }

  return insights;
}

function detectPatterns(
  tasks: Array<{ category: string; timestamp: number }>
): string[] {
  const patterns: string[] = [];

  if (tasks.length < 3) return patterns;

  // Detect clustering
  const categories = tasks.map((t) => t.category);
  const unique = new Set(categories);
  if (unique.size === 1) {
    patterns.push(`All tasks this month are "${categories[0]}". Consider diversifying.`);
  }

  // Detect burst activity
  const dayCounts: Record<string, number> = {};
  for (const task of tasks) {
    const day = new Date(task.timestamp).toISOString().slice(0, 10);
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }
  const maxDay = Object.entries(dayCounts).sort(([, a], [, b]) => b - a)[0];
  if (maxDay && maxDay[1] > tasks.length * 0.3) {
    patterns.push(`Burst activity detected on ${maxDay[0]}: ${maxDay[1]} tasks in one day.`);
  }

  return patterns;
}

function detectTrends(
  tasks: Array<{ category: string; timestamp: number }>,
  qualityScores: number[],
  usage: Array<{ provider: string; costINR: number }>
): TrendObservation[] {
  const trends: TrendObservation[] = [];

  // Quality trend
  if (qualityScores.length >= 2) {
    const recent = qualityScores.slice(0, Math.floor(qualityScores.length / 2));
    const earlier = qualityScores.slice(Math.floor(qualityScores.length / 2));
    const recentAvg = recent.reduce((s, q) => s + q, 0) / recent.length;
    const earlierAvg = earlier.reduce((s, q) => s + q, 0) / earlier.length;

    if (recentAvg > earlierAvg + 5) {
      trends.push({
        trend: 'Improving Quality',
        description: `Quality scores improved from ${earlierAvg.toFixed(0)} to ${recentAvg.toFixed(0)} over the month.`,
        impact: 'positive',
        actionRequired: false,
      });
    } else if (recentAvg < earlierAvg - 5) {
      trends.push({
        trend: 'Declining Quality',
        description: `Quality scores dropped from ${earlierAvg.toFixed(0)} to ${recentAvg.toFixed(0)} over the month.`,
        impact: 'negative',
        actionRequired: true,
      });
    }
  }

  // Cost trend
  if (usage.length >= 2) {
    const mid = Math.floor(usage.length / 2);
    const recentCost = usage.slice(0, mid).reduce((s, u) => s + u.costINR, 0);
    const earlierCost = usage.slice(mid).reduce((s, u) => s + u.costINR, 0);

    if (recentCost > earlierCost * 1.3) {
      trends.push({
        trend: 'Rising Costs',
        description: 'API costs have increased significantly this month.',
        impact: 'negative',
        actionRequired: true,
      });
    }
  }

  return trends;
}

// ─── Data Access Helpers ───────────────

interface UsageRecord {
  provider: string;
  costINR: number;
  inputTokens: number;
  outputTokens: number;
  timestamp: number;
}

function getUsageHistory(start: number, end: number): UsageRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    // Read from Zustand persisted store (oracle-router-store) and extract usageHistory
    const routerRaw = localStorage.getItem('oracle-router-store');
    if (routerRaw) {
      const parsed = JSON.parse(routerRaw);
      const usageHistory: UsageRecord[] = parsed?.state?.usageHistory || [];
      return usageHistory.filter((u: UsageRecord) => u.timestamp >= start && u.timestamp <= end);
    }
    return [];
  } catch {
    return [];
  }
}

interface TaskRecord {
  category: string;
  timestamp: number;
}

function getTaskHistoryForPeriod(start: number, end: number): TaskRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('oracle_task_history');
    const history: TaskRecord[] = raw ? JSON.parse(raw) : [];
    return history.filter((t) => t.timestamp >= start && t.timestamp <= end);
  } catch {
    return [];
  }
}

function getQualityScoresForPeriod(start: number, end: number): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('oracle_quality_history');
    const history: Array<{ score: number; timestamp: number }> = raw ? JSON.parse(raw) : [];
    return history
      .filter((h) => h.timestamp >= start && h.timestamp <= end)
      .map((h) => h.score);
  } catch {
    return [];
  }
}

// ─── Storage ───────────────────────────

const REPORT_KEY = 'oracle_monthly_reports';

export function saveReport(report: IntelligenceReport): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(REPORT_KEY);
    const reports: IntelligenceReport[] = raw ? JSON.parse(raw) : [];
    reports.unshift(report);
    localStorage.setItem(REPORT_KEY, JSON.stringify(reports.slice(0, 12))); // Keep last 12 months
  } catch {
    // Silently fail
  }
}

export function getReports(): IntelligenceReport[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REPORT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getLatestReport(): IntelligenceReport | null {
  const reports = getReports();
  return reports.length > 0 ? reports[0] : null;
}
