// ═══════════════════════════════════════
// ORACLE — MCP Client Manager
// Connect to servers · Route tool calls · Aggregate capabilities
// ═══════════════════════════════════════

import { McpServer } from './server';
import type { Tool, ToolResult, McpServerConfig } from './protocol';
import { createBrowserMcpServer } from './servers/browser';
import { createSearchMcpServer } from './servers/search';
import { createSeoMcpServer } from './servers/seo';
import { createCrmMcpServer } from './servers/crm';
import { createSocialMediaMcpServer } from './servers/social-media';
import { createLogger } from '@/lib/logger';

const log = createLogger('MCP:Client');

// ─── Server Registry ──────────────────

export const MCP_SERVER_REGISTRY: McpServerConfig[] = [
  {
    id: 'browser',
    name: 'Browser MCP',
    description: 'Web automation: navigation, screenshots, form filling, data extraction',
    version: '1.0.0',
    capabilities: { tools: { listChanged: false } },
    envVars: [],
    enabled: true,
  },
  {
    id: 'search',
    name: 'Search MCP',
    description: 'Multi-provider web search: Tavily, Serper, Brave',
    version: '1.0.0',
    capabilities: { tools: { listChanged: false } },
    envVars: ['TAVILY_API_KEY', 'SERPER_API_KEY', 'BRAVE_SEARCH_API_KEY'],
    enabled: true,
  },
  {
    id: 'seo',
    name: 'SEO MCP',
    description: 'SEO audits, keyword research, schema checks, technical/local SEO',
    version: '1.0.0',
    capabilities: { tools: { listChanged: false } },
    envVars: ['FIRECRAWL_API_KEY'],
    enabled: true,
  },
  {
    id: 'crm',
    name: 'CRM MCP',
    description: 'Contact management, deals pipeline, activity logging, stats',
    version: '1.0.0',
    capabilities: { tools: { listChanged: false } },
    envVars: [],
    enabled: true,
  },
  {
    id: 'social-media',
    name: 'Social Media MCP',
    description: 'Social media post creation, scheduling, publishing, and analytics across LinkedIn, Instagram, Facebook, and WhatsApp',
    version: '1.0.0',
    capabilities: { tools: { listChanged: false } },
    envVars: ['LINKEDIN_ACCESS_TOKEN', 'INSTAGRAM_ACCESS_TOKEN', 'FACEBOOK_PAGE_ACCESS_TOKEN'],
    enabled: true,
  },
];

// ─── Client Manager ───────────────────

interface ConnectedServer {
  config: McpServerConfig;
  server: McpServer;
  connectedAt: number;
  lastActivity: number;
}

export class McpClientManager {
  private servers = new Map<string, ConnectedServer>();
  private toolServerMap = new Map<string, string>(); // toolName → serverId

  /**
   * Connect to all enabled MCP servers.
   */
  async connectAll(): Promise<void> {
    const factories: Record<string, () => McpServer> = {
      browser: createBrowserMcpServer,
      search: createSearchMcpServer,
      seo: createSeoMcpServer,
      crm: createCrmMcpServer,
      'social-media': createSocialMediaMcpServer,
    };

    for (const config of MCP_SERVER_REGISTRY) {
      if (!config.enabled) continue;
      try {
        const factory = factories[config.id];
        if (!factory) continue;

        const server = factory();
        const info = server.getInfo();

        this.servers.set(config.id, {
          config,
          server,
          connectedAt: Date.now(),
          lastActivity: Date.now(),
        });

        // Index tools for quick lookup
        const toolsList = await server.handleRequest({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
        });
        const tools = (toolsList.result as { tools: Tool[] })?.tools ?? [];
        for (const tool of tools) {
          this.toolServerMap.set(tool.name, config.id);
        }

        log.info('MCP server connected', { id: config.id, name: config.name, tools: info.toolCount });
      } catch (error) {
        log.error('Failed to connect MCP server', { id: config.id, error: error instanceof Error ? error.message : 'Unknown' });
      }
    }
  }

  /**
   * Connect to a specific server by ID.
   */
  async connect(serverId: string): Promise<boolean> {
    const config = MCP_SERVER_REGISTRY.find((c) => c.id === serverId);
    if (!config) return false;

    const factories: Record<string, () => McpServer> = {
      browser: createBrowserMcpServer,
      search: createSearchMcpServer,
      seo: createSeoMcpServer,
      crm: createCrmMcpServer,
      'social-media': createSocialMediaMcpServer,
    };

    const factory = factories[serverId];
    if (!factory) return false;

    const server = factory();
    this.servers.set(serverId, {
      config,
      server,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
    });

    const toolsList = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    });
    const tools = (toolsList.result as { tools: Tool[] })?.tools ?? [];
    for (const tool of tools) {
      this.toolServerMap.set(tool.name, serverId);
    }

    return true;
  }

  /**
   * Disconnect from a server.
   */
  disconnect(serverId: string): void {
    const server = this.servers.get(serverId);
    if (!server) return;

    // Remove tool mappings
    for (const [toolName, id] of this.toolServerMap) {
      if (id === serverId) this.toolServerMap.delete(toolName);
    }

    this.servers.delete(serverId);
    log.info('MCP server disconnected', { id: serverId });
  }

  /**
   * Call a tool by name. Routes to the correct server automatically.
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const serverId = this.toolServerMap.get(toolName);
    if (!serverId) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
    }

    const connected = this.servers.get(serverId);
    if (!connected) {
      return {
        content: [{ type: 'text', text: `Server not connected: ${serverId}` }],
        isError: true,
      };
    }

    connected.lastActivity = Date.now();

    const response = await connected.server.handleRequest({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    });

    if (response.error) {
      return {
        content: [{ type: 'text', text: `Error: ${response.error.message}` }],
        isError: true,
      };
    }

    return (response.result as ToolResult) ?? {
      content: [{ type: 'text', text: 'Empty response' }],
    };
  }

  /**
   * List all available tools across all connected servers.
   */
  async listAllTools(): Promise<Tool[]> {
    const tools: Tool[] = [];

    for (const [, connected] of this.servers) {
      const response = await connected.server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });
      const serverTools = (response.result as { tools: Tool[] })?.tools ?? [];
      tools.push(...serverTools);
    }

    return tools;
  }

  /**
   * List tools for a specific server.
   */
  async listTools(serverId: string): Promise<Tool[]> {
    const connected = this.servers.get(serverId);
    if (!connected) return [];

    const response = await connected.server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    });
    return (response.result as { tools: Tool[] })?.tools ?? [];
  }

  /**
   * Get status of all connected servers.
   */
  getStatus(): Array<{
    id: string;
    name: string;
    connected: boolean;
    toolCount: number;
    connectedAt: number;
    lastActivity: number;
  }> {
    return MCP_SERVER_REGISTRY.map((config) => {
      const connected = this.servers.get(config.id);
      return {
        id: config.id,
        name: config.name,
        connected: !!connected,
        toolCount: connected ? connected.server.getInfo().toolCount : 0,
        connectedAt: connected?.connectedAt ?? 0,
        lastActivity: connected?.lastActivity ?? 0,
      };
    });
  }

  /**
   * Find which server owns a tool.
   */
  findToolServer(toolName: string): string | undefined {
    return this.toolServerMap.get(toolName);
  }
}

// ─── Singleton ────────────────────────

let managerInstance: McpClientManager | null = null;

export function getMcpManager(): McpClientManager {
  if (!managerInstance) {
    managerInstance = new McpClientManager();
  }
  return managerInstance;
}
