// ═══════════════════════════════════════
// ORACLE — Self-Training Loop
// Auto-update learnings after tasks · Pattern recognition · Knowledge accumulation
// ═══════════════════════════════════════

import type { QualityScore, HallucinationCheckResult } from '@/types';

// ─── Types ─────────────────────────────

export interface LearningEntry {
  id: string;
  timestamp: number;
  taskType: string;
  domain: string;
  promptPreview: string;
  responsePreview: string;
  qualityScore?: QualityScore;
  confidence?: number;
  provider: string;
  model: string;
  wasSuccessful: boolean;
  tags: string[];
}

export interface PatternInsight {
  pattern: string;
  count: number;
  avgQuality: number;
  recommendation: string;
}

export interface TrainingSummary {
  totalTasks: number;
  successRate: number;
  avgQuality: number;
  avgConfidence: number;
  topPatterns: PatternInsight[];
  domainPerformance: Record<string, { count: number; avgQuality: number }>;
  modelPerformance: Record<string, { count: number; avgQuality: number }>;
  recentTrend: 'improving' | 'stable' | 'declining';
}

// ─── Storage ───────────────────────────

const TRAINING_KEY = 'oracle_self_training';
const MAX_ENTRIES = 500;

export function recordTask(entry: Omit<LearningEntry, 'id' | 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(TRAINING_KEY);
    const entries: LearningEntry[] = raw ? JSON.parse(raw) : [];
    entries.unshift({
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    });
    localStorage.setItem(TRAINING_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Silently fail
  }
}

export function getTrainingEntries(): LearningEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRAINING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearTrainingData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TRAINING_KEY);
}

// ─── Analysis ──────────────────────────

export function getTrainingSummary(entries?: LearningEntry[]): TrainingSummary {
  const data = entries || getTrainingEntries();

  if (data.length === 0) {
    return {
      totalTasks: 0,
      successRate: 0,
      avgQuality: 0,
      avgConfidence: 0,
      topPatterns: [],
      domainPerformance: {},
      modelPerformance: {},
      recentTrend: 'stable',
    };
  }

  const totalTasks = data.length;
  const successful = data.filter((e) => e.wasSuccessful);
  const successRate = Math.round((successful.length / totalTasks) * 100);

  const qualities = data.filter((e) => e.qualityScore).map((e) => e.qualityScore!.total);
  const avgQuality = qualities.length > 0
    ? Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length)
    : 0;

  const confidences = data.filter((e) => typeof e.confidence === 'number').map((e) => e.confidence!);
  const avgConfidence = confidences.length > 0
    ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
    : 0;

  // Domain performance
  const domainPerf: Record<string, { count: number; totalQuality: number }> = {};
  for (const entry of data) {
    const domain = entry.domain || 'general';
    if (!domainPerf[domain]) domainPerf[domain] = { count: 0, totalQuality: 0 };
    domainPerf[domain].count++;
    if (entry.qualityScore) domainPerf[domain].totalQuality += entry.qualityScore.total;
  }
  const domainPerformance: Record<string, { count: number; avgQuality: number }> = {};
  for (const [domain, perf] of Object.entries(domainPerf)) {
    domainPerformance[domain] = {
      count: perf.count,
      avgQuality: perf.count > 0 ? Math.round(perf.totalQuality / perf.count) : 0,
    };
  }

  // Model performance
  const modelPerf: Record<string, { count: number; totalQuality: number }> = {};
  for (const entry of data) {
    const key = `${entry.provider}/${entry.model}`;
    if (!modelPerf[key]) modelPerf[key] = { count: 0, totalQuality: 0 };
    modelPerf[key].count++;
    if (entry.qualityScore) modelPerf[key].totalQuality += entry.qualityScore.total;
  }
  const modelPerformance: Record<string, { count: number; avgQuality: number }> = {};
  for (const [model, perf] of Object.entries(modelPerf)) {
    modelPerformance[model] = {
      count: perf.count,
      avgQuality: perf.count > 0 ? Math.round(perf.totalQuality / perf.count) : 0,
    };
  }

  // Pattern detection from tags
  const tagCounts = new Map<string, { count: number; totalQuality: number }>();
  for (const entry of data) {
    for (const tag of entry.tags) {
      const current = tagCounts.get(tag) || { count: 0, totalQuality: 0 };
      current.count++;
      if (entry.qualityScore) current.totalQuality += entry.qualityScore.total;
      tagCounts.set(tag, current);
    }
  }
  const topPatterns: PatternInsight[] = Array.from(tagCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([pattern, stats]) => ({
      pattern,
      count: stats.count,
      avgQuality: stats.count > 0 ? Math.round(stats.totalQuality / stats.count) : 0,
      recommendation: stats.count > 5 ? 'Consider optimizing this task type' : 'Gathering data',
    }));

  // Trend analysis
  let recentTrend: TrainingSummary['recentTrend'] = 'stable';
  if (data.length >= 6) {
    const mid = Math.floor(data.length / 2);
    const recent = data.slice(0, mid);
    const older = data.slice(mid);
    const recentQualities = recent.filter((e) => e.qualityScore).map((e) => e.qualityScore!.total);
    const olderQualities = older.filter((e) => e.qualityScore).map((e) => e.qualityScore!.total);
    if (recentQualities.length > 0 && olderQualities.length > 0) {
      const recentAvg = recentQualities.reduce((a, b) => a + b, 0) / recentQualities.length;
      const olderAvg = olderQualities.reduce((a, b) => a + b, 0) / olderQualities.length;
      if (recentAvg - olderAvg > 3) recentTrend = 'improving';
      else if (olderAvg - recentAvg > 3) recentTrend = 'declining';
    }
  }

  return {
    totalTasks,
    successRate,
    avgQuality,
    avgConfidence,
    topPatterns,
    domainPerformance,
    modelPerformance,
    recentTrend,
  };
}

// ─── LEARNINGS.md Generator ────────────

export function generateLearningsMarkdown(): string {
  const summary = getTrainingSummary();
  if (summary.totalTasks === 0) return '# ORACLE Learnings\n\nNo data yet.';

  const lines: string[] = [
    '# ORACLE Learnings',
    `*Auto-generated · ${summary.totalTasks} tasks tracked*`,
    '',
    '## Performance Summary',
    `- Success rate: ${summary.successRate}%`,
    `- Average quality: ${summary.avgQuality}/100`,
    `- Average confidence: ${summary.avgConfidence}%`,
    `- Trend: ${summary.recentTrend}`,
    '',
  ];

  if (summary.topPatterns.length > 0) {
    lines.push('## Common Patterns');
    for (const p of summary.topPatterns) {
      lines.push(`- **${p.pattern}**: ${p.count} occurrences, avg quality ${p.avgQuality}/100 — ${p.recommendation}`);
    }
    lines.push('');
  }

  if (Object.keys(summary.domainPerformance).length > 0) {
    lines.push('## Domain Performance');
    const sorted = Object.entries(summary.domainPerformance).sort((a, b) => b[1].count - a[1].count);
    for (const [domain, perf] of sorted) {
      lines.push(`- **${domain}**: ${perf.count} tasks, avg quality ${perf.avgQuality}/100`);
    }
    lines.push('');
  }

  if (Object.keys(summary.modelPerformance).length > 0) {
    lines.push('## Model Performance');
    const sorted = Object.entries(summary.modelPerformance).sort((a, b) => b[1].count - a[1].count);
    for (const [model, perf] of sorted) {
      lines.push(`- **${model}**: ${perf.count} uses, avg quality ${perf.avgQuality}/100`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*This file is auto-updated by ORACLE\'s self-training loop.*');

  return lines.join('\n');
}

export function exportLearnings(): void {
  const markdown = generateLearningsMarkdown();
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'LEARNINGS.md';
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
