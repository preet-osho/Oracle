// ═══════════════════════════════════════
// ORACLE — Proactive Intelligence Engine
// Flag risks · Suggest improvements · Identify gaps without being asked
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type InsightCategory = 'risk' | 'opportunity' | 'optimisation' | 'gap' | 'trend';

export interface ProactiveInsight {
  id: string;
  category: InsightCategory;
  severity: RiskSeverity;
  title: string;
  description: string;
  actionable: boolean;
  suggestedAction?: string;
  source: string;
  timestamp: number;
  dismissed: boolean;
}

export interface ProjectHealthCheck {
  projectId: string;
  overallScore: number;
  risks: ProactiveInsight[];
  opportunities: ProactiveInsight[];
  lastChecked: number;
}

// ─── Risk Detection Rules ──────────────

const RISK_RULES: Array<{
  id: string;
  title: string;
  check: (context: Record<string, unknown>) => boolean;
  severity: RiskSeverity;
  description: string;
  action: string;
}> = [
  {
    id: 'no-web-presence',
    title: 'No Web Presence Detected',
    check: (ctx) => !ctx.hasWebsite && ctx.clientType === 'business',
    severity: 'high',
    description: 'Client has no website. This limits their online discoverability and credibility.',
    action: 'Suggest website development service with a landing page as a starting point.',
  },
  {
    id: 'low-google-rating',
    title: 'Low Google Rating',
    check: (ctx) => typeof ctx.googleRating === 'number' && ctx.googleRating < 3.5,
    severity: 'high',
    description: `Client's Google rating is below 3.5 stars, which significantly impacts local SEO and trust.`,
    action: 'Recommend review management service and identify negative review patterns.',
  },
  {
    id: 'no-seo-tracking',
    title: 'No SEO Tracking',
    check: (ctx) => ctx.hasWebsite === true && !ctx.hasGSC,
    severity: 'medium',
    description: 'Client has a website but no Google Search Console tracking. Missing critical SEO data.',
    action: 'Set up GSC and propose a monthly SEO reporting retainer.',
  },
  {
    id: 'inactive-social',
    title: 'Inactive Social Media',
    check: (ctx) => Array.isArray(ctx.socialPlatforms) && ctx.socialPlatforms.length === 0,
    severity: 'medium',
    description: 'Client has no active social media presence. Missing engagement opportunities.',
    action: 'Propose social media management package starting with 2 platforms.',
  },
  {
    id: 'overdue-invoice',
    title: 'Overdue Invoice',
    check: (ctx) => typeof ctx.overdueInvoiceCount === 'number' && ctx.overdueInvoiceCount > 0,
    severity: 'critical',
    description: 'Client has overdue invoice(s). Cash flow at risk.',
    action: 'Send payment reminder and consider pausing work until payment is received.',
  },
  {
    id: 'no-email-marketing',
    title: 'No Email Marketing',
    check: (ctx) => ctx.hasWebsite === true && !ctx.hasEmailMarketing,
    severity: 'low',
    description: 'Client has a website but no email capture or marketing. Missing lead nurturing.',
    action: 'Suggest email marketing setup with a lead magnet and nurture sequence.',
  },
  {
    id: 'single-channel-dependency',
    title: 'Single Channel Dependency',
    check: (ctx) => Array.isArray(ctx.activeChannels) && ctx.activeChannels.length <= 1,
    severity: 'medium',
    description: 'Client relies on a single marketing channel. High risk if that channel underperforms.',
    action: 'Recommend diversifying to at least 2-3 marketing channels.',
  },
  {
    id: 'no-tracking-setup',
    title: 'No Analytics Tracking',
    check: (ctx) => ctx.hasWebsite === true && !ctx.hasGA4,
    severity: 'high',
    description: 'Client has a website but no Google Analytics. Cannot measure marketing ROI.',
    action: 'Set up GA4 with conversion tracking and propose monthly reporting.',
  },
];

// ─── Opportunity Detection ─────────────

const OPPORTUNITY_RULES: Array<{
  id: string;
  title: string;
  check: (context: Record<string, unknown>) => boolean;
  description: string;
  action: string;
}> = [
  {
    id: 'competitor-weak-digital',
    title: 'Competitor Has Weak Digital Presence',
    check: (ctx) => ctx.competitorWeakDigital === true,
    description: 'Competitors have weak digital presence. First-mover advantage available.',
    action: 'Create a competitive digital strategy to capture market share.',
  },
  {
    id: 'seasonal-opportunity',
    title: 'Seasonal Marketing Window',
    check: (ctx) => ctx.isSeasonalWindow === true,
    description: 'Upcoming seasonal event relevant to client industry. Plan campaigns now.',
    action: 'Develop seasonal campaign brief with budget and timeline.',
  },
  {
    id: 'expansion-potential',
    title: 'Expansion Potential',
    check: (ctx) => typeof ctx.revenueGrowth === 'number' && ctx.revenueGrowth > 20,
    description: 'Client revenue growing >20%. They may need expanded services.',
    action: 'Schedule a strategy meeting to discuss growth-stage marketing needs.',
  },
  {
    id: 'content-gap',
    title: 'Content Gap Opportunity',
    check: (ctx) => ctx.blogPostCount === 0 && ctx.hasWebsite === true,
    description: 'Client has a website with no blog content. Huge organic traffic potential.',
    action: 'Propose content marketing package targeting industry keywords.',
  },
];

// ─── Engine ────────────────────────────

export function detectRisks(context: Record<string, unknown>): ProactiveInsight[] {
  const insights: ProactiveInsight[] = [];

  for (const rule of RISK_RULES) {
    try {
      if (rule.check(context)) {
        insights.push({
          id: `risk-${rule.id}-${Date.now()}`,
          category: 'risk',
          severity: rule.severity,
          title: rule.title,
          description: rule.description,
          actionable: true,
          suggestedAction: rule.action,
          source: 'risk-detection-engine',
          timestamp: Date.now(),
          dismissed: false,
        });
      }
    } catch {
      // Rule failed, skip
    }
  }

  return insights;
}

export function detectOpportunities(context: Record<string, unknown>): ProactiveInsight[] {
  const insights: ProactiveInsight[] = [];

  for (const rule of OPPORTUNITY_RULES) {
    try {
      if (rule.check(context)) {
        insights.push({
          id: `opp-${rule.id}-${Date.now()}`,
          category: 'opportunity',
          severity: 'low',
          title: rule.title,
          description: rule.description,
          actionable: true,
          suggestedAction: rule.action,
          source: 'opportunity-detection-engine',
          timestamp: Date.now(),
          dismissed: false,
        });
      }
    } catch {
      // Rule failed, skip
    }
  }

  return insights;
}

export function generateHealthCheck(
  projectId: string,
  context: Record<string, unknown>
): ProjectHealthCheck {
  const risks = detectRisks(context);
  const opportunities = detectOpportunities(context);

  const criticalCount = risks.filter((r) => r.severity === 'critical').length;
  const highCount = risks.filter((r) => r.severity === 'high').length;
  const mediumCount = risks.filter((r) => r.severity === 'medium').length;

  let overallScore = 100;
  overallScore -= criticalCount * 25;
  overallScore -= highCount * 15;
  overallScore -= mediumCount * 5;
  overallScore += opportunities.length * 3;

  return {
    projectId,
    overallScore: Math.max(0, Math.min(100, overallScore)),
    risks,
    opportunities,
    lastChecked: Date.now(),
  };
}

// ─── Insight Storage ───────────────────

const INSIGHTS_KEY = 'oracle_proactive_insights';

export function saveInsights(insights: ProactiveInsight[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INSIGHTS_KEY, JSON.stringify(insights.slice(0, 200)));
  } catch {
    // Silently fail
  }
}

export function getInsights(): ProactiveInsight[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(INSIGHTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function dismissInsight(id: string): void {
  const insights = getInsights().map((i) => i.id === id ? { ...i, dismissed: true } : i);
  saveInsights(insights);
}

export function getActiveInsights(): ProactiveInsight[] {
  return getInsights().filter((i) => !i.dismissed);
}
