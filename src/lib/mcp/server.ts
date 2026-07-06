// ═══════════════════════════════════════
// ORACLE — MCP Server Base Framework
// JSON-RPC 2.0 handler · Tool/Resource/Prompt registration
// ═══════════════════════════════════════

import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  ServerCapabilities,
  Tool,
  ToolHandler,
  ToolResult,
  Resource,
  ResourceHandler,
  ResourceContent,
  Prompt,
  PromptHandler,
  PromptMessage,
} from './protocol';
import {
  MCP_PROTOCOL_VERSION,
  METHOD_NOT_FOUND,
  INVALID_PARAMS,
  INTERNAL_ERROR,
} from './protocol';
import { createLogger } from '@/lib/logger';

// ─── MCP Server ──────────────────────

export class McpServer {
  private readonly name: string;
  private readonly version: string;
  private readonly capabilities: ServerCapabilities;
  private readonly log;

  private tools = new Map<string, { def: Tool; handler: ToolHandler }>();
  private resources = new Map<string, { def: Resource; handler: ResourceHandler }>();
  private prompts = new Map<string, { def: Prompt; handler: PromptHandler }>();

  constructor(name: string, version: string, capabilities?: Partial<ServerCapabilities>) {
    this.name = name;
    this.version = version;
    this.capabilities = capabilities ?? { tools: { listChanged: false } };
    this.log = createLogger(`MCP:${name}`);
  }

  // ─── Tool Registration ───────────────

  registerTool(tool: Tool, handler: ToolHandler): void {
    this.tools.set(tool.name, { def: tool, handler });
    this.log.info('Tool registered', { name: tool.name });
  }

  // ─── Resource Registration ───────────

  registerResource(resource: Resource, handler: ResourceHandler): void {
    this.resources.set(resource.uri, { def: resource, handler });
    this.log.info('Resource registered', { uri: resource.uri });
  }

  // ─── Prompt Registration ─────────────

  registerPrompt(prompt: Prompt, handler: PromptHandler): void {
    this.prompts.set(prompt.name, { def: prompt, handler });
    this.log.info('Prompt registered', { name: prompt.name });
  }

  // ─── Handle JSON-RPC Request ─────────

  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { id, method, params } = request;

    try {
      switch (method) {
        case 'initialize':
          return this.handleInitialize(id, params);

        case 'notifications/initialized':
          // Client notification — no response needed
          return { jsonrpc: '2.0', id: null };

        case 'tools/list':
          return this.handleToolsList(id, params);

        case 'tools/call':
          return this.handleToolsCall(id, params);

        case 'resources/list':
          return this.handleResourcesList(id, params);

        case 'resources/read':
          return this.handleResourcesRead(id, params);

        case 'prompts/list':
          return this.handlePromptsList(id, params);

        case 'prompts/get':
          return this.handlePromptsGet(id, params);

        case 'ping':
          return { jsonrpc: '2.0', id, result: {} };

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: { code: METHOD_NOT_FOUND, message: `Method not found: ${method}` },
          };
      }
    } catch (error) {
      this.log.error('Request handler error', { method, error: error instanceof Error ? error.message : 'Unknown' });
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      };
    }
  }

  // ─── Handle Notification ─────────────

  async handleNotification(notification: JsonRpcNotification): Promise<void> {
    // Notifications don't require responses
    this.log.debug('Notification received', { method: notification.method });
  }

  // ─── Initialize ─────────────────────

  private handleInitialize(
    id: string | number,
    _params?: Record<string, unknown>
  ): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: this.capabilities,
        serverInfo: { name: this.name, version: this.version },
      },
    };
  }

  // ─── Tools/List ─────────────────────

  private handleToolsList(
    id: string | number,
    _params?: Record<string, unknown>
  ): JsonRpcResponse {
    const tools = Array.from(this.tools.values()).map((t) => t.def);
    return {
      jsonrpc: '2.0',
      id,
      result: { tools },
    };
  }

  // ─── Tools/Call ─────────────────────

  private async handleToolsCall(
    id: string | number,
    params?: Record<string, unknown>
  ): Promise<JsonRpcResponse> {
    const toolName = params?.name as string;
    const args = (params?.arguments as Record<string, unknown>) ?? {};

    if (!toolName) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: INVALID_PARAMS, message: 'Missing tool name' },
      };
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: METHOD_NOT_FOUND, message: `Unknown tool: ${toolName}` },
      };
    }

    try {
      this.log.info('Calling tool', { name: toolName, args });
      const result = await tool.handler(args);
      return { jsonrpc: '2.0', id, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool execution failed';
      this.log.error('Tool call failed', { name: toolName, error: message });
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true,
        } satisfies ToolResult,
      };
    }
  }

  // ─── Resources/List ─────────────────

  private handleResourcesList(
    id: string | number,
    _params?: Record<string, unknown>
  ): JsonRpcResponse {
    const resources = Array.from(this.resources.values()).map((r) => r.def);
    return {
      jsonrpc: '2.0',
      id,
      result: { resources },
    };
  }

  // ─── Resources/Read ─────────────────

  private async handleResourcesRead(
    id: string | number,
    params?: Record<string, unknown>
  ): Promise<JsonRpcResponse> {
    const uri = params?.uri as string;
    if (!uri) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: INVALID_PARAMS, message: 'Missing resource URI' },
      };
    }

    const resource = this.resources.get(uri);
    if (!resource) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: METHOD_NOT_FOUND, message: `Unknown resource: ${uri}` },
      };
    }

    try {
      const contents = await resource.handler(uri);
      return { jsonrpc: '2.0', id, result: { contents: [contents] } };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Resource read failed',
        },
      };
    }
  }

  // ─── Prompts/List ───────────────────

  private handlePromptsList(
    id: string | number,
    _params?: Record<string, unknown>
  ): JsonRpcResponse {
    const prompts = Array.from(this.prompts.values()).map((p) => p.def);
    return {
      jsonrpc: '2.0',
      id,
      result: { prompts },
    };
  }

  // ─── Prompts/Get ────────────────────

  private async handlePromptsGet(
    id: string | number,
    params?: Record<string, unknown>
  ): Promise<JsonRpcResponse> {
    const name = params?.name as string;
    const args = (params?.arguments as Record<string, string>) ?? {};

    if (!name) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: INVALID_PARAMS, message: 'Missing prompt name' },
      };
    }

    const prompt = this.prompts.get(name);
    if (!prompt) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: METHOD_NOT_FOUND, message: `Unknown prompt: ${name}` },
      };
    }

    try {
      const messages = await prompt.handler(args);
      return { jsonrpc: '2.0', id, result: { messages } };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Prompt get failed',
        },
      };
    }
  }

  // ─── Info ───────────────────────────

  getInfo(): { name: string; version: string; toolCount: number; resourceCount: number; promptCount: number } {
    return {
      name: this.name,
      version: this.version,
      toolCount: this.tools.size,
      resourceCount: this.resources.size,
      promptCount: this.prompts.size,
    };
  }
}
