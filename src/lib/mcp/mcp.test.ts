// ═══════════════════════════════════════
// ORACLE — MCP Server Tests
// Protocol · Base server · Client manager
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from './server';
import { McpClientManager, getMcpManager } from './client';
import type { Tool, ToolResult } from './protocol';
import { MCP_PROTOCOL_VERSION } from './protocol';

// ─── Mock Playwright for browser MCP ──
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn(),
          title: vi.fn().mockResolvedValue('Test Page'),
          textContent: vi.fn().mockResolvedValue('Page content'),
          $$eval: vi.fn().mockResolvedValue([]),
          $$: vi.fn().mockResolvedValue([]),
          screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
          fill: vi.fn(),
          click: vi.fn(),
          waitForLoadState: vi.fn(),
          url: vi.fn().mockReturnValue('https://example.com'),
          close: vi.fn(),
        }),
        close: vi.fn(),
        setDefaultTimeout: vi.fn(),
      }),
      close: vi.fn(),
    }),
  },
}));

// ═══════════════════════════════════════
// McpServer Base Class Tests
// ═══════════════════════════════════════

describe('McpServer', () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer('test-server', '1.0.0', {
      tools: { listChanged: false },
    });
  });

  describe('initialize', () => {
    it('returns protocol version and capabilities', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      });

      expect(response.result).toEqual({
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'test-server', version: '1.0.0' },
      });
    });
  });

  describe('tools/list', () => {
    it('returns empty tools list initially', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });

      expect(response.result).toEqual({ tools: [] });
    });

    it('returns registered tools', async () => {
      const tool: Tool = {
        name: 'test_tool',
        title: 'Test Tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: { input: { type: 'string' } },
          required: ['input'],
        },
      };

      server.registerTool(tool, async () => ({
        content: [{ type: 'text', text: 'ok' }],
      }));

      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
      });

      const result = response.result as { tools: Tool[] };
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('test_tool');
    });
  });

  describe('tools/call', () => {
    it('calls a registered tool', async () => {
      const tool: Tool = {
        name: 'echo',
        title: 'Echo',
        description: 'Echoes input',
        inputSchema: {
          type: 'object',
          properties: { message: { type: 'string' } },
          required: ['message'],
        },
      };

      server.registerTool(tool, async (args) => ({
        content: [{ type: 'text', text: `Echo: ${args.message}` }],
      }));

      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'echo', arguments: { message: 'hello' } },
      });

      const result = response.result as ToolResult;
      expect(result.content[0].text).toBe('Echo: hello');
      expect(result.isError).toBeFalsy();
    });

    it('returns error for unknown tool', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'nonexistent', arguments: {} },
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32601);
    });

    it('returns error for missing tool name', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {},
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602);
    });

    it('handles tool execution errors gracefully', async () => {
      const tool: Tool = {
        name: 'fail_tool',
        title: 'Fail Tool',
        description: 'Always fails',
        inputSchema: { type: 'object', properties: {}, required: [] },
      };

      server.registerTool(tool, async () => {
        throw new Error('Tool exploded');
      });

      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'fail_tool', arguments: {} },
      });

      const result = response.result as ToolResult;
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Tool exploded');
    });
  });

  describe('unknown methods', () => {
    it('returns method not found error', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 8,
        method: 'unknown/method',
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32601);
    });
  });

  describe('ping', () => {
    it('responds to ping', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 9,
        method: 'ping',
      });

      expect(response.result).toEqual({});
    });
  });

  describe('getInfo', () => {
    it('returns server info', () => {
      const tool: Tool = {
        name: 't1',
        title: 'T1',
        description: '',
        inputSchema: { type: 'object', properties: {}, required: [] },
      };
      server.registerTool(tool, async () => ({ content: [] }));

      const info = server.getInfo();
      expect(info.name).toBe('test-server');
      expect(info.version).toBe('1.0.0');
      expect(info.toolCount).toBe(1);
      expect(info.resourceCount).toBe(0);
      expect(info.promptCount).toBe(0);
    });
  });
});

// ═══════════════════════════════════════
// McpClientManager Tests
// ═══════════════════════════════════════

describe('McpClientManager', () => {
  let manager: McpClientManager;

  beforeEach(() => {
    manager = new McpClientManager();
  });

  describe('connectAll', () => {
    it('connects to all enabled servers', async () => {
      await manager.connectAll();
      const status = manager.getStatus();

      expect(status.length).toBe(5);
      expect(status.every((s) => s.connected)).toBe(true);
    });
  });

  describe('listAllTools', () => {
    it('returns tools from all connected servers', async () => {
      await manager.connectAll();
      const tools = await manager.listAllTools();

      // Browser MCP has 8 tools, Search has 4, SEO has 5, CRM has 10, Social Media has 14
      expect(tools.length).toBeGreaterThanOrEqual(35);
    });
  });

  describe('callTool', () => {
    it('routes tool calls to correct server', async () => {
      await manager.connectAll();

      // Call a CRM tool
      const result = await manager.callTool('crm_list_contacts', {});
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('returns error for unknown tools', async () => {
      const result = await manager.callTool('unknown_tool', {});
      expect(result.isError).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('returns status for all registered servers', async () => {
      const status = manager.getStatus();
      expect(status).toHaveLength(5);

      const ids = status.map((s) => s.id);
      expect(ids).toContain('browser');
      expect(ids).toContain('search');
      expect(ids).toContain('seo');
      expect(ids).toContain('crm');
      expect(ids).toContain('social-media');
    });
  });

  describe('connect/disconnect', () => {
    it('can connect and disconnect individual servers', async () => {
      const connected = await manager.connect('browser');
      expect(connected).toBe(true);

      const status = manager.getStatus();
      const browser = status.find((s) => s.id === 'browser');
      expect(browser?.connected).toBe(true);

      manager.disconnect('browser');
      const statusAfter = manager.getStatus();
      const browserAfter = statusAfter.find((s) => s.id === 'browser');
      expect(browserAfter?.connected).toBe(false);
    });
  });
});

// ═══════════════════════════════════════
// MCP Server Integration Tests
// ═══════════════════════════════════════

describe('MCP Server Integration', () => {
  it('CRM: create and search contacts', async () => {
    const { createCrmMcpServer } = await import('./servers/crm');
    const server = createCrmMcpServer();

    // Create a contact
    const createResult = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'crm_create_contact',
        arguments: {
          name: 'Test Corp',
          email: 'test@test.com',
          company: 'Test Corp',
          city: 'Mumbai',
          industry: 'Technology',
        },
      },
    });

    const createOutput = createResult.result as ToolResult;
    expect(createOutput.content[0].text).toContain('Contact created');

    // Search for it
    const searchResult = await server.handleRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'crm_search_contacts',
        arguments: { query: 'Test Corp' },
      },
    });

    const searchOutput = searchResult.result as ToolResult;
    expect(searchOutput.content[0].text).toContain('Test Corp');
  });

  it('SEO: keyword research generates relevant keywords', async () => {
    const { createSeoMcpServer } = await import('./servers/seo');
    const server = createSeoMcpServer();

    const result = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'seo_keyword_research',
        arguments: {
          topic: 'dental clinic',
          location: 'Mumbai',
          industry: 'healthcare',
        },
      },
    });

    const output = result.result as ToolResult;
    expect(output.content[0].text).toContain('dental clinic');
    expect(output.content[0].text).toContain('Mumbai');
    expect(output.content[0].text).toContain('healthcare');
  });

  it('SEO: keyword research works without location', async () => {
    const { createSeoMcpServer } = await import('./servers/seo');
    const server = createSeoMcpServer();

    const result = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'seo_keyword_research',
        arguments: { topic: 'digital marketing agency' },
      },
    });

    const output = result.result as ToolResult;
    expect(output.content[0].text).toContain('digital marketing agency');
    expect(output.content[0].text).toContain('KEYWORD RESEARCH');
  });

  it('Search MCP: returns error when no API keys configured', async () => {
    const { createSearchMcpServer } = await import('./servers/search');
    const server = createSearchMcpServer();

    const result = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'search_web',
        arguments: { query: 'test' },
      },
    });

    const output = result.result as ToolResult;
    expect(output.isError).toBe(true);
    expect(output.content[0].text).toContain('No search providers configured');
  });

  it('Browser MCP: sessions tool lists active sessions', async () => {
    const { createBrowserMcpServer } = await import('./servers/browser');
    const server = createBrowserMcpServer();

    const result = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'browser_sessions', arguments: {} },
    });

    const output = result.result as ToolResult;
    expect(output.content[0].text).toBeDefined();
  });
});

// ═══════════════════════════════════════
// Singleton Test
// ═══════════════════════════════════════

describe('getMcpManager', () => {
  it('returns the same instance', () => {
    const a = getMcpManager();
    const b = getMcpManager();
    expect(a).toBe(b);
  });
});
