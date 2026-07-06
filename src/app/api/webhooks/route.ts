// ═══════════════════════════════════════
// ORACLE — Webhook Health Check
// GET /api/webhooks
// Returns configuration status and recent event counts
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { getDeliveryEvents, getDeliveryStats } from '@/lib/delivery-events';

// ─── Response Types ────────────────────

interface WebhookHealthResponse {
  configured: {
    resend: { webhookSecret: boolean };
    twilio: { authToken: boolean };
  };
  endpoints: {
    resend: { url: string; method: string; description: string };
    twilio: { url: string; method: string; description: string };
  };
  recentEvents: {
    total: number;
    last24h: number;
    last7d: number;
    byProvider: { resend: number; twilio: number };
    byStatus: { delivered: number; failed: number; pending: number };
  };
  lastReceivedAt: number | null;
}

// ─── GET Handler ───────────────────────

export async function GET() {
  // 0. Authenticate
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  // 1. Check configuration status
  const resendConfigured = !!process.env.RESEND_WEBHOOK_SECRET;
  const twilioConfigured = !!process.env.TWILIO_AUTH_TOKEN;

  // 2. Get delivery event stats
  const allEvents = getDeliveryEvents();
  const stats = getDeliveryStats();

  const now = Date.now();
  const last24h = allEvents.filter((e) => now - e.receivedAt < 24 * 60 * 60 * 1000).length;
  const last7d = allEvents.filter((e) => now - e.receivedAt < 7 * 24 * 60 * 60 * 1000).length;

  const resendEvents = allEvents.filter((e) => e.provider === 'resend').length;
  const twilioEvents = allEvents.filter((e) => e.provider === 'twilio').length;

  // 3. Build response
  const response: WebhookHealthResponse = {
    configured: {
      resend: { webhookSecret: resendConfigured },
      twilio: { authToken: twilioConfigured },
    },
    endpoints: {
      resend: {
        url: '/api/webhooks/resend',
        method: 'POST',
        description: 'Resend email delivery webhooks (Svix signature verification)',
      },
      twilio: {
        url: '/api/webhooks/twilio',
        method: 'POST',
        description: 'Twilio WhatsApp status callbacks (Twilio signature validation)',
      },
    },
    recentEvents: {
      total: stats.totalEvents,
      last24h,
      last7d,
      byProvider: { resend: resendEvents, twilio: twilioEvents },
      byStatus: {
        delivered: stats.byStatus.delivered,
        failed: stats.byStatus.failed,
        pending: stats.byStatus.pending,
      },
    },
    lastReceivedAt: allEvents.length > 0 ? allEvents[0].receivedAt : null,
  };

  return NextResponse.json(response);
}
