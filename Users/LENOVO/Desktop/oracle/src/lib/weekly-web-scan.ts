// ═══════════════════════════════════════
// ORACLE — Weekly Web Scan Engine
// Auto-learn new tools · Track discoveries · Intelligence updates
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export type ToolCategory =
  | 'ai-model'
  | 'design'
  | 'development'
  | 'marketing'
  | 'automation'
  | 'analytics'
  | 'productivity'
  | 'finance'
  | 'communication'
  | 'other';

export interface ToolDiscovery {
  id: string;
  name: string;
  category: ToolCategory;
  url: string;
  description: string;
  free: boolean;
  pricing: string;
  relevance: number; // 0-100
  tags: string[];
  discoveredAt: number;
  verified: boolean;
  notes?: string;
}

export interface WeeklyScanResult {
  weekOf: string;
  newTools: ToolDiscovery[];
  industryNews: IndustryUpdate[];
  competitorChanges: CompetitorChange[];
  trendAlerts: TrendAlert[];
}

export interface IndustryUpdate {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  impact: 'low' | 'medium' | 'high';
  category: string;
  timestamp: number;
}

export interface CompetitorChange {
  id: string;
  competitor: string;
  changeType: 'pricing' | 'feature' | 'partnership' | 'launch' | 'other';
  description: string;
  impact: 'low' | 'medium' | 'high';
  timestamp: number;
}

export interface TrendAlert {
  id: string;
  trend: string;
  description: string;
  category: string;
  momentum: 'emerging' | 'growing' | 'mainstream' | 'declining';
  relevance: number; // 0-100
  timestamp: number;
}

// ─── Known Tool Database ───────────────

const KNOWN_TOOLS: ToolDiscovery[] = [
  // AI Models
  { id: 't1', name: 'Groq', category: 'ai-model', url: 'https://groq.com', description: 'Ultra-fast inference for Llama 3.3 70B at 800 tokens/sec. Free tier available.', free: true, pricing: 'Free tier (14,400 req/day)', relevance: 95, tags: ['llm', 'fast', 'free'], discoveredAt: Date.now(), verified: true },
  { id: 't2', name: 'Cerebras', category: 'ai-model', url: 'https://cerebras.ai', description: 'Fastest LLM inference at 2000 tokens/sec. Free tier with 1M tokens/day.', free: true, pricing: 'Free tier (1M tokens/day)', relevance: 90, tags: ['llm', 'fast', 'free'], discoveredAt: Date.now(), verified: true },
  { id: 't3', name: 'OpenRouter', category: 'ai-model', url: 'https://openrouter.ai', description: 'Access 28+ free models including DeepSeek R1. Universal API gateway.', free: true, pricing: 'Pay-per-token, 28+ free models', relevance: 90, tags: ['llm', 'multi-model', 'free'], discoveredAt: Date.now(), verified: true },
  { id: 't4', name: 'Sarvam AI', category: 'ai-model', url: 'https://sarvam.ai', description: 'Best Indian language TTS and voice AI. Free API tier.', free: true, pricing: 'Free API tier', relevance: 85, tags: ['voice', 'indian-languages', 'tts'], discoveredAt: Date.now(), verified: true },

  // Design
  { id: 't5', name: 'Canva', category: 'design', url: 'https://canva.com', description: 'All-in-one design platform. Social posts, presentations, videos.', free: true, pricing: 'Free tier, Pro ₹3,000/year', relevance: 80, tags: ['design', 'social-media', 'presentations'], discoveredAt: Date.now(), verified: true },
  { id: 't6', name: 'Bing Image Creator', category: 'design', url: 'https://www.bing.com/create', description: 'DALL-E 3 powered image generation. Unlimited and free.', free: true, pricing: 'Free', relevance: 85, tags: ['ai-image', 'dall-e', 'free'], discoveredAt: Date.now(), verified: true },

  // Development
  { id: 't7', name: 'Bolt.new', category: 'development', url: 'https://bolt.new', description: 'AI full-stack app builder. Build and deploy in minutes.', free: true, pricing: 'Free tier available', relevance: 90, tags: ['full-stack', 'ai-builder', 'deploy'], discoveredAt: Date.now(), verified: true },
  { id: 't8', name: 'Lovable.dev', category: 'development', url: 'https://lovable.dev', description: 'React + Supabase AI-built apps. Beautiful UI generation.', free: true, pricing: 'Free tier available', relevance: 85, tags: ['react', 'supabase', 'ai-builder'], discoveredAt: Date.now(), verified: true },

  // Marketing
  { id: 't9', name: 'PostHog', category: 'analytics', url: 'https://posthog.com', description: 'Product analytics with 1M events/month free. Open source.', free: true, pricing: 'Free (1M events/month)', relevance: 80, tags: ['analytics', 'product', 'open-source'], discoveredAt: Date.now(), verified: true },
  { id: 't10', name: 'Microsoft Clarity', category: 'analytics', url: 'https://clarity.microsoft.com', description: 'Free heatmaps and session recordings. No data limits.', free: true, pricing: 'Free, unlimited', relevance: 85, tags: ['heatmaps', 'session-recordings', 'free'], discoveredAt: Date.now(), verified: true },

  // Automation
  { id: 't11', name: 'n8n', category: 'automation', url: 'https://n8n.io', description: 'Open source workflow automation. Self-host for free.', free: true, pricing: 'Free self-hosted, Cloud from €20/month', relevance: 90, tags: ['automation', 'workflow', 'open-source'], discoveredAt: Date.now(), verified: true },
  { id: 't12', name: 'Playwright', category: 'automation', url: 'https://playwright.dev', description: 'Browser automation for web scraping and testing. Free and open source.', free: true, pricing: 'Free', relevance: 85, tags: ['scraping', 'testing', 'browser-automation'], discoveredAt: Date.now(), verified: true },

  // Communication
  { id: 't13', name: 'Brevo', category: 'communication', url: 'https://brevo.com', description: 'Email marketing with 300 emails/day free forever. Great for small agencies.', free: true, pricing: 'Free (300 emails/day)', relevance: 80, tags: ['email', 'marketing', 'free'], discoveredAt: Date.now(), verified: true },
  { id: 't14', name: 'Resend', category: 'communication', url: 'https://resend.com', description: 'Developer-first email API. 3,000 emails/month free.', free: true, pricing: 'Free (3,000 emails/month)', relevance: 75, tags: ['email', 'api', 'developer'], discoveredAt: Date.now(), verified: true },

  // Finance
  { id: 't15', name: 'Razorpay', category: 'finance', url: 'https://razorpay.com', description: 'Payment processing for Indian businesses. 2% per transaction.', free: false, pricing: '2% per transaction, free setup', relevance: 85, tags: ['payments', 'india', 'gst'], discoveredAt: Date.now(), verified: true },
];

// ─── Scan Engine ───────────────────────

export function getKnownTools(category?: ToolCategory): ToolDiscovery[] {
  if (category) return KNOWN_TOOLS.filter((t) => t.category === category);
  return [...KNOWN_TOOLS];
}

export function getFreeTools(): ToolDiscovery[] {
  return KNOWN_TOOLS.filter((t) => t.free);
}

export function getToolsByRelevance(minRelevance: number = 70): ToolDiscovery[] {
  return KNOWN_TOOLS.filter((t) => t.relevance >= minRelevance).sort((a, b) => b.relevance - a.relevance);
}

// ─── Trend Detection ───────────────────

const EMERGING_TRENDS: TrendAlert[] = [
  {
    id: 'tr1',
    trend: 'AEO/GEO Optimisation',
    description: 'Optimising for AI chatbot citations (ChatGPT, Perplexity, Gemini) instead of just Google.',
    category: 'SEO',
    momentum: 'emerging',
    relevance: 95,
    timestamp: Date.now(),
  },
  {
    id: 'tr2',
    trend: 'AI Voice Agents',
    description: 'VAPI, ElevenLabs, Sarvam AI enabling 24/7 voice bots for businesses.',
    category: 'AI',
    momentum: 'growing',
    relevance: 90,
    timestamp: Date.now(),
  },
  {
    id: 'tr3',
    trend: 'AI-Generated Content at Scale',
    description: 'Programmatic SEO and AI content tools enabling 1000+ pages per day.',
    category: 'Content',
    momentum: 'growing',
    relevance: 85,
    timestamp: Date.now(),
  },
  {
    id: 'tr4',
    trend: 'WhatsApp Commerce',
    description: 'WhatsApp Catalogs + Payments + Chatbots = full commerce in India.',
    category: 'E-commerce',
    momentum: 'growing',
    relevance: 80,
    timestamp: Date.now(),
  },
  {
    id: 'tr5',
    trend: 'Micro-SaaS for Agencies',
    description: 'Agencies building their own SaaS tools from prompt libraries and workflows.',
    category: 'Business',
    momentum: 'emerging',
    relevance: 75,
    timestamp: Date.now(),
  },
];

export function getEmergingTrends(minRelevance: number = 50): TrendAlert[] {
  return EMERGING_TRENDS.filter((t) => t.relevance >= minRelevance);
}

// ─── Storage ───────────────────────────

const DISCOVERY_KEY = 'oracle_tool_discoveries';

export function addDiscovery(discovery: Omit<ToolDiscovery, 'id' | 'discoveredAt' | 'verified'>): ToolDiscovery {
  const full: ToolDiscovery = {
    ...discovery,
    id: `disc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    discoveredAt: Date.now(),
    verified: false,
  };
  if (typeof window === 'undefined') return full;
  try {
    const raw = localStorage.getItem(DISCOVERY_KEY);
    const discoveries: ToolDiscovery[] = raw ? JSON.parse(raw) : [];
    discoveries.unshift(full);
    localStorage.setItem(DISCOVERY_KEY, JSON.stringify(discoveries.slice(0, 200)));
  } catch {
    // Silently fail
  }
  return full;
}

export function getDiscoveries(): ToolDiscovery[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DISCOVERY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getDiscoveryStats(): {
  totalDiscoveries: number;
  byCategory: Record<ToolCategory, number>;
  freeCount: number;
  lastScanDate: string | null;
} {
  const discoveries = getDiscoveries();
  const byCategory = {} as Record<ToolCategory, number>;
  for (const d of discoveries) {
    byCategory[d.category] = (byCategory[d.category] || 0) + 1;
  }
  return {
    totalDiscoveries: discoveries.length,
    byCategory,
    freeCount: discoveries.filter((d) => d.free).length,
    lastScanDate: discoveries.length > 0 ? new Date(discoveries[0].discoveredAt).toISOString().slice(0, 10) : null,
  };
}
