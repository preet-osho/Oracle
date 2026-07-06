// ═══════════════════════════════════════
// ORACLE — WhatsApp Social Posting Client
// Status updates · Broadcasts · Template messages
// ═══════════════════════════════════════

import { fetchWithTimeout, TIMEOUT_MODERATE_MS } from '@/lib/fetch-utils';
import { createLogger } from '@/lib/logger';
import type { WhatsAppSocialConfig } from './types';

const log = createLogger('WhatsAppSocial');

// ─── Types ────────────────────────────

export interface WhatsAppBroadcastResult {
  success: boolean;
  broadcastId?: string;
  sentCount: number;
  failedCount: number;
  error?: string;
}

export interface WhatsAppStatusResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── Helpers ──────────────────────────

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

function getConfig(): WhatsAppSocialConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const wabaId = process.env.WHATSAPP_WABA_ID;

  if (!phoneNumberId || !accessToken) return null;

  return { phoneNumberId, accessToken, wabaId: wabaId || '' };
}

// ─── Public API ───────────────────────

export function isWhatsAppSocialConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Send a WhatsApp template message to a broadcast list.
 * Templates must be pre-approved by Meta.
 */
export async function sendTemplateBroadcast(
  templateName: string,
  recipients: string[],
  language: string = 'en_US',
  variables?: Record<string, string>[],
): Promise<WhatsAppBroadcastResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, sentCount: 0, failedCount: recipients.length, error: 'WhatsApp not configured.' };
  }

  let sentCount = 0;
  let failedCount = 0;
  const BATCH_DELAY_MS = 100; // Rate limit: ~10 msg/sec

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const recipientVars = variables?.[i];

    try {
      const components: Array<Record<string, unknown>> = [];

      if (recipientVars) {
        const bodyParams = Object.entries(recipientVars).map(([_, value]) => ({
          type: 'text',
          text: String(value),
        }));
        if (bodyParams.length > 0) {
          components.push({ type: 'body', parameters: bodyParams });
        }
      }

      const resp = await fetchWithTimeout(
        `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: recipient,
            type: 'template',
            template: {
              name: templateName,
              language: { code: language },
              ...(components.length > 0 ? { components } : {}),
            },
          }),
          timeoutMs: TIMEOUT_MODERATE_MS,
        },
      );

      if (resp.ok) {
        sentCount++;
      } else {
        const body = await resp.json() as { error?: { message: string } };
        log.warn('Template send failed', { recipient, error: body.error?.message });
        failedCount++;
      }
    } catch (error) {
      log.warn('Template send error', { recipient, error: error instanceof Error ? error.message : 'Unknown' });
      failedCount++;
    }

    // Rate limiting
    if (i < recipients.length - 1) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  log.info('WhatsApp broadcast complete', { sentCount, failedCount, total: recipients.length });
  return { success: sentCount > 0, sentCount, failedCount };
}

/**
 * Send a text message to a single WhatsApp number.
 */
export async function sendTextMessage(
  to: string,
  text: string,
): Promise<WhatsAppStatusResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'WhatsApp not configured.' };
  }

  try {
    const resp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
        timeoutMs: TIMEOUT_MODERATE_MS,
      },
    );

    if (!resp.ok) {
      const body = await resp.json() as { error?: { message: string } };
      return { success: false, error: body.error?.message || `HTTP ${resp.status}` };
    }

    const data = await resp.json() as { messages?: Array<{ id: string }> };
    const messageId = data.messages?.[0]?.id;

    log.info('WhatsApp text sent', { to, messageId });
    return { success: true, messageId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

/**
 * Send an image/media message via WhatsApp.
 */
export async function sendMediaMessage(
  to: string,
  mediaUrl: string,
  caption?: string,
  type: 'image' | 'video' | 'document' = 'image',
): Promise<WhatsAppStatusResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'WhatsApp not configured.' };
  }

  try {
    // First upload media to get an ID
    const uploadResp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${config.phoneNumberId}/media`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
        },
        body: (() => {
          const form = new FormData();
          form.append('messaging_product', 'whatsapp');
          form.append('type', type === 'document' ? 'document' : type);
          form.append(type === 'document' ? 'file' : type, mediaUrl);
          return form;
        })(),
        timeoutMs: TIMEOUT_MODERATE_MS,
      },
    );

    let mediaId = '';
    if (uploadResp.ok) {
      const uploadData = await uploadResp.json() as { id: string };
      mediaId = uploadData.id;
    }

    // Send message
    const mediaPayload: Record<string, unknown> = { id: mediaId };
    if (caption) mediaPayload.caption = caption;

    const resp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type,
          [type]: mediaPayload,
        }),
        timeoutMs: TIMEOUT_MODERATE_MS,
      },
    );

    if (!resp.ok) {
      const body = await resp.json() as { error?: { message: string } };
      return { success: false, error: body.error?.message || `HTTP ${resp.status}` };
    }

    const data = await resp.json() as { messages?: Array<{ id: string }> };
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

/**
 * List available WhatsApp message templates.
 */
export async function listTemplates(): Promise<Array<{
  name: string;
  language: string;
  status: string;
  category: string;
}>> {
  const config = getConfig();
  if (!config || !config.wabaId) return [];

  try {
    const resp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${config.wabaId}/message_templates?access_token=${config.accessToken}&limit=100`,
      { timeoutMs: TIMEOUT_MODERATE_MS },
    );

    if (!resp.ok) return [];
    const data = await resp.json() as {
      data?: Array<{ name: string; language: string; status: string; category: string }>;
    };

    return (data.data ?? []).map((t) => ({
      name: t.name,
      language: t.language,
      status: t.status,
      category: t.category,
    }));
  } catch {
    return [];
  }
}
