// ═══════════════════════════════════════
// ORACLE — Resend Webhook Handler
// POST /api/webhooks/resend
// Receives email delivery events from Resend (via Svix)
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createLogger } from '@/lib/logger';
import { storeDeliveryEvent, type EmailEventType } from '@/lib/delivery-events';

const log = createLogger('Webhook:Resend');

// ─── Resend Webhook Event Types ────────

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
    tags?: Record<string, string>;
    bounce?: { type: string; subType: string; message: string };
    click?: { url: string; ip: string; userAgent: string };
    created_at: string;
  };
}

// ─── Event Mapping ─────────────────────

function mapResendEvent(type: string): EmailEventType | null {
  const validTypes: EmailEventType[] = [
    'email.sent',
    'email.delivered',
    'email.opened',
    'email.clicked',
    'email.bounced',
    'email.complained',
    'email.failed',
    'email.delivery_delayed',
    'email.received',
    'email.scheduled',
    'email.suppressed',
  ];
  return validTypes.includes(type as EmailEventType) ? (type as EmailEventType) : null;
}

// ─── POST Handler ──────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 1. Get the raw body as a string (required for Svix signature verification)
  const payload = await request.text();

  // 2. Get Svix headers
  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    log.warn('Missing Svix headers', { headers: Object.fromEntries(request.headers.entries()) });
    return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 });
  }

  const headers = {
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  };

  // 3. Verify signature
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    log.error('RESEND_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: ResendWebhookEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(payload, headers) as unknown as ResendWebhookEvent;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown verification error';
    log.error('Webhook signature verification failed', { error: message });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 4. Map event type
  const eventType = mapResendEvent(event.type);
  if (!eventType) {
    log.warn('Unknown Resend event type', { type: event.type });
    return NextResponse.json({ received: true, skipped: true, type: event.type });
  }

  // 5. Store the event
  const deliveryEvent = storeDeliveryEvent({
    provider: 'resend',
    channel: 'email',
    eventType,
    messageId: event.data.email_id,
    recipient: event.data.to?.[0],
    sender: event.data.from,
    subject: event.data.subject,
    errorCode: event.data.bounce?.type,
    errorMessage: event.data.bounce?.message || event.data.click?.url,
    metadata: {
      svixId,
      tags: event.data.tags,
      bounce: event.data.bounce,
      click: event.data.click,
      createdAt: event.created_at,
    },
  });

  log.info('Resend webhook processed', {
    eventType,
    messageId: event.data.email_id,
    duration: Date.now() - startTime,
  });

  return NextResponse.json({
    received: true,
    eventId: deliveryEvent.id,
    eventType,
  });
}
