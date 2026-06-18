import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { castMockResponse, createPostRequest } from '../../test-helpers';
import crypto from 'crypto';

// Mock Razorpay API responses
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { POST } from './route';

// Helper to generate a valid Razorpay signature
function generateSignature(orderId: string, paymentId: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

describe('Razorpay Verify API /api/razorpay/verify', () => {
  const originalEnv = process.env;
  const TEST_SECRET = 'test_secret_key_123';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.RAZORPAY_KEY_ID = 'rzp_test_abc123';
    process.env.RAZORPAY_KEY_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('POST', () => {
    it('verifies a valid payment signature', async () => {
      const orderId = 'order_test123';
      const paymentId = 'pay_test456';
      const signature = generateSignature(orderId, paymentId, TEST_SECRET);

      // Mock the Razorpay payment details fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: paymentId,
          amount: 50000,
          status: 'captured',
          method: 'upi',
        }),
      });

      const res = castMockResponse(
        await POST(createPostRequest({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        }) as any)
      );

      expect(res.body).toEqual({
        verified: true,
        orderId,
        paymentId,
        amount: 500,
        status: 'captured',
        method: 'upi',
      });
    });

    it('returns verified=true even if payment details fetch fails', async () => {
      const orderId = 'order_test123';
      const paymentId = 'pay_test456';
      const signature = generateSignature(orderId, paymentId, TEST_SECRET);

      // Payment details fetch fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const res = castMockResponse(
        await POST(createPostRequest({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        }) as any)
      );

      expect(res.body).toEqual({
        verified: true,
        orderId,
        paymentId,
        amount: undefined,
        status: undefined,
        method: undefined,
      });
    });

    it('rejects an invalid payment signature', async () => {
      const res = castMockResponse(
        await POST(createPostRequest({
          razorpay_order_id: 'order_test123',
          razorpay_payment_id: 'pay_test456',
          razorpay_signature: 'a'.repeat(64), // Wrong signature
        }) as any)
      );

      expect(res.init).toEqual({ status: 400 });
      expect((res.body as any).verified).toBe(false);
      expect((res.body as any).error).toContain('tampered');
    });

    it('rejects signature with different length (malformed input)', async () => {
      const res = castMockResponse(
        await POST(createPostRequest({
          razorpay_order_id: 'order_test123',
          razorpay_payment_id: 'pay_test456',
          razorpay_signature: 'abc123', // Too short
        }) as any)
      );

      expect(res.init).toEqual({ status: 400 });
      expect((res.body as any).verified).toBe(false);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = castMockResponse(
        await POST(createPostRequest({
          razorpay_order_id: 'order_test123',
          // missing razorpay_payment_id and razorpay_signature
        }) as any)
      );

      expect(res.init).toEqual({ status: 400 });
      expect((res.body as any).error).toContain('Validation failed');
    });

    it('returns 400 when razorpay_order_id is missing', async () => {
      const res = castMockResponse(
        await POST(createPostRequest({
          razorpay_payment_id: 'pay_test456',
          razorpay_signature: 'sig123',
        }) as any)
      );

      expect(res.init).toEqual({ status: 400 });
    });

    it('returns 503 when Razorpay keys are not configured', async () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;

      const res = castMockResponse(
        await POST(createPostRequest({
          razorpay_order_id: 'order_test123',
          razorpay_payment_id: 'pay_test456',
          razorpay_signature: 'sig123',
        }) as any)
      );

      expect(res.init).toEqual({ status: 503 });
      expect((res.body as any).error).toContain('not configured');
    });

    it('returns 500 on unexpected errors', async () => {
      // Override request.json to throw
      const badRequest = {
        json: async () => { throw new Error('Malformed JSON'); },
      } as any;

      const res = castMockResponse(await POST(badRequest));
      expect(res.init).toEqual({ status: 500 });
      expect((res.body as any).error).toContain('Malformed JSON');
    });

    it('uses timing-safe comparison (same-length different values)', async () => {
      // Create a signature of the correct length (64 hex chars) but wrong value
      const fakeSignature = '0'.repeat(64);

      const res = castMockResponse(
        await POST(createPostRequest({
          razorpay_order_id: 'order_1',
          razorpay_payment_id: 'pay_1',
          razorpay_signature: fakeSignature,
        }) as any)
      );

      expect(res.init).toEqual({ status: 400 });
      expect((res.body as any).verified).toBe(false);
    });
  });
});
