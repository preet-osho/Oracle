// ═══════════════════════════════════════
// ORACLE — Test Webhook Endpoint
// POST /api/webhooks/test
// Inject test delivery events for development and testing
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { storeDeliveryEvent, type DeliveryChannel, type DeliveryProvider, type DeliveryEventType } from '@/lib/delivery-events';

// ─── Request Body ──────────────────────

interface TestEventRequest {
  batch?: boolean;
  count?: number;
  channel?: DeliveryChannel;
  provider?: DeliveryProvider;
  eventType?: DeliveryEventType;
  messageId?: string;
  recipient?: string;
  sender?: string;
  subject?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

// ─── Defaults ──────────────────────────

const DEFAULT_EVENTS: Array<{ channel: DeliveryChannel; provider: DeliveryProvider; eventType: DeliveryEventType }> = [
  { channel: 'email', provider: 'resend', eventType: 'email.sent' },
  { channel: 'email', provider: 'resend', eventType: 'email.delivered' },
  { channel: 'email', provider: 'resend', eventType: 'email.opened' },
  { channel: 'email', provider: 'resend', eventType: 'email.clicked' },
  { channel: 'whatsapp', provider: 'twilio', eventType: 'whatsapp.sent' },
  { channel: 'whatsapp', provider: 'twilio', eventType: 'whatsapp.delivered' },
  { channel: 'whatsapp', provider: 'twilio', eventType: 'whatsapp.read' },
  { channel: 'email', provider: 'resend', eventType: 'email.bounced' },
  { channel: 'whatsapp', provider: 'twilio', eventType: 'whatsapp.failed' },
];

// ─── POST Handler ──────────────────────

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test endpoint is only available in development' },
      { status: 403 },
    );
  }

  let body: TestEventRequest;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // If no eventType provided, inject a random default event
  if (!body.eventType) {
    const randomDefault = DEFAULT_EVENTS[Math.floor(Math.random() * DEFAULT_EVENTS.length)];
    body.channel = body.channel || randomDefault.channel;
    body.provider = body.provider || randomDefault.provider;
    body.eventType = body.eventType || randomDefault.eventType;
  }

  // Generate defaults
  const messageId = body.messageId || `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = body.channel || 'email';
  const provider = body.provider || 'resend';

  const event = storeDeliveryEvent({
    provider,
    channel,
    eventType: body.eventType || `${channel}.sent` as DeliveryEventType,
    messageId,
    recipient: body.recipient || (channel === 'email' ? 'test@example.com' : '+919876543210'),
    sender: body.sender || (channel === 'email' ? 'oracle@oracledigital.in' : '+911234567890'),
    subject: body.subject || 'Test Email Subject',
    errorCode: body.errorCode,
    errorMessage: body.errorMessage,
    metadata: {
      ...body.metadata,
      testEvent: true,
      injectedAt: new Date().toISOString(),
    },
  });

  // ── Batch mode: inject multiple events ──
  if (body.batch) {
    const count = Math.min(Math.max(1, body.count || 20), 100);
    const events = [];

    for (let i = 0; i < count; i++) {
      const randomDefault = DEFAULT_EVENTS[Math.floor(Math.random() * DEFAULT_EVENTS.length)];
      const msgId = `batch-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
      const ch = body.channel || randomDefault.channel;
      const prov = body.provider || randomDefault.provider;
      const evt = body.eventType || randomDefault.eventType;

      const event = storeDeliveryEvent({
        provider: prov,
        channel: ch,
        eventType: evt,
        messageId: msgId,
        recipient: ch === 'email' ? `user${i}@example.com` : `+9198765${String(43200 + i).padStart(5, '0')}`,
        sender: ch === 'email' ? 'oracle@oracledigital.in' : '+911234567890',
        subject: `Batch Test Email #${i + 1}`,
        metadata: {
          testEvent: true,
          batchMode: true,
          batchIndex: i,
          batchSize: count,
          injectedAt: new Date().toISOString(),
        },
      });
      events.push(event);
    }

    return NextResponse.json({
      success: true,
      count: events.length,
      message: `Injected ${events.length} test events`,
    });
  }

  return NextResponse.json({
    success: true,
    event,
    message: `Test ${body.eventType} event injected successfully`,
  });
}
