// ═══════════════════════════════════════
// ORACLE — Communication Hub (Server-Only)
// Server-side functions that import email/whatsapp providers.
// This file must NEVER be imported by client components — it uses
// Node.js built-ins (fs/net/tls) transitively through @sendgrid/mail
// and twilio. Client code should call the /api/communication/* endpoints
// instead.
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';
import { sendEmail, sendTemplateEmail, sendBulkEmail, checkEmailServiceHealth } from '@/lib/email-service';
import { sendWhatsAppMessage, sendBulkWhatsApp, sendWhatsAppTemplate, checkWhatsAppHealth } from '@/lib/whatsapp';
import type {
  CommunicationChannel,
  SendMessageRequest,
  CommunicationResult,
  CommunicationHealthStatus,
} from '@/lib/communication-hub-types';
import { escapeHtml } from '@/lib/communication-hub-types';

// Re-export shared types and utilities for backward compatibility
export type { CommunicationChannel, SendMessageRequest, CommunicationResult, CommunicationHealthStatus } from '@/lib/communication-hub-types';
export { isValidEmail, isValidWhatsAppNumber, getChannelIcon } from '@/lib/communication-hub-types';

const log = createLogger('CommunicationHub');

// ─── Storage (server-side mirror for stats tracking) ──

const COMM_STATS_KEY = 'oracle_comm_stats';

function getStoredStats(): { totalSent: number; emailsSent: number; whatsappSent: number; failed: number; lastSentAt: number | null } {
  return { totalSent: 0, emailsSent: 0, whatsappSent: 0, failed: 0, lastSentAt: null };
}

function updateStoredStats(_channel: CommunicationChannel, _success: boolean): void {
  // Server-side: stats are tracked in localStorage on the client.
  // This is a no-op on the server; the client updates its own stats
  // after receiving the API response.
}

// ─── Communication Hub ──────────────────

/**
 * Send a message through the appropriate channel.
 * Handles provider selection, fallback, and tracking.
 */
export async function sendMessage(request: SendMessageRequest): Promise<CommunicationResult> {
  const startTime = Date.now();
  log.info('Sending message', { channel: request.channel, to: request.to });

  try {
    let result: CommunicationResult;

    if (request.channel === 'email') {
      result = await sendEmailMessage(request);
    } else if (request.channel === 'whatsapp') {
      result = await sendWhatsAppMessageHub(request);
    } else {
      return {
        success: false,
        channel: request.channel,
        provider: 'unknown',
        error: `Unsupported channel: ${request.channel}`,
        timestamp: Date.now(),
      };
    }

    updateStoredStats(request.channel, result.success);

    log.info('Message sent', {
      channel: request.channel,
      success: result.success,
      duration: Date.now() - startTime,
    });

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    log.error('Message send failed', { channel: request.channel, error: errorMsg });

    updateStoredStats(request.channel, false);

    return {
      success: false,
      channel: request.channel,
      provider: 'unknown',
      error: errorMsg,
      timestamp: Date.now(),
    };
  }
}

/**
 * Send email message through the hub.
 */
async function sendEmailMessage(request: SendMessageRequest): Promise<CommunicationResult> {
  const recipients = Array.isArray(request.to) ? request.to : [request.to];

  if (request.templateId) {
    const result = await sendTemplateEmail({
      to: recipients,
      templateId: request.templateId,
      dynamicData: request.templateVariables || {},
      replyTo: process.env.EMAIL_REPLY_TO,
    });

    return {
      success: result.success,
      channel: 'email',
      messageId: result.messageId,
      provider: result.provider,
      error: result.error,
      timestamp: Date.now(),
    };
  }

  const result = await sendEmail({
    to: recipients,
    subject: request.subject || 'Message from Oracle',
    html: request.html || `<p>${escapeHtml(request.body)}</p>`,
    text: request.body,
    replyTo: process.env.EMAIL_REPLY_TO,
    tags: request.tags,
  });

  return {
    success: result.success,
    channel: 'email',
    messageId: result.messageId,
    provider: result.provider,
    error: result.error,
    timestamp: Date.now(),
  };
}

/**
 * Send WhatsApp message through the hub.
 */
async function sendWhatsAppMessageHub(request: SendMessageRequest): Promise<CommunicationResult> {
  const recipients = Array.isArray(request.to) ? request.to : [request.to];
  const results: Array<{ id: string; status: string; error?: string; errorMessage?: string }> = [];

  if (request.templateId) {
    // Template-based bulk send
    for (const recipient of recipients) {
      const result = await sendWhatsAppTemplate(
        recipient,
        request.templateId,
        request.templateVariables,
      );
      results.push(result);
    }
  } else if (recipients.length > 1) {
    // Bulk text message
    const bulkResults = await sendBulkWhatsApp(recipients, request.body);
    results.push(...bulkResults);
  } else {
    // Single text message
    const result = await sendWhatsAppMessage({
      to: recipients[0],
      body: request.body,
      mediaUrl: request.mediaUrl,
    });
    results.push(result);
  }

  const successCount = results.filter((r) => r.status !== 'failed').length;
  const allFailed = successCount === 0;
  const firstError = results.find((r) => r.error)?.error || results.find((r) => r.status === 'failed')?.errorMessage;

  return {
    success: !allFailed,
    channel: 'whatsapp',
    messageId: results[0]?.id,
    provider: 'twilio',
    error: allFailed ? firstError : undefined,
    timestamp: Date.now(),
  };
}

/**
 * Send bulk emails to multiple recipients.
 */
export async function sendBulkMessages(
  channel: CommunicationChannel,
  recipients: string[],
  subject: string,
  body: string,
  options?: { html?: string; tags?: Record<string, string> },
): Promise<CommunicationResult[]> {
  if (channel === 'email') {
    const results = await sendBulkEmail(recipients, subject, options?.html || `<p>${body}</p>`, {
      tags: options?.tags,
    });

    return results.map((r) => ({
      success: r.success,
      channel: 'email' as CommunicationChannel,
      messageId: r.messageId,
      provider: r.provider,
      error: r.error,
      timestamp: Date.now(),
    }));
  }

  if (channel === 'whatsapp') {
    const results = await sendBulkWhatsApp(recipients, body);
    return results.map((r) => ({
      success: r.status !== 'failed',
      channel: 'whatsapp' as CommunicationChannel,
      messageId: r.id,
      provider: 'twilio',
      error: r.error,
      timestamp: Date.now(),
    }));
  }

  return [];
}

/**
 * Check health of all communication services.
 */
export async function checkCommunicationHealth(): Promise<CommunicationHealthStatus> {
  const [emailHealth, whatsappHealth] = await Promise.all([
    checkEmailServiceHealth(),
    checkWhatsAppHealth(),
  ]);

  return {
    email: {
      resend: emailHealth.resend,
      sendgrid: emailHealth.sendgrid,
      preferred: emailHealth.preferred,
    },
    whatsapp: {
      configured: whatsappHealth.configured,
      fromNumber: whatsappHealth.fromNumber,
    },
  };
}
