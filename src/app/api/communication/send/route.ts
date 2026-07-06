// ═══════════════════════════════════════
// ORACLE — Communication Send API
// Unified endpoint for sending emails and WhatsApp messages
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { checkRateLimit, API_WRITE_RATE_LIMIT } from '@/lib/rate-limit';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { sendMessage, sendBulkMessages, isValidEmail, isValidWhatsAppNumber, type CommunicationChannel } from '@/lib/communication-hub';

// ─── Request Types ──────────────────────

interface SendRequest {
  channel: CommunicationChannel;
  to: string | string[];
  subject?: string;
  body: string;
  html?: string;
  mediaUrl?: string[];
  templateId?: string;
  templateVariables?: Record<string, string>;
  tags?: Record<string, string>;
  priority?: 'low' | 'normal' | 'high';
}

interface BulkSendRequest {
  channel: CommunicationChannel;
  recipients: string[];
  subject: string;
  body: string;
  html?: string;
  tags?: Record<string, string>;
}

// ─── POST Handler ──────────────────────

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) {
    return Response.json(
      { error: 'No organization found. Create or join an organization first.' },
      { status: 400 }
    );
  }

  // 2. Rate limit (per-user, 10 req/min for comms)
  const rateLimitKey = `communication:${auth.user.id}`;
  const rateLimit = await checkRateLimit(rateLimitKey, {
    maxRequests: 10,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    writeAuditLog({
      userId: auth.user.id,
      action: AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
      entityType: 'communication',
      metadata: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
    });
    return Response.json(
      { error: 'Rate limit exceeded. Please wait before sending again.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
        },
      }
    );
  }

  // 3. Parse body
  let body: SendRequest | BulkSendRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 4. Determine if bulk or single
  const isBulk = 'recipients' in body && Array.isArray(body.recipients);

  if (isBulk) {
    return handleBulkSend(body as BulkSendRequest, auth.user.id);
  }

  return handleSingleSend(body as SendRequest, auth.user.id);
}

// ─── Single Send ────────────────────────

async function handleSingleSend(
  request: SendRequest,
  userId: string,
): Promise<Response> {
  const { channel, to, subject, body, html, mediaUrl, templateId, templateVariables, tags, priority } = request;

  // Validate channel
  if (!['email', 'whatsapp'].includes(channel)) {
    return Response.json(
      { error: `Unsupported channel: ${channel}. Use 'email' or 'whatsapp'.` },
      { status: 400 }
    );
  }

  // Validate recipients
  if (!to || (Array.isArray(to) && to.length === 0)) {
    return Response.json({ error: 'At least one recipient is required' }, { status: 400 });
  }

  const recipients = Array.isArray(to) ? to : [to];

  // Validate email format
  if (channel === 'email') {
    for (const recipient of recipients) {
      if (!isValidEmail(recipient)) {
        return Response.json(
          { error: `Invalid email address: ${recipient}` },
          { status: 400 }
        );
      }
    }
  }

  // Validate WhatsApp number format
  if (channel === 'whatsapp') {
    for (const recipient of recipients) {
      if (!isValidWhatsAppNumber(recipient)) {
        return Response.json(
          { error: `Invalid WhatsApp number: ${recipient}. Use E.164 format (e.g., +1234567890)` },
          { status: 400 }
        );
      }
    }
  }

  // Validate subject for email
  if (channel === 'email' && !subject && !templateId) {
    return Response.json(
      { error: 'Subject is required for email messages' },
      { status: 400 }
    );
  }

  // Validate body for non-template messages
  if (!templateId && !body) {
    return Response.json(
      { error: 'Message body is required' },
      { status: 400 }
    );
  }

  // Send message
  const result = await sendMessage({
    channel,
    to: recipients,
    subject,
    body: body || '',
    html,
    mediaUrl,
    templateId,
    templateVariables,
    tags,
    priority,
  });

  // Audit log
  writeAuditLog({
    userId,
    action: 'communication.send',
    entityType: channel,
    metadata: {
      channel,
      recipients: recipients.length,
      success: result.success,
      templateId,
    },
  });

  if (!result.success) {
    return Response.json(
      { error: result.error || 'Failed to send message' },
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    messageId: result.messageId,
    channel: result.channel,
    provider: result.provider,
    timestamp: result.timestamp,
  });
}

// ─── Bulk Send ──────────────────────────

async function handleBulkSend(
  request: BulkSendRequest,
  userId: string,
): Promise<Response> {
  const { channel, recipients, subject, body, html, tags } = request;

  // Validate channel
  if (!['email', 'whatsapp'].includes(channel)) {
    return Response.json(
      { error: `Unsupported channel: ${channel}` },
      { status: 400 }
    );
  }

  // Validate recipients count
  if (!recipients || recipients.length === 0) {
    return Response.json({ error: 'At least one recipient is required' }, { status: 400 });
  }

  if (recipients.length > 100) {
    return Response.json(
      { error: 'Maximum 100 recipients per bulk send' },
      { status: 400 }
    );
  }

  // Validate email format
  if (channel === 'email') {
    for (const recipient of recipients) {
      if (!isValidEmail(recipient)) {
        return Response.json(
          { error: `Invalid email address: ${recipient}` },
          { status: 400 }
        );
      }
    }
  }

  // Validate WhatsApp number format
  if (channel === 'whatsapp') {
    for (const recipient of recipients) {
      if (!isValidWhatsAppNumber(recipient)) {
        return Response.json(
          { error: `Invalid WhatsApp number: ${recipient}` },
          { status: 400 }
        );
      }
    }
  }

  // Validate subject for email
  if (channel === 'email' && !subject) {
    return Response.json(
      { error: 'Subject is required for email messages' },
      { status: 400 }
    );
  }

  // Send bulk messages
  const results = await sendBulkMessages(channel, recipients, subject, body, { html, tags });

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.length - successCount;

  // Audit log
  writeAuditLog({
    userId,
    action: 'communication.bulk_send',
    entityType: channel,
    metadata: {
      channel,
      total: recipients.length,
      successful: successCount,
      failed: failedCount,
    },
  });

  return Response.json({
    success: failedCount === 0,
    total: recipients.length,
    successful: successCount,
    failed: failedCount,
    results: results.map((r) => ({
      messageId: r.messageId,
      provider: r.provider,
      error: r.error,
    })),
  });
}

// ─── GET Handler (Health Check) ────────

export async function GET() {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  const { checkCommunicationHealth } = await import('@/lib/communication-hub');
  const health = await checkCommunicationHealth();

  return Response.json(health);
}
