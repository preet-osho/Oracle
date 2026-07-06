// ═══════════════════════════════════════
// ORACLE — WhatsApp Business API Client
// Meta Cloud API integration for sending
// messages, templates, and managing status
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';
import type {
  WhatsAppConfig,
  WhatsAppMessage,
  WhatsAppSendResult,
  WhatsAppWebhookEntry,
} from './types';

const log = createLogger('WhatsApp');

// ─── Configuration ─────────────────────

function getConfig(): WhatsAppConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const wabaId = process.env.WHATSAPP_WABA_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return null;
  }

  return {
    baseUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0',
    phoneNumberId,
    wabaId: wabaId || '',
    accessToken,
  };
}

/**
 * Check if WhatsApp Business API is configured.
 */
export function isWhatsAppConfigured(): boolean {
  return getConfig() !== null;
}

// ─── Send Text Message ─────────────────

/**
 * Send a plain text message via WhatsApp Business API.
 * Use for 1:1 conversations (service conversations).
 */
export async function sendWhatsAppText(
  to: string,
  text: string,
): Promise<WhatsAppSendResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'WhatsApp not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN env vars.' };
  }

  // Normalize phone number: remove spaces, dashes, ensure starts with country code
  const normalizedTo = normalizePhoneNumber(to);

  const message: WhatsAppMessage = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'text',
    text: { body: text },
  };

  return sendRequest(config, message);
}

// ─── Send Template Message ─────────────

/**
 * Send a pre-approved WhatsApp template message.
 * Required for marketing/utility conversations outside the 24h service window.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string = 'en_US',
  parameters?: Array<{ type: string; text?: string }>,
): Promise<WhatsAppSendResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'WhatsApp not configured.' };
  }

  const normalizedTo = normalizePhoneNumber(to);

  const message: WhatsAppMessage = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(parameters && parameters.length > 0
        ? {
            components: [
              {
                type: 'body',
                parameters: parameters.map((p) => ({
                  type: p.type as 'text',
                  text: p.text || '',
                })),
              },
            ],
          }
        : {}),
    },
  };

  return sendRequest(config, message);
}

// ─── Send Interactive Message ──────────

/**
 * Send an interactive message with buttons or list.
 * Useful for lead qualification, feedback collection, etc.
 */
export async function sendWhatsAppInteractive(
  to: string,
  header: string,
  body: string,
  footer: string,
  buttons: Array<{ id: string; title: string }>,
): Promise<WhatsAppSendResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'WhatsApp not configured.' };
  }

  const normalizedTo = normalizePhoneNumber(to);

  const message: WhatsAppMessage = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'interactive',
    interactive: {
      type: 'button',
      header: { type: 'text', text: header },
      body: { text: body },
      footer: { text: footer },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply' as const,
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  };

  return sendRequest(config, message);
}

// ─── Mark as Read ──────────────────────

/**
 * Mark a WhatsApp message as read (blue tick).
 */
export async function markAsRead(messageId: string): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;

  try {
    const response = await fetch(
      `${config.baseUrl}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      },
    );

    return response.ok;
  } catch (err) {
    log.error('Failed to mark message as read:', { error: String(err) });
    return false;
  }
}

// ─── Parse Webhook ─────────────────────

/**
 * Parse incoming WhatsApp webhook payload.
 * Returns messages and status updates.
 */
export function parseWebhook(body: unknown): {
  messages: Array<{
    from: string;
    text: string;
    messageId: string;
    timestamp: number;
    contactName?: string;
  }>;
  statuses: Array<{
    messageId: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: number;
    errorCode?: number;
    errorMessage?: string;
  }>;
} {
  const result = { messages: [] as any[], statuses: [] as any[] };

  try {
    const payload = body as { entry?: WhatsAppWebhookEntry[] };
    if (!payload.entry) return result;

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;

        // Incoming messages
        if (value.messages) {
          for (const msg of value.messages) {
            const contact = value.contacts?.find((c) => c.wa_id === msg.from);
            result.messages.push({
              from: msg.from,
              text: msg.text?.body || '',
              messageId: msg.id,
              timestamp: parseInt(msg.timestamp, 10),
              contactName: contact?.profile.name,
            });
          }
        }

        // Status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            result.statuses.push({
              messageId: status.id,
              status: status.status,
              timestamp: parseInt(status.timestamp, 10),
              errorCode: status.errors?.[0]?.code,
              errorMessage: status.errors?.[0]?.message,
            });
          }
        }
      }
    }
  } catch (err) {
    log.error('Failed to parse webhook:', { error: String(err) });
  }

  return result;
}

// ─── Internal Helpers ──────────────────

async function sendRequest(
  config: WhatsAppConfig,
  message: WhatsAppMessage,
): Promise<WhatsAppSendResult> {
  try {
    const url = `${config.baseUrl}/${config.phoneNumberId}/messages`;
    log.info(`Sending WhatsApp message to ${message.to} (type: ${message.type})`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data?.error;
      log.error(`WhatsApp API error: ${error?.message || response.statusText}`, { error });
      return {
        success: false,
        error: error?.message || 'Unknown error',
        errorCode: error?.code,
      };
    }

    const messageId = data?.messages?.[0]?.id;
    log.info(`WhatsApp message sent: ${messageId}`);

    return {
      success: true,
      messageId,
      status: 'sent',
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Network error';
    log.error(`WhatsApp send failed: ${errorMsg}`, { error: String(err) });
    return { success: false, error: errorMsg };
  }
}

/**
 * Normalize phone number to E.164 format.
 * Removes spaces, dashes, parentheses, and ensures leading country code.
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d]/g, '');

  // If it doesn't start with a country code, assume India (91)
  if (cleaned.length <= 10) {
    cleaned = '91' + cleaned;
  }

  return cleaned;
}
