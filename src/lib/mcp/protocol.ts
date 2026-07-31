// ═══════════════════════════════════════
// ORACLE — MCP Protocol Types
// JSON-RPC 2.0 · MCP Specification 2025-06-18
// ═══════════════════════════════════════

// ─── JSON-RPC 2.0 Base ────────────────

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// Standard JSON-RPC error codes
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;

// ─── MCP Protocol Version ─────────────

export const MCP_PROTOCOL_VERSION = '2025-06-18';

// ─── Capabilities ─────────────────────

export interface ServerCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
   
  logging?: object;
}

export interface ClientCapabilities {
   
  sampling?: object;
   
  elicitation?: object;
}

// ─── Initialize ───────────────────────

export interface InitializeRequest extends JsonRpcRequest {
  method: 'initialize';
  params: {
    protocolVersion: string;
    capabilities: ClientCapabilities;
    clientInfo: { name: string; version: string };
  };
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: { name: string; version: string };
}

// ─── Tools ────────────────────────────

export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  };
}

export interface ToolContent {
  type: 'text' | 'image' | 'resource_link';
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
  name?: string;
}

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

// ─── Resources ────────────────────────

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

// ─── Prompts ──────────────────────────

export interface Prompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: ToolContent;
}

// ─── Notifications ────────────────────

export interface ToolListChangedNotification extends JsonRpcNotification {
  method: 'notifications/tools/list_changed';
}

export interface ResourceListChangedNotification extends JsonRpcNotification {
  method: 'notifications/resources/list_changed';
}

// ─── MCP Server Config ────────────────

export interface McpServerConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  capabilities: ServerCapabilities;
  /** Environment variables required by this server */
  envVars: string[];
  /** Whether the server is enabled */
  enabled: boolean;
}

// ─── MCP Client Config ────────────────

export interface McpClientConfig {
  serverId: string;
  transport: 'stdio' | 'http' | 'sse';
  url?: string;       // For HTTP/SSE transport
  command?: string;   // For stdio transport
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

// ─── Handler Function Types ───────────

export type ToolHandler = (
  args: Record<string, unknown>
) => Promise<ToolResult>;

export type ResourceHandler = (
  uri: string
) => Promise<ResourceContent>;

export type PromptHandler = (
  args: Record<string, string>
) => Promise<PromptMessage[]>;
