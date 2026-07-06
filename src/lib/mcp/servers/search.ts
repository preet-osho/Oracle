// ═══════════════════════════════════════
// ORACLE — Search MCP Server
// Multi-source web search · SERP extraction · Research
// ═══════════════════════════════════════

import { McpServer } from '../server';
import type { Tool, ToolResult } from '../protocol';
import { fetchWithTimeout, TIMEOUT_MODERATE_MS } from '@/lib/fetch-utils';
import { formatSearchResults } from '@/lib/search';
import type { SearchResult } from '@/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('MCP:Search');

// ─── Search Provider Abstraction ──────

interface SearchProvider {
  name: string;
  search(query: string, options: SearchOptions): Promise<SearchResult[]>;
}

interface SearchOptions {
  numResults?: number;
  country?: string;
  language?: string;
  safeSearch?: boolean;
}

// ─── Tavily Provider ──────────────────

class TavilyProvider implements SearchProvider {
  name = 'Tavily';

  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error('TAVILY_API_KEY not configured');

    const response = await fetchWithTimeout('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: options.numResults ?? 10,
        search_depth: 'advanced',
        include_answer: false,
      }),
      timeoutMs: TIMEOUT_MODERATE_MS,
    });

    if (!response.ok) throw new Error(`Tavily API error: ${response.status}`);
    const data = await response.json() as { results: Array<{ title: string; url: string; content: string; published_date?: string }> };

    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      publishedDate: r.published_date,
    }));
  }
}

// ─── Serper Provider ──────────────────

class SerperProvider implements SearchProvider {
  name = 'Serper';

  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) throw new Error('SERPER_API_KEY not configured');

    const response = await fetchWithTimeout('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        q: query,
        num: options.numResults ?? 10,
        gl: options.country ?? 'in',
        hl: options.language ?? 'en',
      }),
      timeoutMs: TIMEOUT_MODERATE_MS,
    });

    if (!response.ok) throw new Error(`Serper API error: ${response.status}`);
    const data = await response.json() as { organic: Array<{ title: string; link: string; snippet: string; date?: string }> };

    return (data.organic ?? []).map((r) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      publishedDate: r.date,
    }));
  }
}

// ─── Brave Provider ───────────────────

class BraveProvider implements SearchProvider {
  name = 'Brave';

  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) throw new Error('BRAVE_SEARCH_API_KEY not configured');

    const params = new URLSearchParams({
      q: query,
      count: String(options.numResults ?? 10),
    });

    const response = await fetchWithTimeout(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      timeoutMs: TIMEOUT_MODERATE_MS,
    });

    if (!response.ok) throw new Error(`Brave API error: ${response.status}`);
    const data = await response.json() as { web: { results: Array<{ title: string; url: string; description: string; age?: string }> } };

    return (data.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
      publishedDate: r.age,
    }));
  }
}

// ─── Provider Selection ───────────────

function getProviders(): SearchProvider[] {
  const providers: SearchProvider[] = [];
  if (process.env.TAVILY_API_KEY) providers.push(new TavilyProvider());
  if (process.env.SERPER_API_KEY) providers.push(new SerperProvider());
  if (process.env.BRAVE_SEARCH_API_KEY) providers.push(new BraveProvider());
  return providers;
}

// ─── Tool Definitions ─────────────────

const WEB_SEARCH_TOOL: Tool = {
  name: 'search_web',
  title: 'Web Search',
  description: 'Search the web using multiple providers (Tavily, Serper, Brave). Returns titles, URLs, and snippets.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      numResults: { type: 'string', description: 'Number of results (default 10)' },
      country: { type: 'string', description: 'Country code (e.g., in, us, gb)' },
      language: { type: 'string', description: 'Language code (e.g., en, hi)' },
    },
    required: ['query'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const MULTI_SEARCH_TOOL: Tool = {
  name: 'search_multi_source',
  title: 'Multi-Source Search',
  description: 'Search using all configured providers and merge/dedupe results for comprehensive coverage.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      numResults: { type: 'string', description: 'Results per provider (default 5)' },
    },
    required: ['query'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const COMPETITOR_SEARCH_TOOL: Tool = {
  name: 'search_competitors',
  title: 'Competitor Search',
  description: 'Search for competitors in a specific industry/ niche. Returns structured competitor data.',
  inputSchema: {
    type: 'object',
    properties: {
      industry: { type: 'string', description: 'Industry or niche (e.g., "dental clinics in Mumbai")' },
      city: { type: 'string', description: 'City or region' },
      numResults: { type: 'string', description: 'Number of results (default 10)' },
    },
    required: ['industry'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const LEAD_SEARCH_TOOL: Tool = {
  name: 'search_leads',
  title: 'Lead Search',
  description: 'Search for potential business leads based on industry, location, and pain points.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query for leads' },
      city: { type: 'string', description: 'Target city' },
      industry: { type: 'string', description: 'Target industry' },
    },
    required: ['query'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

// ─── Server Factory ───────────────────

export function createSearchMcpServer(): McpServer {
  const server = new McpServer('search-mcp', '1.0.0', {
    tools: { listChanged: false },
  });

  server.registerTool(WEB_SEARCH_TOOL, async (args: Record<string, unknown>) => {
    const providers = getProviders();
    if (providers.length === 0) {
      return {
        content: [{ type: 'text', text: 'No search providers configured. Set TAVILY_API_KEY, SERPER_API_KEY, or BRAVE_SEARCH_API_KEY.' }],
        isError: true,
      };
    }

    const provider = providers[0];
    const results = await provider.search(args.query as string, {
      numResults: args.numResults ? parseInt(args.numResults as string, 10) : 10,
      country: args.country as string,
      language: args.language as string,
    });

    return {
      content: [{
        type: 'text',
        text: `Provider: ${provider.name}\nResults: ${results.length}\n\n${formatSearchResults(results)}`,
      }],
    };
  });

  server.registerTool(MULTI_SEARCH_TOOL, async (args: Record<string, unknown>) => {
    const providers = getProviders();
    if (providers.length === 0) {
      return {
        content: [{ type: 'text', text: 'No search providers configured. Set TAVILY_API_KEY, SERPER_API_KEY, or BRAVE_SEARCH_API_KEY.' }],
        isError: true,
      };
    }

    const numResults = args.numResults ? parseInt(args.numResults as string, 10) : 5;
    const allResults: SearchResult[] = [];
    const providerResults: string[] = [];

    const searches = providers.map(async (provider) => {
      try {
        const results = await provider.search(args.query as string, { numResults });
        providerResults.push(`${provider.name}: ${results.length} results`);
        return results;
      } catch (error) {
        providerResults.push(`${provider.name}: FAILED (${error instanceof Error ? error.message : 'Unknown'})`);
        return [] as SearchResult[];
      }
    });

    const resultSets = await Promise.allSettled(searches);

    // Merge and dedupe by URL
    const seenUrls = new Set<string>();
    for (const outcome of resultSets) {
      if (outcome.status === 'fulfilled') {
        for (const result of outcome.value) {
          if (!seenUrls.has(result.url)) {
            seenUrls.add(result.url);
            allResults.push(result);
          }
        }
      }
    }

    return {
      content: [{
        type: 'text',
        text: [
          `Providers: ${providerResults.join(', ')}`,
          `Total unique results: ${allResults.length}`,
          '',
          formatSearchResults(allResults),
        ].join('\n'),
      }],
    };
  });

  server.registerTool(COMPETITOR_SEARCH_TOOL, async (args: Record<string, unknown>) => {
    const industry = args.industry as string;
    const city = args.city as string;
    const query = [industry, city, 'competitors'].filter(Boolean).join(' ');

    const providers = getProviders();
    if (providers.length === 0) {
      return {
        content: [{ type: 'text', text: 'No search providers configured.' }],
        isError: true,
      };
    }

    const results = await providers[0].search(query, {
      numResults: args.numResults ? parseInt(args.numResults as string, 10) : 10,
    });

    // Format as competitor analysis
    const text = results.map((r, i) =>
      `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`
    ).join('\n\n');

    return {
      content: [{
        type: 'text',
        text: `Competitor search: "${query}"\nResults: ${results.length}\n\n${text}`,
      }],
    };
  });

  server.registerTool(LEAD_SEARCH_TOOL, async (args: Record<string, unknown>) => {
    const parts = [args.query as string, args.city as string, args.industry as string].filter(Boolean);
    const query = parts.join(' ');

    const providers = getProviders();
    if (providers.length === 0) {
      return {
        content: [{ type: 'text', text: 'No search providers configured.' }],
        isError: true,
      };
    }

    const results = await providers[0].search(query, { numResults: 10 });

    const text = results.map((r, i) =>
      `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`
    ).join('\n\n');

    return {
      content: [{
        type: 'text',
        text: `Lead search: "${query}"\nResults: ${results.length}\n\n${text}`,
      }],
    };
  });

  return server;
}
