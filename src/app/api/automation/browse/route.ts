// ═══════════════════════════════════════
// ORACLE — Browser Automation API
// POST /api/automation/browse
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { checkRateLimit, WEB_SEARCH_RATE_LIMIT } from '@/lib/rate-limit';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import {
  createSession,
  closeSession,
  navigateTo,
  fillForm,
  clickElement,
  extractData,
  extractTable,
  takeScreenshot,
  getActiveSessions,
  type AutomationOptions,
} from '@/lib/web-automation';

// ─── Request Body ──────────────────────

interface BrowseRequest {
  action: 'create' | 'navigate' | 'fill' | 'click' | 'extract' | 'table' | 'screenshot' | 'close' | 'sessions';
  sessionId?: string;
  url?: string;
  options?: AutomationOptions;
  fields?: Array<{ selector: string; value: string }>;
  submitSelector?: string;
  selector?: string;
  selectors?: string[];
  tableSelector?: string;
  fullPage?: boolean;
}

// ─── POST Handler ──────────────────────

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: 'No organization found.' }, { status: 400 });

  // 2. Rate limit
  const rateLimitKey = `browse:${auth.user.id}`;
  const rateLimit = await checkRateLimit(rateLimitKey, WEB_SEARCH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  // 3. Parse body
  let body: BrowseRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action } = body;

  if (!action) {
    return Response.json({ error: 'action is required' }, { status: 400 });
  }

  // 4. Execute action
  try {
    writeAuditLog({
      userId: auth.user.id,
      action: AUDIT_ACTIONS.AI_CHAT,
      entityType: 'browser_automation',
      metadata: { action, sessionId: body.sessionId },
    });

    switch (action) {
      case 'create': {
        const session = await createSession(body.options || {});
        return Response.json({
          sessionId: session.id,
          createdAt: session.createdAt,
        });
      }

      case 'navigate': {
        if (!body.sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });
        if (!body.url) return Response.json({ error: 'url required' }, { status: 400 });
        const result = await navigateTo(body.sessionId, body.url);
        return Response.json({ result });
      }

      case 'fill': {
        if (!body.sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });
        if (!body.fields) return Response.json({ error: 'fields required' }, { status: 400 });
        const result = await fillForm(body.sessionId, body.fields, body.submitSelector);
        return Response.json({ result });
      }

      case 'click': {
        if (!body.sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });
        if (!body.selector) return Response.json({ error: 'selector required' }, { status: 400 });
        const result = await clickElement(body.sessionId, body.selector);
        return Response.json({ result });
      }

      case 'extract': {
        if (!body.sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });
        if (!body.selectors) return Response.json({ error: 'selectors required' }, { status: 400 });
        const result = await extractData(body.sessionId, body.selectors);
        return Response.json({ result });
      }

      case 'table': {
        if (!body.sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });
        if (!body.tableSelector) return Response.json({ error: 'tableSelector required' }, { status: 400 });
        const result = await extractTable(body.sessionId, body.tableSelector);
        return Response.json({ result });
      }

      case 'screenshot': {
        if (!body.sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });
        const base64 = await takeScreenshot(body.sessionId, {
          fullPage: body.fullPage,
          selector: body.selector,
        });
        return Response.json({ screenshot: base64 });
      }

      case 'close': {
        if (!body.sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });
        await closeSession(body.sessionId);
        return Response.json({ success: true });
      }

      case 'sessions': {
        const sessions = getActiveSessions();
        return Response.json({ sessions });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Browser automation failed' },
      { status: 502 }
    );
  }
}
