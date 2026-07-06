// ═══════════════════════════════════════
// ORACLE — Communication Hub
// Unified interface for sending messages
// across WhatsApp and Email channels
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';
import { sendWhatsAppText, sendWhatsAppTemplate, isWhatsAppConfigured } from './whatsapp';
import { sendEmail, isEmailConfigured } from './email';
import { logMessage, updateMessageStatus } from './message-logger';
import { getTemplate, fillTemplate, validateTemplateVariables } from './templates';
import type { SendMessageOptions, BulkSendOptions } from './types';

const log = createLogger('CommunicationHub');

// ─── Channel Status ────────────────────

/**
 * Check which communication channels are available.
 */
export function getChannelStatus(): {
  whatsapp: boolean;
  email: boolean;
} {
  return {
    whatsapp: isWhatsAppConfigured(),
    email: isEmailConfigured(),
  };
}

// ─── Send Message ──────────────────────

/**
 * Send a message via the specified channel with automatic logging.
 *
 * For WhatsApp:
 * - If templateName is provided, sends as a template message
 * - Otherwise sends as a plain text message
 *
 * For Email:
 * - Sends via Resend API with HTML support
 */
export async function sendMessage(
  userId: string,
  options: SendMessageOptions,
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const { channel, to, subject, body, templateName, templateLanguage, clientId, leadId, metadata } = options;

  log.info(`Sending ${channel} message to ${to}`);

  // ── WhatsApp ──
  if (channel === 'whatsapp') {
    if (!isWhatsAppConfigured()) {
      return { success: false, error: 'WhatsApp not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.' };
    }

    let result;

    if (templateName) {
      // Template message (for marketing/utility conversations)
      result = await sendWhatsAppTemplate(to, templateName, templateLanguage || 'en_US');
    } else {
      // Plain text message (service conversations)
      result = await sendWhatsAppText(to, body);
    }

    // Log the message
    const logId = await logMessage({
      userId,
      clientId,
      leadId,
      channel: 'whatsapp',
      direction: 'outbound',
      to,
      from: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      body,
      templateId: templateName,
      providerMessageId: result.messageId,
      status: result.success ? 'sent' : 'failed',
      errorCode: result.error,
      metadata,
    });

    if (!result.success) {
      log.error(`WhatsApp send failed: ${result.error}`);
    }

    return {
      success: result.success,
      messageId: result.messageId || logId || undefined,
      error: result.error,
    };
  }

  // ── Email ──
  if (channel === 'email') {
    if (!isEmailConfigured()) {
      return { success: false, error: 'Email not configured. Set RESEND_API_KEY.' };
    }

    const result = await sendEmail({
      to,
      subject: subject || 'Message from ORACLE',
      html: body.includes('<') ? body : undefined,
      text: body.includes('<') ? undefined : body,
      tags: [{ name: 'client_id', value: clientId || '' }],
    });

    // Log the message
    const logId = await logMessage({
      userId,
      clientId,
      leadId,
      channel: 'email',
      direction: 'outbound',
      to,
      from: process.env.EMAIL_FROM_ADDRESS || 'oracle@oracle.app',
      subject,
      body,
      providerMessageId: result.id,
      status: result.success ? 'sent' : 'failed',
      errorCode: result.error,
      metadata,
    });

    if (!result.success) {
      log.error(`Email send failed: ${result.error}`);
    }

    return {
      success: result.success,
      messageId: result.id || logId || undefined,
      error: result.error,
    };
  }

  return { success: false, error: `Unknown channel: ${channel}` };
}

// ─── Send from Template ────────────────

/**
 * Send a message using a pre-built template with variable substitution.
 */
export async function sendFromTemplate(
  userId: string,
  templateId: string,
  variables: Record<string, string>,
  recipientTo: string,
  recipientSubject?: string,
  options?: { clientId?: string; leadId?: string },
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const template = getTemplate(templateId);
  if (!template) {
    return { success: false, error: `Template not found: ${templateId}` };
  }

  // Validate variables
  const validation = validateTemplateVariables(template, variables);
  if (!validation.valid) {
    return {
      success: false,
      error: `Missing template variables: ${validation.missing.join(', ')}`,
    };
  }

  // Fill template
  const filledBody = fillTemplate(template.body, variables);
  const filledSubject = template.subject ? fillTemplate(template.subject, variables) : recipientSubject;

  return sendMessage(userId, {
    channel: template.channel === 'both' ? 'email' : template.channel,
    to: recipientTo,
    subject: filledSubject,
    body: filledBody,
    clientId: options?.clientId,
    leadId: options?.leadId,
    metadata: { templateId, variables },
  });
}

// ─── Bulk Send ─────────────────────────

/**
 * Send messages to multiple recipients with rate limiting.
 * WhatsApp: 1 message/second limit for business accounts.
 * Email: Resend free tier allows ~100/day.
 */
export async function bulkSend(
  userId: string,
  options: BulkSendOptions,
): Promise<{
  total: number;
  sent: number;
  failed: number;
  results: Array<{ to: string; success: boolean; error?: string }>;
}> {
  const { channel, recipients, clientId, leadId, delayMs } = options;
  const delay = delayMs || (channel === 'whatsapp' ? 1000 : 100);

  log.info(`Bulk sending ${recipients.length} ${channel} messages`);

  const results: Array<{ to: string; success: boolean; error?: string }> = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    if (!recipient) continue;
    const result = await sendMessage(userId, {
      channel,
      to: recipient.to,
      subject: recipient.subject,
      body: recipient.body,
      clientId,
      leadId,
    });

    results.push({
      to: recipient.to,
      success: result.success,
      error: result.error,
    });

    if (result.success) sent++;
    else failed++;

    // Rate limit delay between sends
    if (i < recipients.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  log.info(`Bulk send complete: ${sent}/${recipients.length} sent, ${failed} failed`);

  return {
    total: recipients.length,
    sent,
    failed,
    results,
  };
}

// ─── Handle Inbound ────────────────────

/**
 * Process incoming WhatsApp messages (called from webhook handler).
 * Logs the inbound message for audit trail.
 */
export async function handleInboundMessage(
  userId: string,
  params: {
    from: string;
    text: string;
    messageId: string;
    timestamp: number;
    contactName?: string;
  },
): Promise<void> {
  await logMessage({
    userId,
    channel: 'whatsapp',
    direction: 'inbound',
    to: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    from: params.from,
    body: params.text,
    providerMessageId: params.messageId,
    status: 'delivered',
    metadata: {
      contactName: params.contactName,
      timestamp: params.timestamp,
    },
  });

  log.info(`Inbound WhatsApp from ${params.from}: ${params.text.substring(0, 50)}...`);
}

/**
 * Process WhatsApp status updates (delivered, read, failed).
 */
export async function handleStatusUpdate(
  messageId: string,
  status: 'sent' | 'delivered' | 'read' | 'failed',
  errorCode?: number,
): Promise<void> {
  await updateMessageStatus(
    messageId,
    status,
    errorCode ? String(errorCode) : undefined,
  );
}
