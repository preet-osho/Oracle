// ═══════════════════════════════════════
// ORACLE — Project Profitability Tracker
// Revenue vs cost per project · Margin analysis · Profitability scoring
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export interface ProfitabilityData {
  projectId: string;
  clientName: string;
  totalRevenue: number;
  totalCosts: number;
  totalHours: number;
  hourlyRate: number;
  grossMargin: number;
  grossMarginPercent: number;
  roi: number;
  status: 'profitable' | 'breakeven' | 'loss' | 'no-data';
}

export interface CostBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

// ─── Calculation ───────────────────────

export function calculateProfitability(
  projectId: string,
  clientName: string,
  revenue: number,
  costs: CostBreakdown[],
  totalHours: number
): ProfitabilityData {
  const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0);
  const hourlyRate = totalHours > 0 ? revenue / totalHours : 0;
  const grossMargin = revenue - totalCosts;
  const grossMarginPercent = revenue > 0 ? (grossMargin / revenue) * 100 : 0;
  const roi = totalCosts > 0 ? ((revenue - totalCosts) / totalCosts) * 100 : 0;

  let status: ProfitabilityData['status'] = 'no-data';
  if (revenue > 0 || totalCosts > 0) {
    if (grossMargin > 0) status = 'profitable';
    else if (grossMargin === 0) status = 'breakeven';
    else status = 'loss';
  }

  return {
    projectId,
    clientName,
    totalRevenue: revenue,
    totalCosts,
    totalHours,
    hourlyRate: Math.round(hourlyRate * 100) / 100,
    grossMargin: Math.round(grossMargin * 100) / 100,
    grossMarginPercent: Math.round(grossMarginPercent * 10) / 10,
    roi: Math.round(roi * 10) / 10,
    status,
  };
}

export function getMarginColor(marginPercent: number): string {
  if (marginPercent >= 40) return 'var(--oracle-success)';
  if (marginPercent >= 20) return 'var(--oracle-warning)';
  return 'var(--oracle-error)';
}

export function getMarginLabel(marginPercent: number): string {
  if (marginPercent >= 60) return 'Excellent';
  if (marginPercent >= 40) return 'Good';
  if (marginPercent >= 20) return 'Fair';
  if (marginPercent >= 0) return 'Low';
  return 'Loss';
}

export function getROIIcon(roi: number): string {
  if (roi >= 100) return '🔥';
  if (roi >= 50) return '✅';
  if (roi >= 0) return '➡️';
  return '⚠️';
}

// ─── Aggregation ───────────────────────

export function aggregateProfitability(items: ProfitabilityData[]): {
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  avgMargin: number;
  avgROI: number;
  profitableCount: number;
  lossCount: number;
  breakevenCount: number;
  bestProject: ProfitabilityData | null;
  worstProject: ProfitabilityData | null;
} {
  if (items.length === 0) {
    return {
      totalRevenue: 0, totalCosts: 0, totalProfit: 0,
      avgMargin: 0, avgROI: 0, profitableCount: 0,
      lossCount: 0, breakevenCount: 0,
      bestProject: null, worstProject: null,
    };
  }

  const totalRevenue = items.reduce((s, p) => s + p.totalRevenue, 0);
  const totalCosts = items.reduce((s, p) => s + p.totalCosts, 0);
  const totalProfit = totalRevenue - totalCosts;
  const avgMargin = items.length > 0
    ? items.reduce((s, p) => s + p.grossMarginPercent, 0) / items.length
    : 0;
  const avgROI = items.length > 0
    ? items.reduce((s, p) => s + p.roi, 0) / items.length
    : 0;

  return {
    totalRevenue,
    totalCosts,
    totalProfit: Math.round(totalProfit * 100) / 100,
    avgMargin: Math.round(avgMargin * 10) / 10,
    avgROI: Math.round(avgROI * 10) / 10,
    profitableCount: items.filter((p) => p.status === 'profitable').length,
    lossCount: items.filter((p) => p.status === 'loss').length,
    breakevenCount: items.filter((p) => p.status === 'breakeven').length,
    bestProject: items.reduce((best, p) => p.grossMarginPercent > (best?.grossMarginPercent ?? -Infinity) ? p : best, null as ProfitabilityData | null),
    worstProject: items.reduce((worst, p) => p.grossMarginPercent < (worst?.grossMarginPercent ?? Infinity) ? p : worst, null as ProfitabilityData | null),
  };
}
