// ═══════════════════════════════════════
// ORACLE — Razorpay Payment Verification API Route
// Server-side HMAC SHA256 signature validation
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { validateBody, RazorpayVerifySchema } from '@/lib/validations';
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

// ─── Signature Verification ────────────
// Verifies payment signature using HMAC SHA256:
// payload = razorpay_order_id + "|" + razorpay_payment_id
// signature = HMAC-SHA256(key_secret, payload)

function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string
): boolean {
  const payload = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(payload)
    .digest('hex');

  // Guard against different-length buffers (malformed input) which would throw
  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

// ─── POST /api/razorpay/verify ─────────
// Verifies a Razorpay payment signature after checkout completion

export async function POST(request: NextRequest) {
  const rl = await enforceRateLimit('razorpay-verify', 'anonymous');
  if (rl) return rl;
  try {
    const credentials = getRazorpayCredentials();
    if (!credentials) {
      return NextResponse.json(
        { error: 'Razorpay API keys not configured.' },
        { status: 503 }
      );
    }

    const rawBody = await request.json();
    const validation = validateBody(rawBody, RazorpayVerifySchema);
    if (validation.error) return validation.error;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = validation.data;

    // Verify the payment signature
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      credentials.keySecret
    );

    if (!isValid) {
      return NextResponse.json(
        { error: 'Payment signature verification failed. Payment may be tampered.', verified: false },
        { status: 400 }
      );
    }

    // Optionally fetch full payment details from Razorpay
    let paymentDetails: Record<string, unknown> | null = null;
    try {
      const response = await fetch(
        `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`,
          },
        }
      );
      if (response.ok) {
        paymentDetails = await response.json();
      }
    } catch {
      // Payment details fetch failed but signature is valid
    }

    return NextResponse.json({
      verified: true,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amount: paymentDetails?.amount ? Number(paymentDetails.amount) / 100 : undefined,
      status: paymentDetails?.status,
      method: paymentDetails?.method,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed', verified: false },
      { status: 500 }
    );
  }
}
