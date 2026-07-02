// ═══════════════════════════════════════
// ORACLE — Razorpay Orders API Route
// Server-side order creation + payment verification
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateBody, RazorpayOrderSchema } from '@/lib/validations';
import { fetchWithTimeout, TIMEOUT_QUICK_MS } from '@/lib/fetch-utils';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { enforceRateLimit } from '@/lib/rate-limit';

// ─── Razorpay API Helpers ──────────────

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return null;
  }
  return { keyId, keySecret };
}

function getRazorpayAuthHeader(keyId: string, keySecret: string): string {
  const encoded = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  return `Basic ${encoded}`;
}

// ─── POST /api/razorpay/orders ─────────
// Creates a Razorpay order for server-verified payments

export async function POST(request: NextRequest) {
  const rl = await enforceRateLimit('razorpay-orders', 'anonymous');
  if (rl) return rl;
  try {
    const credentials = getRazorpayCredentials();
    if (!credentials) {
      return NextResponse.json(
        { error: 'Razorpay API keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment.' },
        { status: 503 }
      );
    }

    const rawBody = await request.json();
    const validation = validateBody(rawBody, RazorpayOrderSchema);
    if (validation.error) return validation.error;
    const { amount, currency, receipt, notes } = validation.data;

    // Create order via Razorpay API
    // amount must be in paise (smallest currency unit)
    const orderPayload = {
      amount: Math.round(amount * 100),
      currency: currency || 'INR',
      receipt: receipt || `orc_${Date.now()}`,
      notes: notes || {},
    };

    const response = await fetchWithTimeout('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': getRazorpayAuthHeader(credentials.keyId, credentials.keySecret),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
      timeoutMs: TIMEOUT_QUICK_MS,
    });

    const order = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: order.error?.description || 'Failed to create Razorpay order', details: order.error },
        { status: response.status }
      );
    }

    // Audit log (fire-and-forget)
    writeAuditLog({
      action: AUDIT_ACTIONS.PAYMENT_ORDER_CREATED,
      entityType: 'razorpay_order',
      entityId: order.id,
      newValue: { amount, currency: currency || 'INR', receipt: orderPayload.receipt },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      receipt: order.receipt,
      createdAt: order.created_at,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create order' },
      { status: 500 }
    );
  }
}
