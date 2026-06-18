// ═══════════════════════════════════════
// ORACLE — Client Satisfaction Tracker
// NPS per project · Feedback collection · Satisfaction scoring
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export type NPSCategory = 'promoter' | 'passive' | 'detractor';
export type SatisfactionDimension = 'quality' | 'communication' | 'timeliness' | 'value' | 'overall';

export interface SatisfactionEntry {
  id: string;
  projectId: string;
  clientName: string;
  nps: number; // 0-10
  dimension: SatisfactionDimension;
  rating: number; // 1-5
  feedback: string;
  timestamp: number;
  surveySentAt: number;
  respondedAt?: number;
}

export interface NPSResult {
  score: number; // -100 to 100
  category: NPSCategory;
  promoters: number;
  passives: number;
  detractors: number;
  total: number;
  responseRate: number;
}

export interface ClientSatisfactionSummary {
  clientName: string;
  overallNPS: number;
  npsCategory: NPSCategory;
  avgRating: number;
  totalResponses: number;
  dimensionScores: Record<SatisfactionDimension, number>;
  trend: 'improving' | 'stable' | 'declining';
  lastFeedback: string;
}

// ─── NPS Calculation ───────────────────

export function calculateNPS(responses: number[]): NPSResult {
  if (responses.length === 0) {
    return { score: 0, category: 'passive', promoters: 0, passives: 0, detractors: 0, total: 0, responseRate: 0 };
  }

  const promoters = responses.filter((r) => r >= 9).length;
  const passives = responses.filter((r) => r >= 7 && r <= 8).length;
  const detractors = responses.filter((r) => r <= 6).length;
  const total = responses.length;

  const score = Math.round(((promoters - detractors) / total) * 100);

  let category: NPSCategory;
  if (score >= 50) category = 'promoter';
  else if (score >= 0) category = 'passive';
  else category = 'detractor';

  return { score, category, promoters, passives, detractors, total, responseRate: 100 };
}

export function getNPSCategoryLabel(category: NPSCategory): string {
  switch (category) {
    case 'promoter': return 'Excellent';
    case 'passive': return 'Good';
    case 'detractor': return 'Needs Improvement';
  }
}

export function getNPSCategoryColor(category: NPSCategory): string {
  switch (category) {
    case 'promoter': return 'var(--oracle-success)';
    case 'passive': return 'var(--oracle-warning)';
    case 'detractor': return 'var(--oracle-error)';
  }
}

export function getNPSColor(score: number): string {
  if (score >= 50) return 'var(--oracle-success)';
  if (score >= 0) return 'var(--oracle-warning)';
  return 'var(--oracle-error)';
}

// ─── Rating Helpers ────────────────────

export function getDimensionLabel(dimension: SatisfactionDimension): string {
  switch (dimension) {
    case 'quality': return 'Quality of Work';
    case 'communication': return 'Communication';
    case 'timeliness': return 'Timeliness';
    case 'value': return 'Value for Money';
    case 'overall': return 'Overall Satisfaction';
  }
}

export function getDimensionEmoji(dimension: SatisfactionDimension): string {
  switch (dimension) {
    case 'quality': return '⭐';
    case 'communication': return '💬';
    case 'timeliness': return '⏰';
    case 'value': return '💰';
    case 'overall': return '🎯';
  }
}

export function getRatingLabel(rating: number): string {
  if (rating >= 4.5) return 'Excellent';
  if (rating >= 3.5) return 'Good';
  if (rating >= 2.5) return 'Average';
  if (rating >= 1.5) return 'Below Average';
  return 'Poor';
}

// ─── Storage ───────────────────────────

const SATISFACTION_KEY = 'oracle_satisfaction';

export function addSatisfactionEntry(
  entry: Omit<SatisfactionEntry, 'id' | 'timestamp'>
): SatisfactionEntry {
  const full: SatisfactionEntry = {
    ...entry,
    id: `sat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  };

  if (typeof window === 'undefined') return full;
  try {
    const raw = localStorage.getItem(SATISFACTION_KEY);
    const entries: SatisfactionEntry[] = raw ? JSON.parse(raw) : [];
    entries.unshift(full);
    localStorage.setItem(SATISFACTION_KEY, JSON.stringify(entries.slice(0, 1000)));
  } catch {
    // Silently fail
  }
  return full;
}

export function getSatisfactionEntries(projectId?: string): SatisfactionEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SATISFACTION_KEY);
    const entries: SatisfactionEntry[] = raw ? JSON.parse(raw) : [];
    if (projectId) return entries.filter((e) => e.projectId === projectId);
    return entries;
  } catch {
    return [];
  }
}

export function getClientSummary(clientName: string): ClientSatisfactionSummary {
  const entries = getSatisfactionEntries().filter((e) => e.clientName === clientName);

  if (entries.length === 0) {
    return {
      clientName,
      overallNPS: 0,
      npsCategory: 'passive',
      avgRating: 0,
      totalResponses: 0,
      dimensionScores: {} as Record<SatisfactionDimension, number>,
      trend: 'stable',
      lastFeedback: '',
    };
  }

  const npsScores = entries.filter((e) => e.dimension === 'overall').map((e) => e.nps);
  const nps = calculateNPS(npsScores.length > 0 ? npsScores : entries.map((e) => e.nps));

  const avgRating = entries.reduce((s, e) => s + e.rating, 0) / entries.length;

  const dimensionScores = {} as Record<SatisfactionDimension, number>;
  for (const dim of ['quality', 'communication', 'timeliness', 'value', 'overall'] as SatisfactionDimension[]) {
    const dimEntries = entries.filter((e) => e.dimension === dim);
    dimensionScores[dim] = dimEntries.length > 0
      ? Math.round((dimEntries.reduce((s, e) => s + e.rating, 0) / dimEntries.length) * 10) / 10
      : 0;
  }

  // Trend
  let trend: ClientSatisfactionSummary['trend'] = 'stable';
  if (entries.length >= 2) {
    const recentHalf = entries.slice(0, Math.floor(entries.length / 2));
    const olderHalf = entries.slice(Math.floor(entries.length / 2));
    const recentAvg = recentHalf.reduce((s, e) => s + e.rating, 0) / recentHalf.length;
    const olderAvg = olderHalf.reduce((s, e) => s + e.rating, 0) / olderHalf.length;
    if (recentAvg > olderAvg + 0.3) trend = 'improving';
    else if (recentAvg < olderAvg - 0.3) trend = 'declining';
  }

  return {
    clientName,
    overallNPS: nps.score,
    npsCategory: nps.category,
    avgRating: Math.round(avgRating * 10) / 10,
    totalResponses: entries.length,
    dimensionScores,
    trend,
    lastFeedback: entries[0]?.feedback || '',
  };
}

export function getOverallSatisfaction(): {
  avgNPS: number;
  avgRating: number;
  totalResponses: number;
  promoterPercent: number;
  detractorPercent: number;
  topDimension: string;
  bottomDimension: string;
} {
  const entries = getSatisfactionEntries();
  if (entries.length === 0) {
    return { avgNPS: 0, avgRating: 0, totalResponses: 0, promoterPercent: 0, detractorPercent: 0, topDimension: 'N/A', bottomDimension: 'N/A' };
  }

  const nps = calculateNPS(entries.map((e) => e.nps));
  const avgRating = entries.reduce((s, e) => s + e.rating, 0) / entries.length;

  const dimScores: Record<string, number[]> = {};
  for (const e of entries) {
    if (!dimScores[e.dimension]) dimScores[e.dimension] = [];
    dimScores[e.dimension].push(e.rating);
  }

  const dimAvgs = Object.entries(dimScores).map(([dim, scores]) => ({
    dim,
    avg: scores.reduce((s, r) => s + r, 0) / scores.length,
  }));

  const topDimension = dimAvgs.sort((a, b) => b.avg - a.avg)[0]?.dim || 'N/A';
  const bottomDimension = dimAvgs.sort((a, b) => a.avg - b.avg)[0]?.dim || 'N/A';

  return {
    avgNPS: nps.score,
    avgRating: Math.round(avgRating * 10) / 10,
    totalResponses: entries.length,
    promoterPercent: Math.round((nps.promoters / Math.max(nps.total, 1)) * 100),
    detractorPercent: Math.round((nps.detractors / Math.max(nps.total, 1)) * 100),
    topDimension,
    bottomDimension,
  };
}
