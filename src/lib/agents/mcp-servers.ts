// ═══════════════════════════════════════
// ORACLE - MCP Server Network Definitions
// Custom MCP servers for agency operations
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';
import { TIMEOUT_QUICK_MS, TIMEOUT_MODERATE_MS, TIMEOUT_STANDARD_MS } from '@/lib/fetch-utils';

const log = createLogger('MCPServers');

// --- Types --------------------------------

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  permissions: string[];
  timeoutMs?: number;
}

export type MCPHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface MCPHealthCheckResult {
  status: MCPHealthStatus;
  latencyMs: number;
  lastChecked: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface MCPServerDefinition {
  name: string;
  description: string;
  version: string;
  tools: MCPTool[];
  permissions: string[];
  /** Optional health check function — returns health status */
  healthCheck?: () => Promise<MCPHealthCheckResult>;
}

export interface MCPToolCall {
  serverName: string;
  toolName: string;
  input: Record<string, unknown>;
  timestamp: number;
}

export interface MCPToolResult {
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
  timestamp: number;
}

// --- Health Check Helpers ------------------

/**
 * Create a standard health check for an MCP server.
 * Simulates a ping/pong with latency measurement.
 */
function createStandardHealthCheck(
  serverName: string,
  options: { simulateLatencyMs?: number; alwaysHealthy?: boolean } = {},
): () => Promise<MCPHealthCheckResult> {
  const { simulateLatencyMs = 10, alwaysHealthy = true } = options;

  return async (): Promise<MCPHealthCheckResult> => {
    const start = Date.now();

    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, simulateLatencyMs));

    const latencyMs = Date.now() - start;

    if (alwaysHealthy) {
      return {
        status: 'healthy',
        latencyMs,
        lastChecked: Date.now(),
        details: { server: serverName, version: '1.0.0' },
      };
    }

    // Simulate occasional degradation
    const random = Math.random();
    if (random > 0.95) {
      return {
        status: 'unhealthy',
        latencyMs,
        lastChecked: Date.now(),
        error: 'Connection timeout',
      };
    }
    if (random > 0.85) {
      return {
        status: 'degraded',
        latencyMs,
        lastChecked: Date.now(),
        details: { warning: 'High latency detected' },
      };
    }

    return {
      status: 'healthy',
      latencyMs,
      lastChecked: Date.now(),
      details: { server: serverName },
    };
  };
}

// --- MCP Server Registry -----------------

export const MCP_SERVERS: Record<string, MCPServerDefinition> = {
  'browser-mcp': {
    name: 'Browser MCP',
    description: 'Web automation, scraping, and browser control',
    version: '1.0.0',
    permissions: ['web:read', 'web:write', 'web:navigate'],
    healthCheck: createStandardHealthCheck('browser-mcp', { simulateLatencyMs: 15 }),
    tools: [
      {
        name: 'browse_url',
        description: 'Navigate to a URL and extract page content',
        inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
        outputSchema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' } } },
        permissions: ['web:read'],
        timeoutMs: TIMEOUT_MODERATE_MS,
      },
      {
        name: 'scrape_page',
        description: 'Extract structured data from a web page',
        inputSchema: { type: 'object', properties: { url: { type: 'string' }, selectors: { type: 'object' } }, required: ['url'] },
        outputSchema: { type: 'object', properties: { data: { type: 'object' } } },
        permissions: ['web:read'],
        timeoutMs: TIMEOUT_MODERATE_MS,
      },
    ],
  },

  'search-mcp': {
    name: 'Search MCP',
    description: 'Web search, SERP extraction, and research',
    version: '1.0.0',
    permissions: ['search:read'],
    healthCheck: createStandardHealthCheck('search-mcp', { simulateLatencyMs: 20 }),
    tools: [
      {
        name: 'web_search',
        description: 'Search the web using multiple providers',
        inputSchema: { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] },
        outputSchema: { type: 'object', properties: { results: { type: 'array' } } },
        permissions: ['search:read'],
        timeoutMs: TIMEOUT_QUICK_MS,
      },
      {
        name: 'deep_research',
        description: 'Conduct deep research on a topic with multiple queries',
        inputSchema: { type: 'object', properties: { topic: { type: 'string' }, depth: { type: 'number' } }, required: ['topic'] },
        outputSchema: { type: 'object', properties: { summary: { type: 'string' }, findings: { type: 'array' } } },
        permissions: ['search:read'],
        timeoutMs: TIMEOUT_STANDARD_MS,
      },
    ],
  },

  'seo-mcp': {
    name: 'SEO MCP',
    description: 'SEO audits, keyword research, and technical analysis',
    version: '1.0.0',
    permissions: ['seo:read', 'seo:analyze'],
    healthCheck: createStandardHealthCheck('seo-mcp', { simulateLatencyMs: 25 }),
    tools: [
      {
        name: 'audit_website',
        description: 'Perform comprehensive SEO audit on a website',
        inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
        outputSchema: { type: 'object', properties: { score: { type: 'number' }, issues: { type: 'array' } } },
        permissions: ['seo:read', 'seo:analyze'],
        timeoutMs: TIMEOUT_STANDARD_MS,
      },
      {
        name: 'keyword_research',
        description: 'Research keywords with search volume and competition data',
        inputSchema: { type: 'object', properties: { seedKeywords: { type: 'array' } }, required: ['seedKeywords'] },
        outputSchema: { type: 'object', properties: { keywords: { type: 'array' } } },
        permissions: ['seo:read'],
        timeoutMs: TIMEOUT_MODERATE_MS,
      },
    ],
  },

  'crm-mcp': {
    name: 'CRM MCP',
    description: 'Lead management, pipeline tracking, and client operations',
    version: '1.0.0',
    permissions: ['crm:read', 'crm:write'],
    healthCheck: createStandardHealthCheck('crm-mcp', { simulateLatencyMs: 10 }),
    tools: [
      {
        name: 'add_lead',
        description: 'Add a new lead to the CRM',
        inputSchema: { type: 'object', properties: { businessName: { type: 'string' }, email: { type: 'string' } }, required: ['businessName'] },
        outputSchema: { type: 'object', properties: { leadId: { type: 'string' }, success: { type: 'boolean' } } },
        permissions: ['crm:write'],
      },
      {
        name: 'get_pipeline',
        description: 'Get current pipeline status and metrics',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: { totalValue: { type: 'number' }, dealCount: { type: 'number' } } },
        permissions: ['crm:read'],
      },
    ],
  },

  'memory-mcp': {
    name: 'Memory MCP',
    description: 'Agent memory storage, retrieval, and management',
    version: '1.0.0',
    permissions: ['memory:read', 'memory:write'],
    healthCheck: createStandardHealthCheck('memory-mcp', { simulateLatencyMs: 5 }),
    tools: [
      {
        name: 'store_memory',
        description: 'Store a memory item for an agent',
        inputSchema: { type: 'object', properties: { agentId: { type: 'string' }, content: { type: 'string' }, category: { type: 'string' } }, required: ['agentId', 'content', 'category'] },
        outputSchema: { type: 'object', properties: { memoryId: { type: 'string' }, success: { type: 'boolean' } } },
        permissions: ['memory:write'],
      },
      {
        name: 'retrieve_memories',
        description: 'Retrieve relevant memories based on query',
        inputSchema: { type: 'object', properties: { agentId: { type: 'string' }, query: { type: 'string' } }, required: ['agentId', 'query'] },
        outputSchema: { type: 'object', properties: { memories: { type: 'array' }, count: { type: 'number' } } },
        permissions: ['memory:read'],
      },
    ],
  },

  'file-mcp': {
    name: 'File MCP',
    description: 'Local file system operations',
    version: '1.0.0',
    permissions: ['file:read', 'file:write'],
    healthCheck: createStandardHealthCheck('file-mcp', { simulateLatencyMs: 3 }),
    tools: [
      {
        name: 'read_file',
        description: 'Read contents of a file',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        outputSchema: { type: 'object', properties: { content: { type: 'string' }, size: { type: 'number' } } },
        permissions: ['file:read'],
      },
      {
        name: 'write_file',
        description: 'Write content to a file',
        inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
        outputSchema: { type: 'object', properties: { success: { type: 'boolean' }, bytesWritten: { type: 'number' } } },
        permissions: ['file:write'],
      },
    ],
  },

  'analytics-mcp': {
    name: 'Analytics MCP',
    description: 'Performance tracking, metrics, and reporting',
    version: '1.0.0',
    permissions: ['analytics:read'],
    healthCheck: createStandardHealthCheck('analytics-mcp', { simulateLatencyMs: 30 }),
    tools: [
      {
        name: 'get_metrics',
        description: 'Get performance metrics for a time period',
        inputSchema: { type: 'object', properties: { metric: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' } }, required: ['metric', 'startDate', 'endDate'] },
        outputSchema: { type: 'object', properties: { data: { type: 'array' }, summary: { type: 'object' } } },
        permissions: ['analytics:read'],
      },
      {
        name: 'generate_report',
        description: 'Generate a performance report',
        inputSchema: { type: 'object', properties: { type: { type: 'string' }, period: { type: 'string' } }, required: ['type'] },
        outputSchema: { type: 'object', properties: { report: { type: 'object' }, downloadUrl: { type: 'string' } } },
        permissions: ['analytics:read'],
      },
    ],
  },

  'social-mcp': {
    name: 'Social MCP',
    description: 'Social media management and scheduling',
    version: '1.0.0',
    permissions: ['social:read', 'social:write'],
    healthCheck: createStandardHealthCheck('social-mcp', { simulateLatencyMs: 20 }),
    tools: [
      {
        name: 'schedule_post',
        description: 'Schedule a social media post',
        inputSchema: { type: 'object', properties: { platform: { type: 'string' }, content: { type: 'string' } }, required: ['platform', 'content'] },
        outputSchema: { type: 'object', properties: { postId: { type: 'string' }, success: { type: 'boolean' } } },
        permissions: ['social:write'],
      },
      {
        name: 'get_analytics',
        description: 'Get social media analytics',
        inputSchema: { type: 'object', properties: { platform: { type: 'string' } }, required: ['platform'] },
        outputSchema: { type: 'object', properties: { followers: { type: 'number' }, engagement: { type: 'number' } } },
        permissions: ['social:read'],
      },
    ],
  },

  'ads-mcp': {
    name: 'Ads MCP',
    description: 'Paid advertising campaign management',
    version: '1.0.0',
    permissions: ['ads:read', 'ads:write'],
    healthCheck: createStandardHealthCheck('ads-mcp', { simulateLatencyMs: 25 }),
    tools: [
      {
        name: 'create_campaign',
        description: 'Create a new advertising campaign',
        inputSchema: { type: 'object', properties: { platform: { type: 'string' }, name: { type: 'string' }, budget: { type: 'number' } }, required: ['platform', 'name', 'budget'] },
        outputSchema: { type: 'object', properties: { campaignId: { type: 'string' }, success: { type: 'boolean' } } },
        permissions: ['ads:write'],
      },
      {
        name: 'get_performance',
        description: 'Get campaign performance data',
        inputSchema: { type: 'object', properties: { campaignId: { type: 'string' } }, required: ['campaignId'] },
        outputSchema: { type: 'object', properties: { impressions: { type: 'number' }, clicks: { type: 'number' }, conversions: { type: 'number' } } },
        permissions: ['ads:read'],
      },
    ],
  },

  'research-mcp': {
    name: 'Research MCP',
    description: 'Competitor analysis, market research, and intelligence',
    version: '1.0.0',
    permissions: ['research:read'],
    healthCheck: createStandardHealthCheck('research-mcp', { simulateLatencyMs: 35 }),
    tools: [
      {
        name: 'analyze_competitor',
        description: 'Analyze a competitors digital presence',
        inputSchema: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] },
        outputSchema: { type: 'object', properties: { domain: { type: 'string' }, traffic: { type: 'object' }, seo: { type: 'object' } } },
        permissions: ['research:read'],
        timeoutMs: TIMEOUT_MODERATE_MS,
      },
      {
        name: 'market_research',
        description: 'Conduct market research on an industry or topic',
        inputSchema: { type: 'object', properties: { industry: { type: 'string' } }, required: ['industry'] },
        outputSchema: { type: 'object', properties: { marketSize: { type: 'object' }, trends: { type: 'array' } } },
        permissions: ['research:read'],
        timeoutMs: TIMEOUT_STANDARD_MS,
      },
    ],
  },

  'design-mcp': {
    name: 'Design MCP',
    description: 'Visual design, brand assets, and creative generation',
    version: '1.0.0',
    permissions: ['design:read', 'design:write'],
    healthCheck: createStandardHealthCheck('design-mcp', { simulateLatencyMs: 15 }),
    tools: [
      {
        name: 'generate_ad_creative',
        description: 'Generate ad creative specifications',
        inputSchema: { type: 'object', properties: { platform: { type: 'string' }, headline: { type: 'string' } }, required: ['platform', 'headline'] },
        outputSchema: { type: 'object', properties: { specs: { type: 'object' }, designBrief: { type: 'string' } } },
        permissions: ['design:write'],
      },
      {
        name: 'create_social_graphics',
        description: 'Create social media graphic specifications',
        inputSchema: { type: 'object', properties: { platform: { type: 'string' }, content: { type: 'string' } }, required: ['platform', 'content'] },
        outputSchema: { type: 'object', properties: { specs: { type: 'object' }, designBrief: { type: 'string' } } },
        permissions: ['design:write'],
      },
    ],
  },

  'video-mcp': {
    name: 'Video MCP',
    description: 'Video generation, editing, and repurposing',
    version: '1.0.0',
    permissions: ['video:read', 'video:write'],
    healthCheck: createStandardHealthCheck('video-mcp', { simulateLatencyMs: 20 }),
    tools: [
      {
        name: 'create_video_script',
        description: 'Create a video script with hooks and structure',
        inputSchema: { type: 'object', properties: { topic: { type: 'string' }, platform: { type: 'string' } }, required: ['topic', 'platform'] },
        outputSchema: { type: 'object', properties: { script: { type: 'string' }, hooks: { type: 'array' }, shotList: { type: 'array' } } },
        permissions: ['video:write'],
      },
      {
        name: 'repurpose_video',
        description: 'Create repurposing plan for a video',
        inputSchema: { type: 'object', properties: { sourceVideoUrl: { type: 'string' } }, required: ['sourceVideoUrl'] },
        outputSchema: { type: 'object', properties: { clips: { type: 'array' }, formats: { type: 'object' } } },
        permissions: ['video:read'],
      },
    ],
  },

  'reporting-mcp': {
    name: 'Reporting MCP',
    description: 'Client reporting and dashboard generation',
    version: '1.0.0',
    permissions: ['reporting:read'],
    healthCheck: createStandardHealthCheck('reporting-mcp', { simulateLatencyMs: 40 }),
    tools: [
      {
        name: 'generate_client_report',
        description: 'Generate a client performance report',
        inputSchema: { type: 'object', properties: { clientId: { type: 'string' }, period: { type: 'string' } }, required: ['clientId', 'period'] },
        outputSchema: { type: 'object', properties: { reportUrl: { type: 'string' }, summary: { type: 'string' } } },
        permissions: ['reporting:read'],
        timeoutMs: TIMEOUT_STANDARD_MS,
      },
    ],
  },
};

// --- MCP Client --------------------------

export class MCPClient {
  private servers: Map<string, MCPServerDefinition> = new Map();
  private callHistory: MCPToolCall[] = [];
  private healthCache: Map<string, MCPHealthCheckResult> = new Map();
  private healthCacheTtlMs: number = 60_000; // 1 minute cache

  constructor() {
    for (const [name, server] of Object.entries(MCP_SERVERS)) {
      this.servers.set(name, server);
    }
    log.info('MCP Client initialized', { serverCount: this.servers.size });
  }

  listServers(): MCPServerDefinition[] {
    return Array.from(this.servers.values());
  }

  listTools(serverName: string): MCPTool[] {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Unknown MCP server: ${serverName}`);
    }
    return server.tools;
  }

  async callTool(
    serverName: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    const call: MCPToolCall = { serverName, toolName, input, timestamp: startTime };
    this.callHistory.push(call);

    try {
      const server = this.servers.get(serverName);
      if (!server) throw new Error(`Unknown MCP server: ${serverName}`);

      const tool = server.tools.find((t) => t.name === toolName);
      if (!tool) throw new Error(`Unknown tool: ${toolName} on server ${serverName}`);

      const hasPermission = tool.permissions.every((p) => server.permissions.includes(p));
      if (!hasPermission) throw new Error(`Missing permissions for tool ${toolName}`);

      const result: MCPToolResult = {
        success: true,
        output: { simulated: true, tool: toolName, input },
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      };

      log.info('MCP tool call completed', { server: serverName, tool: toolName, durationMs: result.durationMs });
      return result;
    } catch (error) {
      const result: MCPToolResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      };
      log.error('MCP tool call failed', { server: serverName, tool: toolName, error: result.error });
      return result;
    }
  }

  getCallHistory(limit: number = 50): MCPToolCall[] {
    return this.callHistory.slice(-limit);
  }

  /**
   * Run health check for a single server.
   * Uses cache if available and not expired.
   */
  async checkServerHealth(serverName: string, forceRefresh: boolean = false): Promise<MCPHealthCheckResult> {
    // Check cache
    if (!forceRefresh) {
      const cached = this.healthCache.get(serverName);
      if (cached && Date.now() - cached.lastChecked < this.healthCacheTtlMs) {
        return cached;
      }
    }

    const server = this.servers.get(serverName);
    if (!server) {
      const result: MCPHealthCheckResult = {
        status: 'unhealthy',
        latencyMs: 0,
        lastChecked: Date.now(),
        error: `Unknown server: ${serverName}`,
      };
      this.healthCache.set(serverName, result);
      return result;
    }

    if (!server.healthCheck) {
      const result: MCPHealthCheckResult = {
        status: 'unknown',
        latencyMs: 0,
        lastChecked: Date.now(),
        details: { message: 'No health check configured' },
      };
      this.healthCache.set(serverName, result);
      return result;
    }

    try {
      const result = await server.healthCheck();
      this.healthCache.set(serverName, result);
      return result;
    } catch (error) {
      const result: MCPHealthCheckResult = {
        status: 'unhealthy',
        latencyMs: 0,
        lastChecked: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      };
      this.healthCache.set(serverName, result);
      return result;
    }
  }

  /**
   * Run health checks for all servers.
   * Returns a map of server name -> health status.
   */
  async healthCheck(
    options: { forceRefresh?: boolean; parallel?: boolean } = {},
  ): Promise<Record<string, MCPHealthCheckResult>> {
    const { forceRefresh = false, parallel = true } = options;
    const serverNames = Array.from(this.servers.keys());
    const results: Record<string, MCPHealthCheckResult> = {};

    if (parallel) {
      // Run all health checks in parallel
      const checks = serverNames.map(async (name) => {
        results[name] = await this.checkServerHealth(name, forceRefresh);
      });
      await Promise.all(checks);
    } else {
      // Run sequentially
      for (const name of serverNames) {
        results[name] = await this.checkServerHealth(name, forceRefresh);
      }
    }

    return results;
  }

  /**
   * Get a summary of all server health statuses.
   */
  getHealthSummary(results: Record<string, MCPHealthCheckResult>): {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
    allHealthy: boolean;
  } {
    const values = Object.values(results);
    const healthy = values.filter((r) => r.status === 'healthy').length;
    const degraded = values.filter((r) => r.status === 'degraded').length;
    const unhealthy = values.filter((r) => r.status === 'unhealthy').length;
    const unknown = values.filter((r) => r.status === 'unknown').length;

    return {
      total: values.length,
      healthy,
      degraded,
      unhealthy,
      unknown,
      allHealthy: unhealthy === 0 && degraded === 0,
    };
  }

  /**
   * Clear the health cache.
   */
  clearHealthCache(): void {
    this.healthCache.clear();
  }

  /**
   * Get the number of registered servers.
   */
  getServerCount(): number {
    return this.servers.size;
  }

  /**
   * Get total number of tools across all servers.
   */
  getTotalToolCount(): number {
    let count = 0;
    for (const server of this.servers.values()) {
      count += server.tools.length;
    }
    return count;
  }
}

// --- Singleton ---------------------------

let mcpClientInstance: MCPClient | null = null;

export function getMCPClient(): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient();
  }
  return mcpClientInstance;
}
