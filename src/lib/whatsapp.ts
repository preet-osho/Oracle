// ═══════════════════════════════════════
// ORACLE — WhatsApp Service
// Twilio WhatsApp Business API integration
// Handles messaging, templates, and webhook management
// ═══════════════════════════════════════

import twilio from 'twilio';
import { createLogger } from '@/lib/logger';

const log = createLogger('WhatsAppService');

// ─── Types ─────────────────────────────

export type WhatsAppMessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export interface WhatsAppMessage {
  id: string;
  to: string;
  from: string;
  body?: string;
  mediaUrl?: string[];
  status: WhatsAppMessageStatus;
  timestamp: number;
  errorCode?: string;
  errorMessage?: string;
  error?: string;
}

export interface WhatsAppTemplate {
  sid: string;
  name: string;
  language: string;
  category: string;
  body: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface SendWhatsAppOptions {
  to: string;
  body?: string;
  mediaUrl?: string[];
  templateSid?: string;
  templateVariables?: Record<string, string>;
}

export interface WhatsAppServiceConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

// ─── Client Singleton ───────────────────

let twilioClient: ReturnType<typeof twilio> | null = null;

function getClient(): ReturnType<typeof twilio> | null {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    log.warn('Twilio credentials not configured');
    return null;
  }

  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
}

function getConfig(): WhatsAppServiceConfig {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
  };
}

// ─── Phone Number Formatting ────────────

/**
 * Format a phone number for WhatsApp (E.164 format with whatsapp: prefix).
 * Accepts: '+1234567890', '1234567890', 'whatsapp:+1234567890'
 */
function formatWhatsAppNumber(phone: string): string {
  const cleaned = phone.replace(/[^0-9+]/g, '');

  // Already formatted with whatsapp: prefix
  if (phone.startsWith('whatsapp:')) {
    return phone;
  }

  // Has country code
  if (cleaned.startsWith('+')) {
    return `whatsapp:${cleaned}`;
  }

  // Assume US/India based on length (10 digits = likely needs +91 or +1)
  if (cleaned.length === 10) {
    return `whatsapp:+91${cleaned}`;
  }

  return `whatsapp:+${cleaned}`;
}

// ─── Send Message ───────────────────────

/**
 * Send a text message via WhatsApp.
 */
export async function sendWhatsAppMessage(
  options: SendWhatsAppOptions,
): Promise<WhatsAppMessage> {
  const client = getClient();
  if (!client) {
    return {
      id: '',
      to: options.to,
      from: getConfig().fromNumber,
      status: 'failed',
      timestamp: Date.now(),
      error: 'Twilio credentials not configured',
    };
  }

  const config = getConfig();
  const toNumber = formatWhatsAppNumber(options.to);
  const startTime = Date.now();

  try {
    const messageParams: Record<string, unknown> = {
      to: toNumber,
      from: config.fromNumber,
    };

    // Template-based message (for business-initiated)
    if (options.templateSid) {
      messageParams.contentSid = options.templateSid;
      if (options.templateVariables) {
        messageParams.contentVariables = JSON.stringify(options.templateVariables);
      }
    } else if (options.body) {
      // Free-form message (within 24h window)
      messageParams.body = options.body;
    }

    // Media messages
    if (options.mediaUrl && options.mediaUrl.length > 0) {
      messageParams.mediaUrl = options.mediaUrl;
    }

    const message = await client.messages.create({
      to: toNumber,
      from: config.fromNumber,
      ...(options.templateSid
        ? { contentSid: options.templateSid, ...(options.templateVariables ? { contentVariables: JSON.stringify(options.templateVariables) } : {}) }
        : { body: options.body || '' }),
      ...(options.mediaUrl && options.mediaUrl.length > 0 ? { mediaUrl: options.mediaUrl } : {}),
    });

    const result: WhatsAppMessage = {
      id: message.sid,
      to: toNumber,
      from: config.fromNumber,
      body: options.body,
      mediaUrl: options.mediaUrl,
      status: 'queued',
      timestamp: Date.now(),
    };

    log.info('WhatsApp message sent', {
      messageId: message.sid,
      to: toNumber,
      duration: Date.now() - startTime,
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error('WhatsApp send failed', { error: message, to: toNumber });

    return {
      id: '',
      to: toNumber,
      from: config.fromNumber,
      status: 'failed',
      timestamp: Date.now(),
      error: message,
    };
  }
}

/**
 * Send a media message (image, document, video) via WhatsApp.
 */
export async function sendWhatsAppMedia(
  to: string,
  mediaUrl: string,
  caption?: string,
): Promise<WhatsAppMessage> {
  return sendWhatsAppMessage({
    to,
    body: caption,
    mediaUrl: [mediaUrl],
  });
}

/**
 * Send a template message (for business-initiated conversations).
 * Templates must be pre-approved by Meta via Twilio Console.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateSid: string,
  variables?: Record<string, string>,
): Promise<WhatsAppMessage> {
  return sendWhatsAppMessage({
    to,
    templateSid,
    templateVariables: variables,
  });
}

/**
 * Send a bulk WhatsApp message to multiple recipients.
 * Rate-limited to 1 message per 100ms to avoid Twilio throttling.
 */
export async function sendBulkWhatsApp(
  recipients: string[],
  body: string,
): Promise<WhatsAppMessage[]> {
  const results: WhatsAppMessage[] = [];
  const BATCH_DELAY_MS = 100;

  for (const recipient of recipients) {
    const result = await sendWhatsAppMessage({ to: recipient, body });
    results.push(result);

    // Rate limiting between messages
    if (recipients.indexOf(recipient) < recipients.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  log.info('Bulk WhatsApp messages sent', {
    total: recipients.length,
    successful: results.filter((r) => r.status !== 'failed').length,
  });

  return results;
}

// ─── Message Status ─────────────────────

/**
 * Get the status of a sent WhatsApp message.
 */
export async function getMessageStatus(messageSid: string): Promise<WhatsAppMessage | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const message = await client.messages(messageSid).fetch();

    return {
      id: message.sid,
      to: message.to,
      from: message.from,
      body: message.body || undefined,
      status: (message.status as WhatsAppMessageStatus) || 'queued',
      timestamp: new Date(message.dateCreated).getTime(),
      errorCode: message.errorCode ? String(message.errorCode) : undefined,
      errorMessage: message.errorMessage || undefined,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    log.error('Failed to fetch message status', { messageId: messageSid, error: errorMsg });
    return null;
  }
}

/**
 * Get recent WhatsApp messages for a specific number.
 */
export async function getRecentMessages(
  to: string,
  limit = 20,
): Promise<WhatsAppMessage[]> {
  const client = getClient();
  if (!client) return [];

  try {
    const messages = await client.messages.list({
      to: formatWhatsAppNumber(to),
      pageSize: limit,
    });

    return messages.map((msg) => ({
      id: msg.sid,
      to: msg.to,
      from: msg.from,
      body: msg.body || undefined,
      status: (msg.status as WhatsAppMessageStatus) || 'queued',
      timestamp: new Date(msg.dateCreated).getTime(),
      errorCode: msg.errorCode ? String(msg.errorCode) : undefined,
      errorMessage: msg.errorMessage || undefined,
    }));
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    log.error('Failed to fetch recent messages', { to, error: errorMsg });
    return [];
  }
}

// ─── Template Management ────────────────

/**
 * List available WhatsApp content templates.
 */
export async function listTemplates(): Promise<WhatsAppTemplate[]> {
  const client = getClient();
  if (!client) return [];

  try {
    const templates = await client.content.v1.contents.list({ limit: 50 });

    return templates.map((t) => ({
      sid: t.sid,
      name: t.friendlyName || t.sid,
      language: t.language || 'en',
      category: 'dynamic',
      body: '',
      status: 'approved' as const,
    }));
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    log.error('Failed to list templates', { error: errorMsg });
    return [];
  }
}

// ─── Health Check ───────────────────────

/**
 * Check WhatsApp service health status.
 */
export async function checkWhatsAppHealth(): Promise<{
  configured: boolean;
  fromNumber: string;
  accountSid: string;
}> {
  const config = getConfig();
  return {
    configured: !!(config.accountSid && config.authToken),
    fromNumber: config.fromNumber,
    accountSid: config.accountSid ? `${config.accountSid.substring(0, 8)}...` : '',
  };
}

// ─── Utility Functions ──────────────────

/**
 * Validate an Indian phone number format.
 */
export function isValidIndianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9]/g, '');
  // Indian mobile: 10 digits starting with 6-9
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) return true;
  // With country code: 91 + 10 digits
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return /^[6-9]\d{9}$/.test(cleaned.substring(2));
  }
  return false;
}

/**
 * Extract country code from a phone number.
 */
export function getCountryCode(phone: string): string {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+91')) return '+91';
  if (cleaned.startsWith('91') && cleaned.length >= 12) return '+91';
  if (cleaned.startsWith('+1')) return '+1';
  return '+91'; // Default to India
}

/**
 * Format a phone number for display (masked for privacy).
 */
export function maskPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length < 6) return phone;
  const visibleStart = cleaned.substring(0, 3);
  const visibleEnd = cleaned.substring(cleaned.length - 2);
  const masked = '*'.repeat(cleaned.length - 5);
  return `${visibleStart}${masked}${visibleEnd}`;
}
