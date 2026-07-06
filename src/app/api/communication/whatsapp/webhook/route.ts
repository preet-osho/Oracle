// ═══════════════════════════════════════
// ORACLE — WhatsApp Webhook Handler
// POST /api/communication/whatsapp/webhook
// Handles incoming messages and status updates
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { parseWebhook } from '@/lib/communication/whatsapp';
import { handleInboundMessage, handleStatusUpdate } from '@/lib/communication/hub';
import { createLogger } from '@/lib/logger';

const log = createLogger('WhatsAppWebhook');

// ─── Webhook Verification (GET) ────────
// Meta sends a GET request to verify the webhook URL.

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Verify the token matches our configured verify token
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    log.info('Webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  }

  log.warn(`Webhook verification failed: mode=${mode}, token=${token}`);
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ─── Webhook Events (POST) ─────────────
// Meta sends POST requests for incoming messages and status updates.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify signature (X-Hub-Signature-256)
    const signature = request.headers.get('x-hub-signature-256');
    if (process.env.WHATSAPP_APP_SECRET && signature) {
      const { createHmac } = await import('crypto');
      const rawBody = JSON.stringify(body);
      const expectedSignature = 'sha256=' + createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
        .update(rawBody)
        .digest('hex');

      if (signature !== expectedSignature) {
        log.warn('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Parse the webhook payload
    const { messages, statuses } = parseWebhook(body);

    // Process incoming messages
    for (const msg of messages) {
      // TODO: Look up user by phone number ID from a whatsapp_accounts table
      // Currently hardcoded to 'system' — inbound messages are attributed to
      // a system user. When multi-user is wired up, query a mapping table:
      //   SELECT user_id FROM whatsapp_accounts WHERE phone_number_id = ?
      const userId = 'system';

      await handleInboundMessage(userId, {
        from: msg.from,
        text: msg.text,
        messageId: msg.messageId,
        timestamp: msg.timestamp,
        contactName: msg.contactName,
      });

      log.info(`Inbound message from ${msg.from}: ${msg.text.substring(0, 50)}`);
    }

    // Process status updates
    for (const status of statuses) {
      await handleStatusUpdate(
        status.messageId,
        status.status,
        status.errorCode,
      );
    }

    // Always return 200 to Meta (they retry on non-200)
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    log.error('Webhook processing error:', { error: String(err) });
    // Still return 200 to prevent Meta retries on parsing errors
    return NextResponse.json({ status: 'ok' });
  }
}
