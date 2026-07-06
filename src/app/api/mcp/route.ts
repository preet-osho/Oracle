// ═══════════════════════════════════════
// ORACLE — MCP API Route
// JSON-RPC 2.0 gateway for all MCP servers
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { getMcpManager } from '@/lib/mcp/client';
import type { JsonRpcRequest } from '@/lib/mcp/protocol';

/**
 * POST /api/mcp
 *
 * JSON-RPC 2.0 gateway for MCP tool calls.
 *
 * Request body:
 *   { "method": "tools/list" }                          → list all tools
 *   { "method": "tools/call", "params": { "name": "...", "arguments": {} } }  → call a tool
 *   { "method": "status" }                              → server status
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as JsonRpcRequest;
    const { method, params, id } = body;

    const manager = getMcpManager();

    // Auto-connect on first call
    if (manager.getStatus().every((s) => !s.connected)) {
      await manager.connectAll();
    }

    switch (method) {
      // ─── List all tools across all servers ──
      case 'tools/list': {
        const tools = await manager.listAllTools();
        return NextResponse.json({
          jsonrpc: '2.0',
          id: id ?? null,
          result: { tools },
        });
      }

      // ─── Call a specific tool ──
      case 'tools/call': {
        const toolName = params?.name as string;
        const args = (params?.arguments as Record<string, unknown>) ?? {};

        if (!toolName) {
          return NextResponse.json({
            jsonrpc: '2.0',
            id: id ?? null,
            error: { code: -32602, message: 'Missing tool name' },
          });
        }

        const result = await manager.callTool(toolName, args);
        return NextResponse.json({
          jsonrpc: '2.0',
          id: id ?? null,
          result,
        });
      }

      // ─── Server status ──
      case 'status': {
        const status = manager.getStatus();
        return NextResponse.json({
          jsonrpc: '2.0',
          id: id ?? null,
          result: { servers: status },
        });
      }

      // ─── List tools for a specific server ──
      case 'server/tools': {
        const serverId = params?.serverId as string;
        if (!serverId) {
          return NextResponse.json({
            jsonrpc: '2.0',
            id: id ?? null,
            error: { code: -32602, message: 'Missing serverId' },
          });
        }
        const tools = await manager.listTools(serverId);
        return NextResponse.json({
          jsonrpc: '2.0',
          id: id ?? null,
          result: { serverId, tools },
        });
      }

      // ─── Connect to a specific server ──
      case 'server/connect': {
        const serverId = params?.serverId as string;
        if (!serverId) {
          return NextResponse.json({
            jsonrpc: '2.0',
            id: id ?? null,
            error: { code: -32602, message: 'Missing serverId' },
          });
        }
        const success = await manager.connect(serverId);
        return NextResponse.json({
          jsonrpc: '2.0',
          id: id ?? null,
          result: { serverId, connected: success },
        });
      }

      // ─── Disconnect from a server ──
      case 'server/disconnect': {
        const serverId = params?.serverId as string;
        if (!serverId) {
          return NextResponse.json({
            jsonrpc: '2.0',
            id: id ?? null,
            error: { code: -32602, message: 'Missing serverId' },
          });
        }
        manager.disconnect(serverId);
        return NextResponse.json({
          jsonrpc: '2.0',
          id: id ?? null,
          result: { serverId, disconnected: true },
        });
      }

      default:
        return NextResponse.json({
          jsonrpc: '2.0',
          id: id ?? null,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
    }
  } catch (error) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      },
      { status: 500 }
    );
  }
}
