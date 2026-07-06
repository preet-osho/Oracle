// ═══════════════════════════════════════
// ORACLE — Browser MCP Server
// Web automation · Navigation · Screenshots · Form filling · Data extraction
// ═══════════════════════════════════════

import { McpServer } from '../server';
import type { Tool, ToolResult } from '../protocol';
import {
  createSession,
  navigateTo,
  fillForm,
  clickElement,
  extractData,
  extractTable,
  takeScreenshot,
  closeSession,
  getActiveSessions,
} from '@/lib/web-automation';
import type { AutomationOptions } from '@/lib/web-automation';

// ─── Tool Definitions ─────────────────

const NAVIGATE_TOOL: Tool = {
  name: 'browser_navigate',
  title: 'Navigate to URL',
  description: 'Navigate to a URL in a browser session. Returns page content, links, and form information.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to' },
      sessionId: { type: 'string', description: 'Existing session ID (optional, creates new if empty)' },
      screenshot: { type: 'boolean', description: 'Take a screenshot after navigation' },
    },
    required: ['url'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
};

const FORM_FILL_TOOL: Tool = {
  name: 'browser_fill_form',
  title: 'Fill Form',
  description: 'Fill form fields and optionally submit. Useful for lead generation, contact forms, and login flows.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Browser session ID' },
      fields: {
        type: 'string',
        description: 'JSON array of {selector, value} pairs',
      },
      submitSelector: { type: 'string', description: 'CSS selector for submit button' },
    },
    required: ['sessionId', 'fields'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const CLICK_TOOL: Tool = {
  name: 'browser_click',
  title: 'Click Element',
  description: 'Click an element on the page by CSS selector.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Browser session ID' },
      selector: { type: 'string', description: 'CSS selector for element to click' },
      waitForNavigation: { type: 'boolean', description: 'Wait for page navigation after click' },
    },
    required: ['sessionId', 'selector'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const EXTRACT_TOOL: Tool = {
  name: 'browser_extract',
  title: 'Extract Data',
  description: 'Extract text, HTML, and attributes from elements matching CSS selectors.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Browser session ID' },
      selectors: { type: 'string', description: 'Comma-separated CSS selectors' },
    },
    required: ['sessionId', 'selectors'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const SCREENSHOT_TOOL: Tool = {
  name: 'browser_screenshot',
  title: 'Take Screenshot',
  description: 'Capture a screenshot of the current page or a specific element.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Browser session ID' },
      fullPage: { type: 'boolean', description: 'Capture the full page scrollable area' },
      selector: { type: 'string', description: 'CSS selector for specific element to screenshot' },
    },
    required: ['sessionId'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const SESSIONS_TOOL: Tool = {
  name: 'browser_sessions',
  title: 'List Active Sessions',
  description: 'List all active browser sessions with their IDs and status.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const CLOSE_SESSION_TOOL: Tool = {
  name: 'browser_close_session',
  title: 'Close Session',
  description: 'Close a browser session and release resources.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Browser session ID to close' },
    },
    required: ['sessionId'],
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
};

const TABLE_EXTRACT_TOOL: Tool = {
  name: 'browser_extract_table',
  title: 'Extract Table',
  description: 'Extract data from an HTML table into structured records.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Browser session ID' },
      tableSelector: { type: 'string', description: 'CSS selector for the table element' },
    },
    required: ['sessionId', 'tableSelector'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

// ─── Server Factory ───────────────────

export function createBrowserMcpServer(): McpServer {
  const server = new McpServer('browser-mcp', '1.0.0', {
    tools: { listChanged: false },
  });

  // Active sessions tracking
  let activeSessionId: string | null = null;

  async function ensureSession(sessionId?: string): Promise<string> {
    const targetId = sessionId || activeSessionId;
    if (targetId) {
      const sessions = getActiveSessions();
      if (sessions.some((s) => s.id === targetId)) {
        activeSessionId = targetId;
        return targetId;
      }
    }
    const session = await createSession({ headless: true });
    activeSessionId = session.id;
    return session.id;
  }

  // ── Register Tools ──

  server.registerTool(NAVIGATE_TOOL, async (args: Record<string, unknown>) => {
    const url = args.url as string;
    const sessionId = await ensureSession(args.sessionId as string | undefined);
    const result = await navigateTo(sessionId, url, {
      screenshot: args.screenshot as boolean,
    });

    const text = [
      `URL: ${result.url}`,
      `Title: ${result.title}`,
      `Links: ${result.links.length} found`,
      result.forms.length > 0 ? `Forms: ${result.forms.length} found` : '',
      '',
      'Page Content (truncated):',
      result.content.slice(0, 4000),
    ].filter(Boolean).join('\n');

    const toolResult: ToolResult = {
      content: [{ type: 'text', text }],
    };

    if (result.screenshot) {
      toolResult.content.push({
        type: 'image',
        data: result.screenshot,
        mimeType: 'image/png',
      });
    }

    return toolResult;
  });

  server.registerTool(FORM_FILL_TOOL, async (args: Record<string, unknown>) => {
    const sessionId = await ensureSession(args.sessionId as string | undefined);
    const fields = JSON.parse(args.fields as string) as Array<{ selector: string; value: string }>;
    const result = await fillForm(sessionId, fields, args.submitSelector as string | undefined);

    return {
      content: [{
        type: 'text',
        text: [
          `Success: ${result.success}`,
          `Current URL: ${result.url}`,
          '',
          'Page content after submission:',
          result.content.slice(0, 3000),
        ].join('\n'),
      }],
    };
  });

  server.registerTool(CLICK_TOOL, async (args: Record<string, unknown>) => {
    const sessionId = await ensureSession(args.sessionId as string | undefined);
    const result = await clickElement(sessionId, args.selector as string, {
      waitForNavigation: args.waitForNavigation as boolean,
    });

    return {
      content: [{
        type: 'text',
        text: [
          `URL: ${result.url}`,
          '',
          result.content.slice(0, 3000),
        ].join('\n'),
      }],
    };
  });

  server.registerTool(EXTRACT_TOOL, async (args: Record<string, unknown>) => {
    const sessionId = await ensureSession(args.sessionId as string | undefined);
    const selectors = (args.selectors as string).split(',').map((s) => s.trim());
    const results = await extractData(sessionId, selectors);

    const text = results.map((r) =>
      `[${r.selector}]\nText: ${r.text}\nHTML: ${r.html.slice(0, 200)}\nAttrs: ${JSON.stringify(r.attributes)}`
    ).join('\n\n');

    return {
      content: [{ type: 'text', text: text || 'No elements found matching selectors.' }],
    };
  });

  server.registerTool(SCREENSHOT_TOOL, async (args: Record<string, unknown>) => {
    const sessionId = await ensureSession(args.sessionId as string | undefined);
    const data = await takeScreenshot(sessionId, {
      fullPage: args.fullPage as boolean,
      selector: args.selector as string,
    });

    return {
      content: [{
        type: 'image',
        data,
        mimeType: 'image/png',
      }],
    };
  });

  server.registerTool(SESSIONS_TOOL, async (_args: Record<string, unknown>) => {
    const sessions = getActiveSessions();
    const text = sessions.length === 0
      ? 'No active sessions.'
      : sessions.map((s) => `ID: ${s.id} | Created: ${new Date(s.createdAt).toISOString()} | Active: ${new Date(s.lastActivity).toISOString()}`).join('\n');

    return { content: [{ type: 'text', text }] };
  });

  server.registerTool(CLOSE_SESSION_TOOL, async (args: Record<string, unknown>) => {
    const sessionId = args.sessionId as string;
    await closeSession(sessionId);
    if (activeSessionId === sessionId) activeSessionId = null;
    return { content: [{ type: 'text', text: `Session ${sessionId} closed.` }] };
  });

  server.registerTool(TABLE_EXTRACT_TOOL, async (args: Record<string, unknown>) => {
    const sessionId = await ensureSession(args.sessionId as string | undefined);
    const rows = await extractTable(sessionId, args.tableSelector as string);
    return {
      content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }],
    };
  });

  return server;
}
