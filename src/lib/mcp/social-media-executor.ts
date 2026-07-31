// ═══════════════════════════════════════
// ORACLE — Social Media Tool Executor
// Detects tool calls in AI responses · Executes via MCP · Returns results
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';
import { csrfHeaders } from '@/lib/csrf';
import { fetchWithTimeout, TIMEOUT_STANDARD_MS } from '@/lib/fetch-utils';

const log = createLogger('MCP:SocialMediaExecutor');

// ─── Types ────────────────────────────

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  raw: string;
}

export interface ToolResult {
  tool: string;
  args: Record<string, unknown>;
  success: boolean;
  output: string;
  isError: boolean;
  executedAt: number;
}

// ─── Tool Call Pattern ────────────────
// AI responses use this marker pattern:
// [[TOOL:social_create_post:{"platform":"linkedin","text":"Hello"}]]
// [[TOOL:social_quick_post:{"platform":"facebook","text":"Update"}]]

const TOOL_CALL_PATTERN = /\[\[TOOL:(\w+):(\{[^}]*\})\]\]/g;

/**
 * Extract tool calls from an AI response text.
 * Returns an array of parsed tool calls.
 */
export function extractToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex for global regex
  TOOL_CALL_PATTERN.lastIndex = 0;

  while ((match = TOOL_CALL_PATTERN.exec(text)) !== null) {
    try {
      const tool = match[1]!;
      const args = JSON.parse(match[2]!) as Record<string, unknown>;
      calls.push({ tool, args, raw: match[0] });
    } catch {
      log.warn('Failed to parse tool call', { raw: match[0] });
    }
  }

  return calls;
}

/**
 * Execute a single tool call via the MCP API route.
 */
export async function executeToolCall(call: ToolCall): Promise<ToolResult> {
  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout('/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: call.tool,
          arguments: call.args,
        },
      }),
      timeoutMs: TIMEOUT_STANDARD_MS,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      log.error('Tool call failed', { tool: call.tool, status: response.status, error: errorText });
      return {
        tool: call.tool,
        args: call.args,
        success: false,
        output: `❌ Tool execution failed (${response.status}): ${errorText}`,
        isError: true,
        executedAt: startedAt,
      };
    }

    const json = await response.json() as {
      result?: { content?: Array<{ text: string }>; isError?: boolean };
      error?: { message: string };
    };

    if (json.error) {
      return {
        tool: call.tool,
        args: call.args,
        success: false,
        output: `❌ ${json.error.message}`,
        isError: true,
        executedAt: startedAt,
      };
    }

    const toolResult = json.result;
    const output = toolResult?.content?.map((c) => c.text).join('\n') ?? 'No output';
    const isError = toolResult?.isError ?? false;

    log.info('Tool call executed', { tool: call.tool, success: !isError, duration: Date.now() - startedAt });

    return {
      tool: call.tool,
      args: call.args,
      success: !isError,
      output,
      isError,
      executedAt: startedAt,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error('Tool call error', { tool: call.tool, error: msg });
    return {
      tool: call.tool,
      args: call.args,
      success: false,
      output: `❌ Error: ${msg}`,
      isError: true,
      executedAt: startedAt,
    };
  }
}

/**
 * Execute all tool calls found in an AI response.
 * Returns the results and the cleaned text (tool call markers removed).
 */
export async function executeToolCalls(text: string): Promise<{
  results: ToolResult[];
  cleanedText: string;
}> {
  const calls = extractToolCalls(text);

  if (calls.length === 0) {
    return { results: [], cleanedText: text };
  }

  log.info('Executing tool calls', { count: calls.length, tools: calls.map((c) => c.tool) });

  // Execute tool calls sequentially to avoid race conditions
  const results: ToolResult[] = [];
  for (const call of calls) {
    const result = await executeToolCall(call);
    results.push(result);
  }

  // Remove tool call markers from the text
  let cleanedText = text;
  for (const call of calls) {
    cleanedText = cleanedText.replace(call.raw, '');
  }
  // Clean up extra whitespace left behind
  cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n').trim();

  return { results, cleanedText };
}

/**
 * Format tool results for display in the chat.
 */

