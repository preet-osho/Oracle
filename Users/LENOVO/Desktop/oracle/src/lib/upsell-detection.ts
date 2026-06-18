// ═══════════════════════════════════════
// ORACLE — Upsell Detection Engine
// Suggest next natural service · Track completion patterns · Revenue maximisation
// ═══════════════════════════════════════

import type { TaskCategory } from './pattern-recognition';

// ─── Types ─────────────────────────────

export interface UpsellSuggestion {
  id: string;
  triggerService: string;
  suggestedService: string;
  timing: 'immediate' | 'after-completion' | 'monthly-review' | 'quarterly-review';
  message: string;
  estimatedValue: string;
  conversionProbability: number; // 0-100
  priority: 'low' | 'medium' | 'high';
}

// ─── Upsell Rules ──────────────────────

const UPSELL_RULES: Array<{
  triggerCategories: TaskCategory[];
  suggestedService: string;
  timing: UpsellSuggestion['timing'];
  message: string;
  value: string;
  probability: number;
  priority: UpsellSuggestion['priority'];
}> = [
  // After website launch
  {
    triggerCategories: ['code'],
    suggestedService: 'SEO Setup & Optimisation',
    timing: 'immediate',
    message: 'Your website is live! Now let\'s make sure people can find it. I recommend setting up technical SEO from day one.',
    value: '₹8,000-18,000/month',
    probability: 80,
    priority: 'high',
  },
  {
    triggerCategories: ['code'],
    suggestedService: 'Analytics & Tracking Setup',
    timing: 'immediate',
    message: 'Great website! Let\'s set up GA4 and conversion tracking so you can measure what\'s working.',
    value: '₹5,000-10,000 one-time',
    probability: 85,
    priority: 'high',
  },
  // After SEO
  {
    triggerCategories: ['seo-audit'],
    suggestedService: 'Content Marketing',
    timing: 'after-completion',
    message: 'The SEO audit is done. Now let\'s create content targeting the keywords we identified to improve rankings.',
    value: '₹10,000-25,000/month',
    probability: 70,
    priority: 'medium',
  },
  {
    triggerCategories: ['seo-audit'],
    suggestedService: 'Technical SEO Fix Implementation',
    timing: 'immediate',
    message: 'I found several technical issues. Would you like me to fix them? This will improve your Core Web Vitals scores.',
    value: '₹5,000-15,000 one-time',
    probability: 75,
    priority: 'high',
  },
  // After ad campaigns
  {
    triggerCategories: ['ad-copy'],
    suggestedService: 'Landing Page Optimisation',
    timing: 'after-completion',
    message: 'The ad copy is ready! To maximise conversions, let\'s create a dedicated landing page for this campaign.',
    value: '₹8,000-15,000 one-time',
    probability: 65,
    priority: 'medium',
  },
  {
    triggerCategories: ['ad-copy'],
    suggestedService: 'A/B Testing Framework',
    timing: 'monthly-review',
    message: 'The ads have been running for a month. Let\'s set up A/B testing to improve performance by 20-30%.',
    value: '₹5,000-10,000 setup',
    probability: 60,
    priority: 'medium',
  },
  // After content
  {
    triggerCategories: ['content-calendar'],
    suggestedService: 'Social Media Distribution',
    timing: 'immediate',
    message: 'Content calendar is ready! Let\'s set up automated distribution across your social channels.',
    value: '₹8,000-18,000/month',
    probability: 70,
    priority: 'medium',
  },
  {
    triggerCategories: ['content-calendar'],
    suggestedService: 'Email Newsletter',
    timing: 'after-completion',
    message: 'Great content plan! Let\'s repurpose this into a weekly newsletter to nurture your email list.',
    value: '₹5,000-12,000/month',
    probability: 55,
    priority: 'low',
  },
  // After email
  {
    triggerCategories: ['email-sequence'],
    suggestedService: 'CRM Integration',
    timing: 'after-completion',
    message: 'Email sequences are set up. Let\'s connect them to a CRM so your sales team gets notified of hot leads.',
    value: '₹10,000-25,000 setup',
    probability: 65,
    priority: 'medium',
  },
  // After analytics
  {
    triggerCategories: ['analytics-report'],
    suggestedService: 'Conversion Rate Optimisation',
    timing: 'monthly-review',
    message: 'Based on the analytics, I see opportunities to improve your conversion rate by 15-25%. Shall I create a CRO plan?',
    value: '₹8,000-15,000/month',
    probability: 60,
    priority: 'medium',
  },
  // After social media
  {
    triggerCategories: ['social-media'],
    suggestedService: 'Paid Social Ads',
    timing: 'monthly-review',
    message: 'Organic performance is great! Let\'s amplify the top-performing posts with paid promotion for 3-5x reach.',
    value: '₹6,000-15,000/month + ad spend',
    probability: 70,
    priority: 'medium',
  },
  // After lead gen
  {
    triggerCategories: ['lead-generation'],
    suggestedService: 'Lead Nurturing Automation',
    timing: 'immediate',
    message: 'Leads are flowing in! Let\'s set up automated nurturing sequences so none go cold.',
    value: '₹10,000-20,000 setup + ₹5,000/month',
    probability: 75,
    priority: 'high',
  },
  // After CRM
  {
    triggerCategories: ['crm-setup'],
    suggestedService: 'Sales Process Automation',
    timing: 'after-completion',
    message: 'CRM is set up! Now let\'s automate follow-ups, reminders, and deal stage transitions.',
    value: '₹8,000-15,000 setup',
    probability: 65,
    priority: 'medium',
  },
  // After brand identity
  {
    triggerCategories: ['brand-identity'],
    suggestedService: 'Complete Digital Brand Rollout',
    timing: 'immediate',
    message: 'Brand guidelines are ready! Let\'s apply them across your website, social profiles, and marketing materials.',
    value: '₹15,000-30,000 one-time',
    probability: 70,
    priority: 'medium',
  },
  // Quarterly reviews
  {
    triggerCategories: ['analytics-report'],
    suggestedService: 'Competitive Analysis',
    timing: 'quarterly-review',
    message: 'It\'s been a quarter! Time for a competitive analysis to see how you stack up and find new opportunities.',
    value: '₹15,000-30,000 one-time',
    probability: 50,
    priority: 'low',
  },
];

// ─── Engine ────────────────────────────

export function detectUpsellOpportunities(
  completedCategory: TaskCategory,
  activeServices: string[] = [],
  projectAge?: number // months
): UpsellSuggestion[] {
  const suggestions: UpsellSuggestion[] = [];

  for (const rule of UPSELL_RULES) {
    if (rule.triggerCategories.includes(completedCategory)) {
      // Check if service is already active
      const isAlreadyActive = activeServices.some((s) =>
        s.toLowerCase().includes(rule.suggestedService.toLowerCase().slice(0, 8))
      );
      if (isAlreadyActive) continue;

      suggestions.push({
        id: `upsell-${completedCategory}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        triggerService: completedCategory,
        suggestedService: rule.suggestedService,
        timing: rule.timing,
        message: rule.message,
        estimatedValue: rule.value,
        conversionProbability: rule.probability,
        priority: rule.priority,
      });
    }
  }

  // Add quarterly review suggestions for mature projects
  if (projectAge && projectAge >= 3) {
    suggestions.push({
      id: `quarterly-${Date.now()}`,
      triggerService: 'project-milestone',
      suggestedService: 'Quarterly Performance Review & Strategy Update',
      timing: 'quarterly-review',
      message: `This project is ${projectAge} months old. Time for a comprehensive review to optimise strategy and identify new growth opportunities.`,
      estimatedValue: '₹10,000-20,000/quarter',
      conversionProbability: 45,
      priority: 'low',
    });
  }

  return suggestions.sort((a, b) => b.conversionProbability - a.conversionProbability);
}

export function getHighestValueSuggestion(
  suggestions: UpsellSuggestion[]
): UpsellSuggestion | null {
  if (suggestions.length === 0) return null;
  return suggestions.reduce((best, s) =>
    s.conversionProbability > best.conversionProbability ? s : best
  );
}

// ─── Storage ───────────────────────────

const UPSELL_HISTORY_KEY = 'oracle_upsell_history';

export function recordUpsellSuggestion(suggestion: UpsellSuggestion): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(UPSELL_HISTORY_KEY);
    const history: Array<{ suggestion: UpsellSuggestion; accepted: boolean; timestamp: number }> = raw ? JSON.parse(raw) : [];
    history.unshift({ suggestion, accepted: false, timestamp: Date.now() });
    localStorage.setItem(UPSELL_HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
  } catch {
    // Silently fail
  }
}

export function recordUpsellAccepted(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(UPSELL_HISTORY_KEY);
    const history: Array<{ suggestion: UpsellSuggestion; accepted: boolean; timestamp: number }> = raw ? JSON.parse(raw) : [];
    const updated = history.map((h) =>
      h.suggestion.id === id ? { ...h, accepted: true } : h
    );
    localStorage.setItem(UPSELL_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail
  }
}

export function getUpsellStats(): {
  totalSuggestions: number;
  accepted: number;
  conversionRate: number;
  totalRevenue: number;
} {
  if (typeof window === 'undefined') return { totalSuggestions: 0, accepted: 0, conversionRate: 0, totalRevenue: 0 };
  try {
    const raw = localStorage.getItem(UPSELL_HISTORY_KEY);
    const history: Array<{ suggestion: UpsellSuggestion; accepted: boolean; timestamp: number }> = raw ? JSON.parse(raw) : [];
    const accepted = history.filter((h) => h.accepted).length;
    return {
      totalSuggestions: history.length,
      accepted,
      conversionRate: history.length > 0 ? Math.round((accepted / history.length) * 100) : 0,
      totalRevenue: 0, // Would need to track actual revenue from accepted upsells
    };
  } catch {
    return { totalSuggestions: 0, accepted: 0, conversionRate: 0, totalRevenue: 0 };
  }
}
