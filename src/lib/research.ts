// ═══════════════════════════════════════
// ORACLE — Enhanced Search & Research Layer
// Tavily · Serper · Brave · Deep Research · Multi-Source Verification
// ═══════════════════════════════════════

import { fetchWithTimeout, TIMEOUT_MODERATE_MS, TIMEOUT_STANDARD_MS } from '@/lib/fetch-utils';
import { createLogger } from '@/lib/logger';
import type { SearchResult } from '@/types';

const log = createLogger('Research');

// ─── Types ─────────────────────────────

export type SearchProvider = 'tavily' | 'serper' | 'brave' | 'google';

export interface SearchConfig {
  tavilyApiKey?: string;
  serperApiKey?: string;
  braveApiKey?: string;
  googleApiKey?: string;
  googleSearchEngineId?: string;
}

export interface DeepResearchQuery {
  query: string;
  maxResults?: number;
  providers?: SearchProvider[];
  includeSnippets?: boolean;
  dateRange?: 'day' | 'week' | 'month' | 'year';
  region?: string;
  language?: string;
}

export interface ResearchResult {
  query: string;
  provider: SearchProvider;
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
  timestamp: number;
}

export interface VerifiedClaim {
  claim: string;
  sources: SearchResult[];
  confidence: number; // 0-100
  verificationStatus: 'verified' | 'partially-verified' | 'unverified' | 'contradicted';
}

export interface CompetitorAnalysis {
  competitor: string;
  website: string;
  estimatedTraffic?: string;
  domainAuthority?: number;
  topKeywords: string[];
  backlinks?: number;
  socialPresence: Record<string, string>;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
}

export interface MarketResearch {
  query: string;
  industry: string;
  marketSize?: string;
  growthRate?: string;
  keyPlayers: string[];
  trends: string[];
  challenges: string[];
  opportunities: string[];
  sources: SearchResult[];
}

// ─── Configuration ─────────────────────

function getConfig(): SearchConfig {
  return {
    tavilyApiKey: process.env.TAVILY_API_KEY,
    serperApiKey: process.env.SERPER_API_KEY,
    braveApiKey: process.env.BRAVE_API_KEY,
    googleApiKey: process.env.GOOGLE_API_KEY,
    googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
  };
}

// ─── Provider Implementations ──────────

async function searchTavily(
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<SearchResult[]> {
  const startTime = Date.now();

  try {
    const response = await fetchWithTimeout('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
      }),
      timeoutMs: TIMEOUT_MODERATE_MS,
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json();
    const results: SearchResult[] = (data.results || []).map((r: Record<string, string>) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.content || '',
      publishedDate: r.published_date || undefined,
    }));

    log.info('Tavily search completed', {
      query: query.slice(0, 50),
      results: results.length,
      duration: Date.now() - startTime,
    });

    return results;
  } catch (error) {
    log.error('Tavily search failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return [];
  }
}

async function searchSerper(
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<SearchResult[]> {
  const startTime = Date.now();

  try {
    const response = await fetchWithTimeout('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        q: query,
        num: maxResults,
      }),
      timeoutMs: TIMEOUT_MODERATE_MS,
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status}`);
    }

    const data = await response.json();
    const results: SearchResult[] = (data.organic || []).map((r: Record<string, string>) => ({
      title: r.title || '',
      url: r.link || '',
      snippet: r.snippet || '',
      publishedDate: r.date || undefined,
    }));

    log.info('Serper search completed', {
      query: query.slice(0, 50),
      results: results.length,
      duration: Date.now() - startTime,
    });

    return results;
  } catch (error) {
    log.error('Serper search failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return [];
  }
}

async function searchBrave(
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<SearchResult[]> {
  const startTime = Date.now();

  try {
    const response = await fetchWithTimeout(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
        timeoutMs: TIMEOUT_MODERATE_MS,
      },
    );

    if (!response.ok) {
      throw new Error(`Brave API error: ${response.status}`);
    }

    const data = await response.json();
    const results: SearchResult[] = (data.web?.results || []).map((r: Record<string, string>) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.description || '',
      publishedDate: r.page_age || undefined,
    }));

    log.info('Brave search completed', {
      query: query.slice(0, 50),
      results: results.length,
      duration: Date.now() - startTime,
    });

    return results;
  } catch (error) {
    log.error('Brave search failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return [];
  }
}

async function searchGoogle(
  query: string,
  maxResults: number,
  apiKey: string,
  searchEngineId: string,
): Promise<SearchResult[]> {
  const startTime = Date.now();

  try {
    const response = await fetchWithTimeout(
      `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=${maxResults}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        timeoutMs: TIMEOUT_MODERATE_MS,
      },
    );

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();
    const results: SearchResult[] = (data.items || []).map((r: Record<string, string>) => ({
      title: r.title || '',
      url: r.link || '',
      snippet: r.snippet || '',
    }));

    log.info('Google search completed', {
      query: query.slice(0, 50),
      results: results.length,
      duration: Date.now() - startTime,
    });

    return results;
  } catch (error) {
    log.error('Google search failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return [];
  }
}

// ─── Multi-Provider Search ─────────────

export async function search(
  query: string,
  options: {
    maxResults?: number;
    providers?: SearchProvider[];
    dateRange?: string;
  } = {},
): Promise<ResearchResult[]> {
  const config = getConfig();
  const maxResults = options.maxResults || 5;
  const providers = options.providers || ['tavily', 'serper', 'brave'];
  const results: ResearchResult[] = [];

  const searchPromises = providers.map(async (provider) => {
    const startTime = Date.now();
    let searchResults: SearchResult[] = [];

    switch (provider) {
      case 'tavily':
        if (config.tavilyApiKey) {
          searchResults = await searchTavily(query, maxResults, config.tavilyApiKey);
        }
        break;
      case 'serper':
        if (config.serperApiKey) {
          searchResults = await searchSerper(query, maxResults, config.serperApiKey);
        }
        break;
      case 'brave':
        if (config.braveApiKey) {
          searchResults = await searchBrave(query, maxResults, config.braveApiKey);
        }
        break;
      case 'google':
        if (config.googleApiKey && config.googleSearchEngineId) {
          searchResults = await searchGoogle(
            query,
            maxResults,
            config.googleApiKey,
            config.googleSearchEngineId,
          );
        }
        break;
    }

    return {
      query,
      provider,
      results: searchResults,
      totalResults: searchResults.length,
      searchTime: Date.now() - startTime,
      timestamp: Date.now(),
    };
  });

  const searchResults = await Promise.allSettled(searchPromises);

  for (const result of searchResults) {
    if (result.status === 'fulfilled' && result.value.results.length > 0) {
      results.push(result.value);
    }
  }

  return results;
}

// ─── Deep Research ─────────────────────

export async function deepResearch(
  query: string,
  options: Partial<DeepResearchQuery> = {},
): Promise<{
  results: SearchResult[];
  verifiedClaims: VerifiedClaim[];
  summary: string;
}> {
  const startTime = Date.now();
  const maxResults = options.maxResults || 10;

  // Step 1: Multi-provider search
  const searchResults = await search(query, {
    maxResults,
    providers: options.providers,
  });

  // Step 2: Flatten and deduplicate results
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const providerResult of searchResults) {
    for (const result of providerResult.results) {
      if (!seenUrls.has(result.url)) {
        seenUrls.add(result.url);
        allResults.push(result);
      }
    }
  }

  // Step 3: Cross-reference claims
  const verifiedClaims = crossReferenceClaims(query, allResults);

  // Step 4: Generate summary
  const summary = generateResearchSummary(query, allResults, verifiedClaims);

  log.info('Deep research completed', {
    query: query.slice(0, 50),
    totalResults: allResults.length,
    providers: searchResults.length,
    duration: Date.now() - startTime,
  });

  return {
    results: allResults,
    verifiedClaims,
    summary,
  };
}

// ─── Claim Cross-Referencing ───────────

function crossReferenceClaims(
  query: string,
  results: SearchResult[],
): VerifiedClaim[] {
  const claims: VerifiedClaim[] = [];
  const queryWords = query.toLowerCase().split(/\s+/);

  // Extract potential claims from snippets
  for (const result of results) {
    const snippet = result.snippet.toLowerCase();

    // Check if snippet contains query-related information
    const relevanceScore = queryWords.filter((word) => snippet.includes(word)).length /
      queryWords.length;

    if (relevanceScore > 0.3) {
      // Find supporting sources
      const supportingSources = results.filter(
        (r) =>
          r.url !== result.url &&
          r.snippet.toLowerCase().includes(result.title.toLowerCase().slice(0, 20)),
      );

      const confidence = Math.min(
        100,
        Math.round(relevanceScore * 50 + (supportingSources.length * 15)),
      );

      let verificationStatus: VerifiedClaim['verificationStatus'];
      if (confidence >= 70) verificationStatus = 'verified';
      else if (confidence >= 40) verificationStatus = 'partially-verified';
      else verificationStatus = 'unverified';

      claims.push({
        claim: result.snippet.slice(0, 200),
        sources: [result, ...supportingSources.slice(0, 2)],
        confidence,
        verificationStatus,
      });
    }
  }

  // Sort by confidence
  claims.sort((a, b) => b.confidence - a.confidence);

  return claims.slice(0, 5);
}

// ─── Research Summary Generator ────────

function generateResearchSummary(
  query: string,
  results: SearchResult[],
  claims: VerifiedClaim[],
): string {
  const verifiedCount = claims.filter((c) => c.verificationStatus === 'verified').length;
  const partialCount = claims.filter((c) => c.verificationStatus === 'partially-verified').length;

  let summary = `## Research Summary: ${query}\n\n`;
  summary += `**Sources Found:** ${results.length} unique sources\n`;
  summary += `**Verified Claims:** ${verifiedCount} verified, ${partialCount} partially verified\n\n`;

  if (claims.length > 0) {
    summary += `### Key Findings\n\n`;
    for (const claim of claims.slice(0, 3)) {
      const statusEmoji = claim.verificationStatus === 'verified' ? '✅' :
        claim.verificationStatus === 'partially-verified' ? '⚠️' : '❓';
      summary += `${statusEmoji} ${claim.claim}\n`;
      summary += `   *Confidence: ${claim.confidence}% | Sources: ${claim.sources.length}*\n\n`;
    }
  }

  summary += `### Sources\n`;
  for (const result of results.slice(0, 5)) {
    summary += `- [${result.title}](${result.url})\n`;
  }

  return summary;
}

// ─── Competitor Research ───────────────

export async function researchCompetitor(
  competitorName: string,
  website: string,
): Promise<CompetitorAnalysis> {
  const startTime = Date.now();

  // Search for competitor information
  const searchResults = await search(
    `${competitorName} company information services pricing`,
    { maxResults: 5 },
  );

  const allResults = searchResults.flatMap((r) => r.results);

  // Extract key information
  const analysis: CompetitorAnalysis = {
    competitor: competitorName,
    website,
    topKeywords: extractKeywords(allResults),
    socialPresence: {},
    strengths: extractStrengths(allResults),
    weaknesses: extractWeaknesses(allResults),
    opportunities: extractOpportunities(allResults, competitorName),
  };

  log.info('Competitor research completed', {
    competitor: competitorName,
    duration: Date.now() - startTime,
  });

  return analysis;
}

function extractKeywords(results: SearchResult[]): string[] {
  const keywords = new Set<string>();
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

  for (const result of results) {
    const words = result.title.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 3 && !stopWords.has(word)) {
        keywords.add(word);
      }
    }
  }

  return Array.from(keywords).slice(0, 10);
}

function extractStrengths(results: SearchResult[]): string[] {
  const strengths: string[] = [];
  const positiveKeywords = ['leading', 'best', 'top', 'award', 'innovative', 'trusted', 'premium'];

  for (const result of results) {
    const snippet = result.snippet.toLowerCase();
    for (const keyword of positiveKeywords) {
      if (snippet.includes(keyword)) {
        strengths.push(result.snippet.slice(0, 100));
        break;
      }
    }
  }

  return strengths.slice(0, 3);
}

function extractWeaknesses(results: SearchResult[]): string[] {
  const weaknesses: string[] = [];
  const negativeKeywords = ['expensive', 'slow', 'limited', 'poor', 'lack', 'missing'];

  for (const result of results) {
    const snippet = result.snippet.toLowerCase();
    for (const keyword of negativeKeywords) {
      if (snippet.includes(keyword)) {
        weaknesses.push(result.snippet.slice(0, 100));
        break;
      }
    }
  }

  return weaknesses.slice(0, 3);
}

function extractOpportunities(results: SearchResult[], competitorName: string): string[] {
  const opportunities: string[] = [];

  // Look for gaps in competitor's offerings
  for (const result of results) {
    const snippet = result.snippet.toLowerCase();
    if (snippet.includes('gap') || snippet.includes('missing') || snippet.includes('opportunity')) {
      opportunities.push(result.snippet.slice(0, 100));
    }
  }

  return opportunities.slice(0, 3);
}

// ─── Market Research ───────────────────

export async function researchMarket(
  query: string,
  industry: string,
): Promise<MarketResearch> {
  const startTime = Date.now();

  // Search for market information
  const searchResults = await search(
    `${industry} market size growth trends ${new Date().getFullYear()}`,
    { maxResults: 5 },
  );

  const allResults = searchResults.flatMap((r) => r.results);

  const research: MarketResearch = {
    query,
    industry,
    keyPlayers: extractKeyPlayers(allResults),
    trends: extractTrends(allResults),
    challenges: extractChallenges(allResults),
    opportunities: extractMarketOpportunities(allResults),
    sources: allResults.slice(0, 5),
  };

  log.info('Market research completed', {
    industry,
    duration: Date.now() - startTime,
  });

  return research;
}

function extractKeyPlayers(results: SearchResult[]): string[] {
  const players = new Set<string>();

  for (const result of results) {
    // Extract company names from titles
    const titleWords = result.title.split(/\s+/);
    for (let i = 0; i < titleWords.length - 1; i++) {
      if (titleWords[i][0] === titleWords[i][0]?.toUpperCase() &&
          titleWords[i + 1][0] === titleWords[i + 1][0]?.toUpperCase()) {
        players.add(`${titleWords[i]} ${titleWords[i + 1]}`);
      }
    }
  }

  return Array.from(players).slice(0, 5);
}

function extractTrends(results: SearchResult[]): string[] {
  const trends: string[] = [];
  const trendKeywords = ['trend', 'growing', 'emerging', 'increasing', 'rise', 'adoption'];

  for (const result of results) {
    const snippet = result.snippet.toLowerCase();
    for (const keyword of trendKeywords) {
      if (snippet.includes(keyword)) {
        trends.push(result.snippet.slice(0, 100));
        break;
      }
    }
  }

  return trends.slice(0, 3);
}

function extractChallenges(results: SearchResult[]): string[] {
  const challenges: string[] = [];
  const challengeKeywords = ['challenge', 'problem', 'issue', 'barrier', 'difficulty'];

  for (const result of results) {
    const snippet = result.snippet.toLowerCase();
    for (const keyword of challengeKeywords) {
      if (snippet.includes(keyword)) {
        challenges.push(result.snippet.slice(0, 100));
        break;
      }
    }
  }

  return challenges.slice(0, 3);
}

function extractMarketOpportunities(results: SearchResult[]): string[] {
  const opportunities: string[] = [];
  const opportunityKeywords = ['opportunity', 'potential', 'gap', 'underserved', 'demand'];

  for (const result of results) {
    const snippet = result.snippet.toLowerCase();
    for (const keyword of opportunityKeywords) {
      if (snippet.includes(keyword)) {
        opportunities.push(result.snippet.slice(0, 100));
        break;
      }
    }
  }

  return opportunities.slice(0, 3);
}

// ─── Format Results for AI Context ─────

export function formatResearchForAI(results: ResearchResult[]): string {
  if (results.length === 0) return '';

  let context = 'RESEARCH RESULTS:\n\n';

  for (const providerResult of results) {
    context += `Provider: ${providerResult.provider.toUpperCase()}\n`;
    context += `Results: ${providerResult.totalResults}\n\n`;

    for (const result of providerResult.results) {
      context += `### ${result.title}\n`;
      context += `URL: ${result.url}\n`;
      if (result.snippet) {
        context += `Snippet: ${result.snippet}\n`;
      }
      if (result.publishedDate) {
        context += `Published: ${result.publishedDate}\n`;
      }
      context += '\n';
    }
  }

  return context;
}

export function formatCompetitorAnalysis(analysis: CompetitorAnalysis): string {
  let report = `## Competitor Analysis: ${analysis.competitor}\n\n`;
  report += `**Website:** ${analysis.website}\n\n`;

  if (analysis.topKeywords.length > 0) {
    report += `### Top Keywords\n`;
    report += analysis.topKeywords.join(', ') + '\n\n';
  }

  if (analysis.strengths.length > 0) {
    report += `### Strengths\n`;
    for (const strength of analysis.strengths) {
      report += `- ${strength}\n`;
    }
    report += '\n';
  }

  if (analysis.weaknesses.length > 0) {
    report += `### Weaknesses\n`;
    for (const weakness of analysis.weaknesses) {
      report += `- ${weakness}\n`;
    }
    report += '\n';
  }

  if (analysis.opportunities.length > 0) {
    report += `### Opportunities\n`;
    for (const opportunity of analysis.opportunities) {
      report += `- ${opportunity}\n`;
    }
    report += '\n';
  }

  return report;
}

export function formatMarketResearch(research: MarketResearch): string {
  let report = `## Market Research: ${research.industry}\n\n`;

  if (research.keyPlayers.length > 0) {
    report += `### Key Players\n`;
    report += research.keyPlayers.join(', ') + '\n\n';
  }

  if (research.trends.length > 0) {
    report += `### Trends\n`;
    for (const trend of research.trends) {
      report += `- ${trend}\n`;
    }
    report += '\n';
  }

  if (research.challenges.length > 0) {
    report += `### Challenges\n`;
    for (const challenge of research.challenges) {
      report += `- ${challenge}\n`;
    }
    report += '\n';
  }

  if (research.opportunities.length > 0) {
    report += `### Opportunities\n`;
    for (const opportunity of research.opportunities) {
      report += `- ${opportunity}\n`;
    }
    report += '\n';
  }

  if (research.sources.length > 0) {
    report += `### Sources\n`;
    for (const source of research.sources) {
      report += `- [${source.title}](${source.url})\n`;
    }
  }

  return report;
}
