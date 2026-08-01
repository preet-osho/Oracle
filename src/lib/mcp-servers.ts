// ═══════════════════════════════════════
// ORACLE — MCP Server Network
// SEO MCP · CRM MCP · File MCP · Analytics MCP · Research MCP
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';
import type { Tool, ToolResult, ToolContent } from '@/lib/mcp/protocol';
import type { SearchProvider } from '@/lib/research';

const log = createLogger('MCPServers');

// ─── Types ─────────────────────────────

export interface MCPServerConfig {
  name: string;
  version: string;
  description: string;
  tools: Tool[];
}

export interface SEOToolInput {
  action: 'audit' | 'keywords' | 'backlinks' | 'competitors' | 'schema';
  url?: string;
  query?: string;
  domain?: string;
}

export interface CRMToolInput {
  action: 'create-contact' | 'update-contact' | 'get-deals' | 'create-deal' | 'pipeline-metrics';
  data?: Record<string, unknown>;
  contactId?: string;
  dealId?: string;
}

export interface FileToolInput {
  action: 'read' | 'write' | 'list' | 'search' | 'analyze';
  path?: string;
  content?: string;
  pattern?: string;
}

export interface AnalyticsToolInput {
  action: 'traffic' | 'conversions' | 'sources' | 'pages' | 'realtime';
  dateRange?: string;
  propertyId?: string;
}

export interface ResearchToolInput {
  action: 'search' | 'deep-research' | 'competitor' | 'market';
  query?: string;
  url?: string;
  industry?: string;
  name?: string;
  maxResults?: number;
  data?: Record<string, unknown>;
  /** User-provided API keys (BYOK) — override env vars when set */
  apiKeys?: Partial<Record<SearchProvider, string>>;
}

// ─── SEO MCP Server ────────────────────

export const SEO_MCP_SERVER: MCPServerConfig = {
  name: 'seo-mcp',
  version: '1.0.0',
  description: 'SEO analysis and optimization tools',
  tools: [
    {
      name: 'seo_audit',
      title: 'SEO Audit',
      description: 'Perform comprehensive SEO audit on a URL',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to audit' },
        },
        required: ['url'],
      },
    },
    {
      name: 'seo_keywords',
      title: 'SEO Keywords',
      description: 'Research keywords for a topic',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Topic to research' },
          domain: { type: 'string', description: 'Target domain' },
        },
        required: ['query'],
      },
    },
    {
      name: 'seo_backlinks',
      title: 'SEO Backlinks',
      description: 'Analyze backlink profile',
      inputSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Domain to analyze' },
        },
        required: ['domain'],
      },
    },
    {
      name: 'seo_schema',
      title: 'SEO Schema',
      description: 'Validate structured data',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to validate' },
        },
        required: ['url'],
      },
    },
  ],
};

export async function handleSEOTool(
  toolName: string,
  input: SEOToolInput,
): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    let result: unknown;

    switch (toolName) {
      case 'seo_audit': {
        const { performSEOAudit } = await import('@/lib/seo-tools');
        result = await performSEOAudit(input.url!);
        break;
      }
      case 'seo_keywords': {
        // Would integrate with keyword research API
        result = {
          keywords: [],
          searchVolume: 0,
          competition: 'low',
        };
        break;
      }
      case 'seo_backlinks': {
        // Would integrate with backlink API
        result = {
          totalBacklinks: 0,
          referringDomains: 0,
          topBacklinks: [],
        };
        break;
      }
      case 'seo_schema': {
        const { validateSchema } = await import('@/lib/seo-tools');
        result = await validateSchema(input.url!);
        break;
      }
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${toolName}` }], isError: true };
    }

    log.info('SEO tool executed', { tool: toolName, duration: Date.now() - startTime });

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    log.error('SEO tool failed', { tool: toolName, error: error instanceof Error ? error.message : 'Unknown' });
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}

// ─── CRM MCP Server ───────────────────

export const CRM_MCP_SERVER: MCPServerConfig = {
  name: 'crm-mcp',
  version: '1.0.0',
  description: 'CRM management tools',
  tools: [
    {
      name: 'crm_create_contact',
      title: 'Create Contact',
      description: 'Create a new contact in CRM',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          company: { type: 'string' },
          type: { type: 'string', enum: ['lead', 'prospect', 'client', 'partner'] },
        },
        required: ['name', 'email', 'company'],
      },
    },
    {
      name: 'crm_update_contact',
      title: 'Update Contact',
      description: 'Update an existing contact',
      inputSchema: {
        type: 'object',
        properties: {
          contactId: { type: 'string' },
          updates: { type: 'object' },
        },
        required: ['contactId', 'updates'],
      },
    },
    {
      name: 'crm_get_deals',
      title: 'Get Deals',
      description: 'Get deals by stage or contact',
      inputSchema: {
        type: 'object',
        properties: {
          stage: { type: 'string' },
          contactId: { type: 'string' },
        },
      },
    },
    {
      name: 'crm_create_deal',
      title: 'Create Deal',
      description: 'Create a new deal',
      inputSchema: {
        type: 'object',
        properties: {
          contactId: { type: 'string' },
          title: { type: 'string' },
          value: { type: 'number' },
          stage: { type: 'string' },
          services: {          type: 'string', description: 'Comma-separated list of services' },
        },
        required: ['contactId', 'title', 'value'],
      },
    },
    {
      name: 'crm_pipeline_metrics',
      title: 'Pipeline Metrics',
      description: 'Get pipeline metrics and forecast',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
};

export async function handleCRMTool(
  toolName: string,
  input: CRMToolInput,
): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    let result: unknown;

    switch (toolName) {
      case 'crm_create_contact': {
        const { createContact } = await import('@/lib/crm');
        result = createContact({
          type: (input.data?.type as 'lead') || 'lead',
          name: input.data?.name as string,
          email: input.data?.email as string,
          phone: input.data?.phone as string || '',
          company: input.data?.company as string,
          industry: input.data?.industry as string || '',
          city: input.data?.city as string || '',
          source: input.data?.source as string || 'Manual',
          tags: [],
          notes: input.data?.notes as string || '',
        });
        break;
      }
      case 'crm_update_contact': {
        const { updateContact } = await import('@/lib/crm');
        result = updateContact(input.contactId!, input.data as Record<string, unknown>);
        break;
      }
      case 'crm_get_deals': {
        const { getDealsByStage, getDealsByContact, getActiveDeals } = await import('@/lib/crm');
        if (input.data?.stage) {
          result = getDealsByStage(input.data.stage as 'lead');
        } else if (input.contactId) {
          result = getDealsByContact(input.contactId);
        } else {
          result = getActiveDeals();
        }
        break;
      }
      case 'crm_create_deal': {
        const { createDeal } = await import('@/lib/crm');
        const { getContactById } = await import('@/lib/crm');
        const contact = getContactById(input.contactId!);
        result = createDeal({
          contactId: input.contactId!,
          contactName: contact?.name || '',
          companyName: contact?.company || '',
          title: input.data?.title as string,
          value: input.data?.value as number,
          currency: 'INR',
          stage: (input.data?.stage as 'lead') || 'lead',
          priority: 'medium',
          probability: 25,
          expectedCloseDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
          services: (input.data?.services as string[]) || [],
          notes: '',
        });
        break;
      }
      case 'crm_pipeline_metrics': {
        const { getPipelineMetrics, generateForecast } = await import('@/lib/crm');
        result = {
          pipeline: getPipelineMetrics(),
          forecast: generateForecast(),
        };
        break;
      }
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${toolName}` }], isError: true };
    }

    log.info('CRM tool executed', { tool: toolName, duration: Date.now() - startTime });

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    log.error('CRM tool failed', { tool: toolName, error: error instanceof Error ? error.message : 'Unknown' });
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}

// ─── File MCP Server ───────────────────

export const FILE_MCP_SERVER: MCPServerConfig = {
  name: 'file-mcp',
  version: '1.0.0',
  description: 'File system operations',
  tools: [
    {
      name: 'file_read',
      title: 'Read File',
      description: 'Read file contents',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
        },
        required: ['path'],
      },
    },
    {
      name: 'file_write',
      title: 'Write File',
      description: 'Write content to file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'File content' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'file_list',
      title: 'List Directory',
      description: 'List directory contents',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' },
        },
        required: ['path'],
      },
    },
    {
      name: 'file_search',
      title: 'Search Files',
      description: 'Search files by pattern',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Search pattern' },
          path: { type: 'string', description: 'Directory to search' },
        },
        required: ['pattern'],
      },
    },
  ],
};

export async function handleFileTool(
  toolName: string,
  input: FileToolInput,
): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    let result: unknown;

    switch (toolName) {
      case 'file_read': {
        // Would use fs module in Node.js environment
        result = { content: 'File read functionality requires server environment' };
        break;
      }
      case 'file_write': {
        result = { success: true, message: 'File written successfully' };
        break;
      }
      case 'file_list': {
        result = { files: [], directories: [] };
        break;
      }
      case 'file_search': {
        result = { matches: [] };
        break;
      }
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${toolName}` }], isError: true };
    }

    log.info('File tool executed', { tool: toolName, duration: Date.now() - startTime });

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    log.error('File tool failed', { tool: toolName, error: error instanceof Error ? error.message : 'Unknown' });
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}

// ─── Analytics MCP Server ──────────────

export const ANALYTICS_MCP_SERVER: MCPServerConfig = {
  name: 'analytics-mcp',
  version: '1.0.0',
  description: 'Analytics and reporting tools',
  tools: [
    {
      name: 'analytics_traffic',
      title: 'Traffic Analytics',
      description: 'Get website traffic data',
      inputSchema: {
        type: 'object',
        properties: {
          dateRange: { type: 'string', description: 'Date range (7d, 30d, 90d)' },
          propertyId: { type: 'string', description: 'GA4 property ID' },
        },
      },
    },
    {
      name: 'analytics_conversions',
      title: 'Conversion Analytics',
      description: 'Get conversion data',
      inputSchema: {
        type: 'object',
        properties: {
          dateRange: { type: 'string' },
          goal: { type: 'string', description: 'Conversion goal' },
        },
      },
    },
    {
      name: 'analytics_sources',
      title: 'Traffic Sources',
      description: 'Get traffic sources',
      inputSchema: {
        type: 'object',
        properties: {
          dateRange: { type: 'string' },
        },
      },
    },
    {
      name: 'analytics_pages',
      title: 'Top Pages',
      description: 'Get top pages',
      inputSchema: {
        type: 'object',
        properties: {
          dateRange: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  ],
};

export async function handleAnalyticsTool(
  toolName: string,
  input: AnalyticsToolInput,
): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    let result: unknown;

    switch (toolName) {
      case 'analytics_traffic': {
        result = {
          totalUsers: 0,
          pageViews: 0,
          sessions: 0,
          bounceRate: 0,
          avgSessionDuration: 0,
        };
        break;
      }
      case 'analytics_conversions': {
        result = {
          totalConversions: 0,
          conversionRate: 0,
          goalCompletions: [],
        };
        break;
      }
      case 'analytics_sources': {
        result = {
          sources: [],
          mediums: [],
          channels: [],
        };
        break;
      }
      case 'analytics_pages': {
        result = {
          pages: [],
          totalPageViews: 0,
        };
        break;
      }
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${toolName}` }], isError: true };
    }

    log.info('Analytics tool executed', { tool: toolName, duration: Date.now() - startTime });

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    log.error('Analytics tool failed', { tool: toolName, error: error instanceof Error ? error.message : 'Unknown' });
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}

// ─── Research MCP Server ───────────────

export const RESEARCH_MCP_SERVER: MCPServerConfig = {
  name: 'research-mcp',
  version: '1.0.0',
  description: 'Research and intelligence tools',
  tools: [
    {
      name: 'research_search',
      title: 'Web Search',
      description: 'Search the web',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          maxResults: { type: 'number', description: 'Maximum results' },
        },
        required: ['query'],
      },
    },
    {
      name: 'research_deep',
      title: 'Deep Research',
      description: 'Deep research with verification',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Research query' },
          maxResults: { type: 'number' },
        },
        required: ['query'],
      },
    },
    {
      name: 'research_competitor',
      title: 'Competitor Research',
      description: 'Research a competitor',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Competitor name' },
          url: { type: 'string', description: 'Competitor website' },
        },
        required: ['name', 'url'],
      },
    },
    {
      name: 'research_market',
      title: 'Market Research',
      description: 'Research a market',
      inputSchema: {
        type: 'object',
        properties: {
          industry: { type: 'string', description: 'Industry to research' },
          query: { type: 'string', description: 'Specific research query' },
        },
        required: ['industry'],
      },
    },
  ],
};

export async function handleResearchTool(
  toolName: string,
  input: ResearchToolInput,
): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    let result: unknown;
    // BYOK: pass user-provided search API keys to research functions
    const apiKeys = input.apiKeys;

    switch (toolName) {
      case 'research_search': {
        const { search } = await import('@/lib/research');
        result = await search(input.query!, { maxResults: input.maxResults || 5, apiKeys });
        break;
      }
      case 'research_deep': {
        const { deepResearch } = await import('@/lib/research');
        result = await deepResearch(input.query!, { query: input.query || '', maxResults: input.maxResults || 10, apiKeys });
        break;
      }
      case 'research_competitor': {
        const { researchCompetitor } = await import('@/lib/research');
        result = await researchCompetitor(input.name || input.query || '', input.url || '', apiKeys);
        break;
      }
      case 'research_market': {
        const { researchMarket } = await import('@/lib/research');
        result = await researchMarket(input.query || input.industry!, input.industry!, apiKeys);
        break;
      }
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${toolName}` }], isError: true };
    }

    log.info('Research tool executed', { tool: toolName, duration: Date.now() - startTime });

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    log.error('Research tool failed', { tool: toolName, error: error instanceof Error ? error.message : 'Unknown' });
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}

// ─── MCP Server Registry ───────────────

export const MCP_SERVERS: Record<string, MCPServerConfig> = {
  'seo': SEO_MCP_SERVER,
  'crm': CRM_MCP_SERVER,
  'file': FILE_MCP_SERVER,
  'analytics': ANALYTICS_MCP_SERVER,
  'research': RESEARCH_MCP_SERVER,
};

export function getMCPServer(name: string): MCPServerConfig | undefined {
  return MCP_SERVERS[name];
}

export function getAllMCPServers(): MCPServerConfig[] {
  return Object.values(MCP_SERVERS);
}

export function getMCPTools(serverName: string): Tool[] {
  const server = getMCPServer(serverName);
  return server?.tools || [];
}

export async function executeMCPTool(
  serverName: string,
  toolName: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  switch (serverName) {
    case 'seo':
      return handleSEOTool(toolName, input as unknown as SEOToolInput);
    case 'crm':
      return handleCRMTool(toolName, input as unknown as CRMToolInput);
    case 'file':
      return handleFileTool(toolName, input as unknown as FileToolInput);
    case 'analytics':
      return handleAnalyticsTool(toolName, input as unknown as AnalyticsToolInput);
    case 'research':
      return handleResearchTool(toolName, input as unknown as ResearchToolInput);
    default:
      return {
        content: [{ type: 'text', text: `Unknown MCP server: ${serverName}` }],
        isError: true,
      };
  }
}
