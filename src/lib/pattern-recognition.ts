// ═══════════════════════════════════════
// ORACLE — Pattern Recognition Engine
// Detect common task types · Pre-load knowledge · Categorise requests
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export type TaskCategory =
  | 'seo-audit'
  | 'ad-copy'
  | 'email-sequence'
  | 'proposal'
  | 'content-calendar'
  | 'website-copy'
  | 'analytics-report'
  | 'whatsapp-campaign'
  | 'brand-identity'
  | 'crm-setup'
  | 'voice-agent'
  | 'chatbot'
  | 'social-media'
  | 'lead-generation'
  | 'pricing'
  | 'strategy'
  | 'research'
  | 'code'
  | 'other';

export interface TaskPattern {
  category: TaskCategory;
  confidence: number;
  keywords: string[];
  knowledgeHints: string[];
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  suggestedTools: string[];
  estimatedTime: string;
}

export interface PatternMatch {
  category: TaskCategory;
  confidence: number;
  matchedKeywords: string[];
  knowledgeHints: string[];
}

// ─── Pattern Database ──────────────────

const PATTERNS: Array<{
  category: TaskCategory;
  keywords: string[];
  knowledgeHints: string[];
  complexity: TaskPattern['estimatedComplexity'];
  tools: string[];
  time: string;
}> = [
  {
    category: 'seo-audit',
    keywords: ['seo', 'search engine', 'ranking', 'keywords', 'backlink', 'meta tag', 'sitemap', 'crawl', 'index', 'on-page', 'off-page', 'technical seo', 'page speed', 'core web vitals'],
    knowledgeHints: ['SEO audit checklist', 'Technical SEO factors', 'Google ranking signals'],
    complexity: 'complex',
    tools: ['Google Search Console', 'Screaming Frog', 'PageSpeed Insights'],
    time: '2-4 hours',
  },
  {
    category: 'ad-copy',
    keywords: ['ad copy', 'google ads', 'meta ads', 'facebook ads', 'instagram ads', 'ppc', 'campaign', 'ad creative', 'headline', 'cta', 'conversion', 'roas', 'ad group'],
    knowledgeHints: ['Ad copywriting formulas', 'Platform ad specs', 'A/B testing framework'],
    complexity: 'moderate',
    tools: ['Google Ads', 'Meta Ads Manager'],
    time: '1-2 hours',
  },
  {
    category: 'email-sequence',
    keywords: ['email', 'nurture', 'drip', 'sequence', 'automation', 'welcome email', 'follow-up', 'open rate', 'click rate', 'newsletter', 'broadcast'],
    knowledgeHints: ['Email sequence templates', 'Subject line formulas', 'Email deliverability best practices'],
    complexity: 'moderate',
    tools: ['Brevo', 'Mailchimp', 'ConvertKit'],
    time: '2-3 hours',
  },
  {
    category: 'proposal',
    keywords: ['proposal', 'quotation', 'estimate', 'pricing', 'scope', 'deliverable', 'timeline', 'contract', 'statement of work', 'sow'],
    knowledgeHints: ['Proposal templates', 'Pricing benchmarks India', 'Scope definition framework'],
    complexity: 'moderate',
    tools: ['PDF export', 'Template engine'],
    time: '1-2 hours',
  },
  {
    category: 'content-calendar',
    keywords: ['content calendar', 'content plan', 'posting schedule', 'social media plan', 'editorial calendar', 'content strategy', '30-day'],
    knowledgeHints: ['Content pillar framework', 'Platform posting frequencies', 'Content mix ratios'],
    complexity: 'moderate',
    tools: ['Buffer', 'Meta Business Suite', 'Canva'],
    time: '2-3 hours',
  },
  {
    category: 'website-copy',
    keywords: ['landing page', 'website copy', 'homepage', 'about page', 'hero section', 'conversion', 'copywriting', 'sales page', 'funnel'],
    knowledgeHints: ['Copywriting frameworks (AIDA, PAS)', 'Landing page structure', 'CTA best practices'],
    complexity: 'moderate',
    tools: ['Framer', 'Webflow', 'Next.js'],
    time: '2-4 hours',
  },
  {
    category: 'analytics-report',
    keywords: ['analytics', 'report', 'dashboard', 'kpi', 'metrics', 'traffic', 'conversion rate', 'bounce rate', 'ga4', 'google analytics'],
    knowledgeHints: ['Key metrics by industry', 'Report template structure', 'Data visualization best practices'],
    complexity: 'moderate',
    tools: ['Google Analytics 4', 'PostHog', 'Looker Studio'],
    time: '1-2 hours',
  },
  {
    category: 'whatsapp-campaign',
    keywords: ['whatsapp', 'broadcast', 'business api', 'chatbot', 'message template', 'catalog'],
    knowledgeHints: ['WhatsApp Business API limits', 'Template message format', 'Broadcast best practices India'],
    complexity: 'moderate',
    tools: ['WhatsApp Business', 'MSG91', 'Razorpay'],
    time: '2-3 hours',
  },
  {
    category: 'brand-identity',
    keywords: ['brand', 'logo', 'visual identity', 'color palette', 'typography', 'brand guidelines', 'brand voice', 'naming'],
    knowledgeHints: ['Brand identity process', 'Logo brief template', 'Brand guidelines structure'],
    complexity: 'complex',
    tools: ['Canva', 'Figma', 'Adobe Express'],
    time: '1-2 weeks',
  },
  {
    category: 'crm-setup',
    keywords: ['crm', 'pipeline', 'contact management', 'lead scoring', 'deal tracking', 'hubspot', 'zoho'],
    knowledgeHints: ['CRM setup checklist', 'Pipeline stage definitions', 'Lead scoring model'],
    complexity: 'complex',
    tools: ['HubSpot', 'Zoho CRM', 'Airtable'],
    time: '3-5 hours',
  },
  {
    category: 'voice-agent',
    keywords: ['voice agent', 'voice bot', 'phone bot', 'ivr', 'voice ai', 'telephony', 'call automation', 'vapi'],
    knowledgeHints: ['Voice agent script framework', 'VAPI setup guide', 'TTS provider comparison'],
    complexity: 'complex',
    tools: ['VAPI', 'Sarvam AI', 'ElevenLabs'],
    time: '1-2 weeks',
  },
  {
    category: 'chatbot',
    keywords: ['chatbot', 'chat bot', 'ai assistant', 'automated replies', 'faq bot', 'support bot', 'intercom'],
    knowledgeHints: ['Chatbot conversation flows', 'FAQ extraction process', 'Handoff to human logic'],
    complexity: 'moderate',
    tools: ['Voiceflow', 'Botpress', 'Custom build'],
    time: '1-2 weeks',
  },
  {
    category: 'social-media',
    keywords: ['social media', 'instagram', 'linkedin', 'facebook', 'twitter', 'reels', 'stories', 'posting', 'engagement', 'followers'],
    knowledgeHints: ['Platform algorithm insights', 'Content format specs', 'Engagement benchmarks India'],
    complexity: 'moderate',
    tools: ['Meta Business Suite', 'Buffer', 'Canva'],
    time: 'Ongoing monthly',
  },
  {
    category: 'lead-generation',
    keywords: ['lead gen', 'leads', 'prospecting', 'cold email', 'cold outreach', 'google maps', 'mining', 'scrape', 'contact list'],
    knowledgeHints: ['Lead gen workflow', 'Personalization framework', 'Follow-up cadence'],
    complexity: 'moderate',
    tools: ['Hunter.io', 'Apollo', 'Google Maps', 'Playwright'],
    time: 'Ongoing',
  },
  {
    category: 'pricing',
    keywords: ['pricing', 'how much to charge', 'rate card', 'packages', 'retainer', 'quote', 'cost estimate', 'budget'],
    knowledgeHints: ['Indian agency pricing benchmarks', 'Value-based pricing', 'Package structure templates'],
    complexity: 'simple',
    tools: ['Pricing calculator'],
    time: '30 minutes',
  },
  {
    category: 'strategy',
    keywords: ['strategy', 'plan', 'roadmap', 'growth', 'marketing plan', 'digital strategy', 'go-to-market', 'gtm'],
    knowledgeHints: ['Strategy frameworks', 'AARRR metrics', 'Competitive analysis template'],
    complexity: 'complex',
    tools: ['Research tools', 'Perplexity'],
    time: '1-2 days',
  },
  {
    category: 'research',
    keywords: ['research', 'analysis', 'competitor', 'market', 'industry', 'trends', 'benchmark', 'survey'],
    knowledgeHints: ['Research methodology', 'Data sources India', 'Analysis frameworks'],
    complexity: 'moderate',
    tools: ['Perplexity', 'Google Trends', 'Crunchbase'],
    time: '2-4 hours',
  },
  {
    category: 'code',
    keywords: ['code', 'build', 'develop', 'implement', 'api', 'database', 'deploy', 'fix bug', 'feature', 'component', 'page'],
    knowledgeHints: ['Tech stack context', 'Coding standards', 'Architecture patterns'],
    complexity: 'moderate',
    tools: ['Claude Code', 'Cursor', 'GitHub'],
    time: 'Varies',
  },
];

// ─── Pattern Matching ──────────────────

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function calculateMatchScore(input: string, keywords: string[]): { score: number; matched: string[] } {
  const words = normalise(input).split(/\s+/);
  const matched: string[] = [];
  let score = 0;

  for (const keyword of keywords) {
    const keywordWords = keyword.split(/\s+/);
    const keywordStr = keywordWords.join(' ');

    // Exact phrase match (highest weight)
    if (normalise(input).includes(keywordStr)) {
      score += 3;
      matched.push(keyword);
      continue;
    }

    // Individual word match
    let allWordsMatch = true;
    let anyWordMatch = false;
    for (const kw of keywordWords) {
      if (words.includes(kw) || (kw.length >= 4 && words.some((w) => w.startsWith(kw.slice(0, 4))))) {
        anyWordMatch = true;
      } else {
        allWordsMatch = false;
      }
    }

    if (allWordsMatch && keywordWords.length > 1) {
      score += 2;
      matched.push(keyword);
    } else if (anyWordMatch) {
      score += 1;
      matched.push(keyword);
    }
  }

  return { score, matched };
}

export function recogniseTaskPatterns(input: string, topN: number = 3): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (const pattern of PATTERNS) {
    const { score, matched } = calculateMatchScore(input, pattern.keywords);
    if (score > 0) {
      // Normalise score to 0-1 based on max possible (3 * matchedKeywords.length)
      const maxScore = Math.min(matched.length, 5) * 3;
      const confidence = Math.min(Math.round((score / Math.max(maxScore, 1)) * 100), 100);
      results.push({
        category: pattern.category,
        confidence,
        matchedKeywords: matched.slice(0, 5),
        knowledgeHints: pattern.knowledgeHints,
      });
    }
  }

  return results
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, topN);
}

// ─── Knowledge Pre-loading ─────────────

export function getKnowledgeHints(category: TaskCategory): string[] {
  const pattern = PATTERNS.find((p) => p.category === category);
  return pattern?.knowledgeHints || [];
}

export function getTaskMeta(category: TaskCategory): {
  complexity: string;
  tools: string[];
  estimatedTime: string;
} | null {
  const pattern = PATTERNS.find((p) => p.category === category);
  if (!pattern) return null;
  return {
    complexity: pattern.complexity,
    tools: pattern.tools,
    estimatedTime: pattern.time,
  };
}

// ─── History Analysis ──────────────────

export function getMostFrequentTasks(
  history: Array<{ category: TaskCategory; timestamp: number }>
): Array<{ category: TaskCategory; count: number; lastUsed: number }> {
  const counts: Record<string, { count: number; lastUsed: number }> = {};

  for (const entry of history) {
    const existing = counts[entry.category];
    if (existing) {
      existing.count++;
      existing.lastUsed = Math.max(existing.lastUsed, entry.timestamp);
    } else {
      counts[entry.category] = { count: 1, lastUsed: entry.timestamp };
    }
  }

  return Object.entries(counts)
    .map(([category, data]) => ({ category: category as TaskCategory, ...data }))
    .sort((a, b) => b.count - a.count);
}

// ─── Storage ───────────────────────────

const TASK_HISTORY_KEY = 'oracle_task_history';

export function recordTask(category: TaskCategory): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(TASK_HISTORY_KEY);
    const history: Array<{ category: TaskCategory; timestamp: number }> = raw ? JSON.parse(raw) : [];
    history.unshift({ category, timestamp: Date.now() });
    localStorage.setItem(TASK_HISTORY_KEY, JSON.stringify(history.slice(0, 500)));
  } catch {
    // Silently fail
  }
}

export function getTaskHistory(): Array<{ category: TaskCategory; timestamp: number }> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TASK_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getPatternStats(): {
  totalTasks: number;
  topCategories: Array<{ category: TaskCategory; count: number }>;
  avgConfidence: number;
} {
  const history = getTaskHistory();
  const freq = getMostFrequentTasks(history);
  return {
    totalTasks: history.length,
    topCategories: freq.slice(0, 5),
    avgConfidence: 75,
  };
}
