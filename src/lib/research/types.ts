// ═══════════════════════════════════════
// ORACLE — Deep Research Engine Types
// Content extraction, search, competitor analysis
// ═══════════════════════════════════════

// ─── Content Extraction ────────────────

export type ExtractionProvider = 'jina' | 'firecrawl' | 'raw';

export interface ExtractorConfig {
  /** Max content length in characters. Default: 50000 */
  maxContentLength?: number;
  /** Request timeout in ms. Default: 15000 */
  timeoutMs?: number;
  /** Whether to include raw HTML in response. Default: false */
  includeHtml?: boolean;
  /** Specific provider to use (skip waterfall). Default: null (auto) */
  provider?: ExtractionProvider;
  /** User-provided API keys (BYOK pattern) — keyed by provider name */
  apiKeys?: Partial<Record<ExtractionProvider, string>>;
}

export interface ExtractedContent {
  url: string;
  title: string;
  content: string;
  html?: string;
  metadata: ContentMetadata;
  extractedAt: number;
  provider: ExtractionProvider;
}

export interface ContentMetadata {
  description?: string;
  author?: string;
  publishDate?: string;
  language?: string;
  wordCount: number;
  charCount: number;
  statusCode?: number;
}

// ─── Search ────────────────────────────

export type SearchProvider = 'tavily' | 'serper' | 'brave';

export interface ResearchQuery {
  query: string;
  sources?: SearchProvider[];
  maxResultsPerSource?: number;
  totalMaxResults?: number;
  language?: string;
  region?: string;
  freshness?: 'day' | 'week' | 'month' | 'year';
}

export interface RankedResult {
  title: string;
  url: string;
  snippet: string;
  score: number;
  source: string;
  publishedDate?: string;
  duplicateOf?: string;
}

export interface ResearchResponse {
  query: string;
  results: RankedResult[];
  sourcesQueried: string[];
  totalFound: number;
  searchDurationMs: number;
}

// ─── Competitor Analysis ───────────────

export interface CompetitorAnalysis {
  url: string;
  domain: string;
  scrapedAt: number;
  structure: WebsiteStructure;
  seo: SeoSignals;
  contact: ContactInfo;
  content: ContentSignals;
  pricing: PricingInfo;
  techStack: TechStack;
}

export interface WebsiteStructure {
  title: string;
  description: string;
  h1Tags: string[];
  h2Tags: string[];
  navigation: string[];
  pages: string[];
  hasBlog: boolean;
  hasPricing: boolean;
  hasContact: boolean;
  hasTestimonials: boolean;
}

export interface SeoSignals {
  titleTag?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  hasSchemaMarkup: boolean;
  robotsMeta?: string;
  ogImage?: string;
  hasSitemap: boolean;
}

export interface ContactInfo {
  emails: string[];
  phones: string[];
  socialLinks: Record<string, string>;
}

export interface ContentSignals {
  wordCount: number;
  blogPostCount: number;
  lastBlogDate?: string;
  topKeywords: string[];
  contentFreshness: 'fresh' | 'recent' | 'stale' | 'abandoned';
}

export interface PricingInfo {
  hasPricingPage: boolean;
  plans: Array<{ name: string; price: string; features: string[] }>;
  pricingModel?: 'subscription' | 'one-time' | 'freemium' | 'custom';
}

export interface TechStack {
  framework?: string;
  analytics?: string[];
  cms?: string;
  cdn?: string;
}

// ─── Research Memory ───────────────────

export type ResearchType = 'competitor' | 'market' | 'website-audit' | 'lead-intel' | 'content-extract';

export interface ResearchFinding {
  id: string;
  userId: string;
  clientId?: string;
  researchType: ResearchType;
  targetUrl?: string;
  targetQuery?: string;
  findings: Record<string, unknown>;
  reportMarkdown?: string;
  createdAt: number;
  expiresAt?: number;
}
