import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  search,
  deepResearch,
  researchCompetitor,
  researchMarket,
  formatResearchForAI,
  formatCompetitorAnalysis,
  formatMarketResearch,
  type ResearchResult,
  type CompetitorAnalysis,
  type MarketResearch,
} from './research';

// ═══════════════════════════════════════
// Mock fetch
// ═══════════════════════════════════════

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  // Reset env vars
  process.env.TAVILY_API_KEY = undefined;
  process.env.SERPER_API_KEY = undefined;
  process.env.BRAVE_API_KEY = undefined;
  process.env.GOOGLE_API_KEY = undefined;
  process.env.GOOGLE_SEARCH_ENGINE_ID = undefined;
});

// ═══════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════

function makeSearchResult(overrides: Partial<ResearchResult> = {}): ResearchResult {
  return {
    query: 'test query',
    provider: 'tavily',
    results: [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1' },
      { title: 'Result 2', url: 'https://example.com/2', snippet: 'Snippet 2' },
    ],
    totalResults: 2,
    searchTime: 100,
    timestamp: Date.now(),
    ...overrides,
  };
}

// ═══════════════════════════════════════
// Search Function Tests
// ═══════════════════════════════════════

describe('search', () => {
  it('returns empty array when no API keys configured', async () => {
    const results = await search('test query');
    expect(results).toEqual([]);
  });

  it('returns results from Tavily when API key is set', async () => {
    process.env.TAVILY_API_KEY = 'test-tavily-key';

    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [
          { title: 'Tavily Result', url: 'https://tavily.com', content: 'Tavily snippet' },
        ],
      }),
    });

    const results = await search('test query', { providers: ['tavily'] });
    expect(results).toHaveLength(1);
    expect(results[0].provider).toBe('tavily');
    expect(results[0].results[0].title).toBe('Tavily Result');
  });

  it('returns results from Serper when API key is set', async () => {
    process.env.SERPER_API_KEY = 'test-serper-key';

    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        organic: [
          { title: 'Serper Result', link: 'https://serper.com', snippet: 'Serper snippet' },
        ],
      }),
    });

    const results = await search('test query', { providers: ['serper'] });
    expect(results).toHaveLength(1);
    expect(results[0].provider).toBe('serper');
  });

  it('handles fetch errors gracefully', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    mockFetch.mockRejectedValue(new Error('Network error'));

    const results = await search('test query', { providers: ['tavily'] });
    expect(results).toEqual([]);
  });

  it('handles non-ok responses', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    mockFetch.mockResolvedValue({ ok: false, status: 429 });

    const results = await search('test query', { providers: ['tavily'] });
    expect(results).toEqual([]);
  });
});

// ═══════════════════════════════════════
// Deep Research Tests
// ═══════════════════════════════════════

describe('deepResearch', () => {
  it('returns results, verified claims, and summary', async () => {
    // Mock all search providers to return empty
    const result = await deepResearch('test query');
    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('verifiedClaims');
    expect(result).toHaveProperty('summary');
    expect(Array.isArray(result.results)).toBe(true);
    expect(Array.isArray(result.verifiedClaims)).toBe(true);
    expect(typeof result.summary).toBe('string');
  });

  it('generates a summary with query', async () => {
    const result = await deepResearch('SEO strategies');
    expect(result.summary).toContain('SEO strategies');
  });
});

// ═══════════════════════════════════════
// Competitor Research Tests
// ═══════════════════════════════════════

describe('researchCompetitor', () => {
  it('returns CompetitorAnalysis structure', async () => {
    const analysis = await researchCompetitor('Acme Corp', 'https://acme.com');
    expect(analysis).toHaveProperty('competitor', 'Acme Corp');
    expect(analysis).toHaveProperty('website', 'https://acme.com');
    expect(analysis).toHaveProperty('topKeywords');
    expect(analysis).toHaveProperty('strengths');
    expect(analysis).toHaveProperty('weaknesses');
    expect(analysis).toHaveProperty('opportunities');
    expect(Array.isArray(analysis.topKeywords)).toBe(true);
    expect(Array.isArray(analysis.strengths)).toBe(true);
  });
});

// ═══════════════════════════════════════
// Market Research Tests
// ═══════════════════════════════════════

describe('researchMarket', () => {
  it('returns MarketResearch structure', async () => {
    const research = await researchMarket('Indian SaaS market', 'SaaS');
    expect(research).toHaveProperty('query', 'Indian SaaS market');
    expect(research).toHaveProperty('industry', 'SaaS');
    expect(research).toHaveProperty('keyPlayers');
    expect(research).toHaveProperty('trends');
    expect(research).toHaveProperty('challenges');
    expect(research).toHaveProperty('opportunities');
    expect(research).toHaveProperty('sources');
  });
});

// ═══════════════════════════════════════
// Format Functions Tests
// ═══════════════════════════════════════

describe('formatResearchForAI', () => {
  it('returns empty string for empty results', () => {
    expect(formatResearchForAI([])).toBe('');
  });

  it('formats results with provider and URL', () => {
    const results = [makeSearchResult()];
    const formatted = formatResearchForAI(results);
    expect(formatted).toContain('TAVILY');
    expect(formatted).toContain('https://example.com/1');
  });
});

describe('formatCompetitorAnalysis', () => {
  it('formats analysis with competitor name', () => {
    const analysis: CompetitorAnalysis = {
      competitor: 'Acme Corp',
      website: 'https://acme.com',
      topKeywords: ['saas', 'cloud'],
      strengths: ['Strong brand'],
      weaknesses: ['High pricing'],
      opportunities: ['New market'],
      socialPresence: {},
    };
    const formatted = formatCompetitorAnalysis(analysis);
    expect(formatted).toContain('Acme Corp');
    expect(formatted).toContain('https://acme.com');
    expect(formatted).toContain('saas');
  });
});

describe('formatMarketResearch', () => {
  it('formats research with industry', () => {
    const research: MarketResearch = {
      query: 'Indian market',
      industry: 'Healthcare',
      keyPlayers: ['Apollo', 'Fortis'],
      trends: ['Digital health'],
      challenges: ['Regulation'],
      opportunities: ['Rural expansion'],
      sources: [],
    };
    const formatted = formatMarketResearch(research);
    expect(formatted).toContain('Healthcare');
    expect(formatted).toContain('Apollo');
  });
});
