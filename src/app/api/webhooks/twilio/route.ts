// ═══════════════════════════════════════
// ORACLE — Twilio WhatsApp Webhook Handler
// POST /api/webhooks/twilio
// Receives WhatsApp status callbacks from Twilio
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createLogger } from '@/lib/logger';
import { storeDeliveryEvent, type WhatsAppEventType } from '@/lib/delivery-events';

const log = createLogger('Webhook:Twilio');

// ─── Twilio Callback Payload ───────────

interface TwilioCallbackPayload {
  MessageSid: string;
  MessageStatus: string;
  To: string;
  From: string;
  ErrorCode?: string;
  ErrorMessage?: string;
  SmsMessageSid?: string;
  NumMedia?: string;
  NumSegments?: string;
  [key: string]: string | undefined;
}

// ─── Event Mapping ─────────────────────

function mapTwilioStatus(status: string): WhatsAppEventType | null {
  const statusMap: Record<string, WhatsAppEventType> = {
    queued: 'whatsapp.queued',
    sent: 'whatsapp.sent',
    delivered: 'whatsapp.delivered',
    read: 'whatsapp.read',
    failed: 'whatsapp.failed',
    undelivered: 'whatsapp.undelivered',
  };
  return statusMap[status] || null;
}

// ─── POST Handler ──────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestUrl = request.url;

  // 1. Parse form-urlencoded body (Twilio sends this format)
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  const payload: TwilioCallbackPayload = Object.fromEntries(params.entries()) as TwilioCallbackPayload;

  // 2. Validate Twilio signature
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioSignature = request.headers.get('x-twilio-signature');

  if (twilioAuthToken && twilioSignature) {
    // Validate signature if auth token is configured
    try {
      // Twilio expects the full URL and all POST parameters for validation
      const isValid = twilio.validateRequest(
        twilioAuthToken,
        twilioSignature,
        requestUrl,
        Object.fromEntries(params.entries()),
      );

      if (!isValid) {
        log.error('Twilio webhook signature validation failed', {
          messageSid: payload.MessageSid,
        });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown validation error';
      log.error('Twilio signature validation error', { error: message });
      return NextResponse.json({ error: 'Signature validation failed' }, { status: 401 });
    }
  } else if (!twilioAuthToken) {
    log.warn('TWILIO_AUTH_TOKEN not configured — skipping signature validation');
  }

  // 3. Validate required fields
  if (!payload.MessageSid || !payload.MessageStatus) {
    log.warn('Missing required Twilio callback fields', {
      hasSid: !!payload.MessageSid,
      hasStatus: !!payload.MessageStatus,
    });
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // 4. Map status to event type
  const eventType = mapTwilioStatus(payload.MessageStatus);
  if (!eventType) {
    log.warn('Unknown Twilio message status', { status: payload.MessageStatus });
    return NextResponse.json({ received: true, skipped: true, status: payload.MessageStatus });
  }

  // 5. Clean phone numbers (strip whatsapp: prefix for storage)
  const cleanNumber = (num: string) => num?.replace('whatsapp:', '') || num;

  // 6. Store the event
  const deliveryEvent = storeDeliveryEvent({
    provider: 'twilio',
    channel: 'whatsapp',
    eventType,
    messageId: payload.MessageSid,
    recipient: cleanNumber(payload.To),
    sender: cleanNumber(payload.From),
    errorCode: payload.ErrorCode,
    errorMessage: payload.ErrorMessage,
    metadata: {
      messageSid: payload.MessageSid,
      smsMessageSid: payload.SmsMessageSid,
      numMedia: payload.NumMedia,
      numSegments: payload.NumSegments,
    },
  });

  log.info('Twilio WhatsApp webhook processed', {
    eventType,
    messageId: payload.MessageSid,
    status: payload.MessageStatus,
    duration: Date.now() - startTime,
  });

  return NextResponse.json({
    received: true,
    eventId: deliveryEvent.id,
    eventType,
  });
}
