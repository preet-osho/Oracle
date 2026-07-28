// ═══════════════════════════════════════
// ORACLE — MCP Server Tests
// ═══════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MCP_SERVERS,
  MCPClient,
  getMCPClient,
  type MCPServerDefinition,
  type MCPTool,
  type MCPHealthCheckResult,
  type MCPHealthStatus,
} from './mcp-servers';

// --- MCP Server Registry Tests ----------

describe('MCP_SERVERS Registry', () => {
  it('should have all 13 MCP servers defined', () => {
    const serverNames = Object.keys(MCP_SERVERS);
    expect(serverNames.length).toBe(13);
  });

  it('should have all required server properties', () => {
    for (const [name, server] of Object.entries(MCP_SERVERS)) {
      expect(server.name).toBeTruthy();
      expect(server.description).toBeTruthy();
      expect(server.version).toBeTruthy();
      expect(Array.isArray(server.tools)).toBe(true);
      expect(Array.isArray(server.permissions)).toBe(true);
      expect(server.tools.length).toBeGreaterThan(0);
    }
  });

  it('should have unique server names', () => {
    const names = Object.values(MCP_SERVERS).map((s) => s.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('should have valid tool definitions for each server', () => {
    for (const [name, server] of Object.entries(MCP_SERVERS)) {
      for (const tool of server.tools) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.outputSchema).toBeDefined();
        expect(Array.isArray(tool.permissions)).toBe(true);
      }
    }
  });

  it('should have matching required fields in input schemas', () => {
    for (const [name, server] of Object.entries(MCP_SERVERS)) {
      for (const tool of server.tools) {
        if (tool.inputSchema.required) {
          expect(Array.isArray(tool.inputSchema.required)).toBe(true);
        }
      }
    }
  });

  it('browser-mcp should have browse_url and scrape_page tools', () => {
    const server = MCP_SERVERS['browser-mcp'];
    expect(server).toBeDefined();
    const toolNames = server.tools.map((t) => t.name);
    expect(toolNames).toContain('browse_url');
    expect(toolNames).toContain('scrape_page');
  });

  it('seo-mcp should have audit_website and keyword_research tools', () => {
    const server = MCP_SERVERS['seo-mcp'];
    expect(server).toBeDefined();
    const toolNames = server.tools.map((t) => t.name);
    expect(toolNames).toContain('audit_website');
    expect(toolNames).toContain('keyword_research');
  });

  it('crm-mcp should have add_lead and get_pipeline tools', () => {
    const server = MCP_SERVERS['crm-mcp'];
    expect(server).toBeDefined();
    const toolNames = server.tools.map((t) => t.name);
    expect(toolNames).toContain('add_lead');
    expect(toolNames).toContain('get_pipeline');
  });

  it('memory-mcp should have store_memory and retrieve_memories tools', () => {
    const server = MCP_SERVERS['memory-mcp'];
    expect(server).toBeDefined();
    const toolNames = server.tools.map((t) => t.name);
    expect(toolNames).toContain('store_memory');
    expect(toolNames).toContain('retrieve_memories');
  });

  it('file-mcp should have read_file and write_file tools', () => {
    const server = MCP_SERVERS['file-mcp'];
    expect(server).toBeDefined();
    const toolNames = server.tools.map((t) => t.name);
    expect(toolNames).toContain('read_file');
    expect(toolNames).toContain('write_file');
  });

  it('analytics-mcp should have get_metrics and generate_report tools', () => {
    const server = MCP_SERVERS['analytics-mcp'];
    expect(server).toBeDefined();
    const toolNames = server.tools.map((t) => t.name);
    expect(toolNames).toContain('get_metrics');
    expect(toolNames).toContain('generate_report');
  });

  it('social-mcp should have schedule_post and get_analytics tools', () => {
    const server = MCP_SERVERS['social-mcp'];
    expect(server).toBeDefined();
    const toolNames = server.tools.map((t) => t.name);
    expect(toolNames).toContain('schedule_post');
    expect(toolNames).toContain('get_analytics');
  });

  it('ads-mcp should have create_campaign and get_performance tools', () => {
    const server = MCP_SERVERS['ads-mcp'];
    expect(server).toBeDefined();
    const toolNames = server.tools.map((t) => t.name);
    expect(toolNames).toContain('create_campaign');
    expect(toolNames).toContain('get_performance');
  });

  it('research-mcp should have analyze_competitor and market_research tools', () => {
    const server = MCP_SERVERS['research-mcp'];
    expect(server).toBeDefined();
    const toolNames = server.tools.map((t) => t.name);
    expect(toolNames).toContain('analyze_competitor');
    expect(toolNames).toContain('market_research');
  });

  it('design-mcp should have generate_ad_creative and create_social_graphics tools', () => {
    const server = MCP_SERVERS['design-mcp'];
    expect(server).toBeDefined();
    const toolNames = server.tools.map((t) => t.name);
    expect(toolNames).toContain('generate_ad_creative');
    expect(toolNames).toContain('create_social_graphics');
  });

  it('video-mcp should have create_video_script and repurpose_video tools', () => {
    const server = MCP_SERVERS['video-mcp'];
    expect(server).toBeDefined();
    const toolNames = server.tools.map((t) => t.name);
    expect(toolNames).toContain('create_video_script');
    expect(toolNames).toContain('repurpose_video');
  });

  it('reporting-mcp should have generate_client_report tool', () => {
    const server = MCP_SERVERS['reporting-mcp'];
    expect(server).toBeDefined();
    const toolNames = server.tools.map((t) => t.name);
    expect(toolNames).toContain('generate_client_report');
  });
});

// --- Health Check Tests -----------------

describe('MCP Server Health Checks', () => {
  it('all servers should have healthCheck functions', () => {
    for (const [name, server] of Object.entries(MCP_SERVERS)) {
      expect(server.healthCheck, `${name} should have healthCheck`).toBeDefined();
      expect(typeof server.healthCheck).toBe('function');
    }
  });

  it('healthCheck should return valid MCPHealthCheckResult', async () => {
    for (const [name, server] of Object.entries(MCP_SERVERS)) {
      const result = await server.healthCheck!();
      expect(result.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy', 'unknown']).toContain(result.status);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.lastChecked).toBeGreaterThan(0);
    }
  });

  it('healthCheck should return healthy status by default', async () => {
    for (const [name, server] of Object.entries(MCP_SERVERS)) {
      const result = await server.healthCheck!();
      expect(result.status).toBe('healthy');
    }
  });

  it('healthCheck should measure latency', async () => {
    const server = MCP_SERVERS['memory-mcp']; // 5ms simulated latency
    const result = await server.healthCheck!();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

// --- MCPClient Tests --------------------

describe('MCPClient', () => {
  let client: MCPClient;

  beforeEach(() => {
    client = new MCPClient();
  });

  describe('listServers', () => {
    it('should return all servers', () => {
      const servers = client.listServers();
      expect(servers.length).toBe(13);
    });

    it('should return MCPServerDefinition objects', () => {
      const servers = client.listServers();
      for (const server of servers) {
        expect(server.name).toBeTruthy();
        expect(server.tools).toBeDefined();
      }
    });
  });

  describe('listTools', () => {
    it('should return tools for a valid server', () => {
      const tools = client.listTools('browser-mcp');
      expect(tools.length).toBe(2);
      expect(tools[0].name).toBe('browse_url');
    });

    it('should throw for unknown server', () => {
      expect(() => client.listTools('nonexistent')).toThrow('Unknown MCP server');
    });
  });

  describe('callTool', () => {
    it('should call a valid tool successfully', async () => {
      const result = await client.callTool('browser-mcp', 'browse_url', { url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should fail for unknown server', async () => {
      const result = await client.callTool('nonexistent', 'tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown MCP server');
    });

    it('should fail for unknown tool', async () => {
      const result = await client.callTool('browser-mcp', 'nonexistent_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });

    it('should track call history', async () => {
      await client.callTool('browser-mcp', 'browse_url', { url: 'https://example.com' });
      await client.callTool('seo-mcp', 'audit_website', { url: 'https://example.com' });

      const history = client.getCallHistory();
      expect(history.length).toBe(2);
      expect(history[0].serverName).toBe('browser-mcp');
      expect(history[1].serverName).toBe('seo-mcp');
    });

    it('should limit call history', async () => {
      for (let i = 0; i < 10; i++) {
        await client.callTool('browser-mcp', 'browse_url', { url: `https://example.com/${i}` });
      }

      const history = client.getCallHistory(5);
      expect(history.length).toBe(5);
    });
  });

  describe('checkServerHealth', () => {
    it('should check health of a known server', async () => {
      const result = await client.checkServerHealth('browser-mcp');

      expect(result.status).toBe('healthy');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.lastChecked).toBeGreaterThan(0);
    });

    it('should return unhealthy for unknown server', async () => {
      const result = await client.checkServerHealth('nonexistent');

      expect(result.status).toBe('unhealthy');
      expect(result.error).toContain('Unknown server');
    });

    it('should cache health results', async () => {
      const result1 = await client.checkServerHealth('browser-mcp');
      const result2 = await client.checkServerHealth('browser-mcp');

      // Should return cached result (same lastChecked)
      expect(result1.lastChecked).toBe(result2.lastChecked);
    });

    it('should refresh when forceRefresh is true', async () => {
      const result1 = await client.checkServerHealth('browser-mcp');
      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));
      const result2 = await client.checkServerHealth('browser-mcp', true);

      // Should have updated lastChecked
      expect(result2.lastChecked).toBeGreaterThanOrEqual(result1.lastChecked);
    });
  });

  describe('healthCheck (all servers)', () => {
    it('should check health of all servers', async () => {
      const results = await client.healthCheck();

      expect(Object.keys(results).length).toBe(13);
      for (const [name, result] of Object.entries(results)) {
        expect(result.status).toBeDefined();
        expect(['healthy', 'degraded', 'unhealthy', 'unknown']).toContain(result.status);
      }
    });

    it('should run in parallel by default', async () => {
      const start = Date.now();
      await client.healthCheck();
      const duration = Date.now() - start;

      // Parallel should be faster than sequential (13 servers * ~5-40ms each)
      // But we just verify it completes in reasonable time
      expect(duration).toBeLessThan(5000);
    });

    it('should support sequential mode', async () => {
      const results = await client.healthCheck({ parallel: false });

      expect(Object.keys(results).length).toBe(13);
    });

    it('should support forceRefresh', async () => {
      await client.healthCheck();
      const results = await client.healthCheck({ forceRefresh: true });

      expect(Object.keys(results).length).toBe(13);
    });
  });

  describe('getHealthSummary', () => {
    it('should calculate summary correctly', async () => {
      const results = await client.healthCheck();
      const summary = client.getHealthSummary(results);

      expect(summary.total).toBe(13);
      expect(summary.healthy).toBe(13);
      expect(summary.degraded).toBe(0);
      expect(summary.unhealthy).toBe(0);
      expect(summary.unknown).toBe(0);
      expect(summary.allHealthy).toBe(true);
    });

    it('should handle mixed statuses', () => {
      const results: Record<string, MCPHealthCheckResult> = {
        'server-1': { status: 'healthy', latencyMs: 10, lastChecked: Date.now() },
        'server-2': { status: 'degraded', latencyMs: 100, lastChecked: Date.now() },
        'server-3': { status: 'unhealthy', latencyMs: 0, lastChecked: Date.now(), error: 'timeout' },
        'server-4': { status: 'unknown', latencyMs: 0, lastChecked: Date.now() },
      };

      const summary = client.getHealthSummary(results);

      expect(summary.total).toBe(4);
      expect(summary.healthy).toBe(1);
      expect(summary.degraded).toBe(1);
      expect(summary.unhealthy).toBe(1);
      expect(summary.unknown).toBe(1);
      expect(summary.allHealthy).toBe(false);
    });
  });

  describe('clearHealthCache', () => {
    it('should clear the health cache', async () => {
      await client.checkServerHealth('browser-mcp');
      client.clearHealthCache();

      // After clearing, next check should not use cache
      const result = await client.checkServerHealth('browser-mcp');
      expect(result.status).toBe('healthy');
    });
  });

  describe('getServerCount and getTotalToolCount', () => {
    it('should return correct server count', () => {
      expect(client.getServerCount()).toBe(13);
    });

    it('should return correct total tool count', () => {
      const totalTools = client.getTotalToolCount();
      // 12 servers with 2 tools + reporting-mcp with 1 tool = 25 tools
      expect(totalTools).toBe(25);
    });
  });
});

// --- Singleton Tests --------------------

describe('getMCPClient', () => {
  it('should return a singleton instance', () => {
    const client1 = getMCPClient();
    const client2 = getMCPClient();
    expect(client1).toBe(client2);
  });
});
