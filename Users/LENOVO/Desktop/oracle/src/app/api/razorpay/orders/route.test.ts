import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { castMockResponse, createPostRequest } from '../../test-helpers';

// Mock Razorpay API responses
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { POST } from './route';

describe('Razorpay Orders API /api/razorpay/orders', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.RAZORPAY_KEY_ID = 'rzp_test_abc123';
    process.env.RAZORPAY_KEY_SECRET = 'secret_xyz789';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('POST', () => {
    it('creates an order with correct Razorpay API call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'order_abc123',
          amount: 500000,
          currency: 'INR',
          status: 'created',
          receipt: 'orc_123',
          created_at: 1700000000,
        }),
      });

      const res = castMockResponse(
        await POST(createPostRequest({ amount: 5000, currency: 'INR', receipt: 'orc_123' }) as any)
      );

      expect(mockFetch).toHaveBeenCalledWith('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from('rzp_test_abc123:secret_xyz789').toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 500000, // 5000 INR -> 500000 paise
          currency: 'INR',
          receipt: 'orc_123',
          notes: {},
        }),
      });

      expect(res.body).toEqual({
        orderId: 'order_abc123',
        amount: 500000,
        currency: 'INR',
        status: 'created',
        receipt: 'orc_123',
        createdAt: 1700000000,
      });
    });

    it('converts INR to paise correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'order_1', amount: 99900, currency: 'INR', status: 'created', receipt: 'r1', created_at: 1 }),
      });

      await POST(createPostRequest({ amount: 999 }) as any);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.amount).toBe(99900);
    });

    it('rounds paise to avoid floating point issues', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'order_1', amount: 100050, currency: 'INR', status: 'created', receipt: 'r1', created_at: 1 }),
      });

      await POST(createPostRequest({ amount: 1000.5 }) as any);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.amount).toBe(100050);
    });

    it('uses default currency INR and auto-generates receipt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'order_1', amount: 10000, currency: 'INR', status: 'created', receipt: 'orc_generated', created_at: 1 }),
      });

      await POST(createPostRequest({ amount: 100 }) as any);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.currency).toBe('INR');
      expect(body.receipt).toMatch(/^orc_\d+$/);
    });

    it('passes notes to Razorpay API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'order_1', amount: 10000, currency: 'INR', status: 'created', receipt: 'r1', created_at: 1 }),
      });

      await POST(createPostRequest({ amount: 100, notes: { project: 'Website', client: 'Acme' } }) as any);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.notes).toEqual({ project: 'Website', client: 'Acme' });
    });

    it('returns 400 when amount is missing', async () => {
      const res = castMockResponse(await POST(createPostRequest({}) as any));
      expect(res.init).toEqual({ status: 400 });
      expect((res.body as any).error).toContain('Validation failed');
    });

    it('returns 400 when amount is zero', async () => {
      const res = castMockResponse(await POST(createPostRequest({ amount: 0 }) as any));
      expect(res.init).toEqual({ status: 400 });
    });

    it('returns 400 when amount is negative', async () => {
      const res = castMockResponse(await POST(createPostRequest({ amount: -100 }) as any));
      expect(res.init).toEqual({ status: 400 });
    });

    it('returns 503 when Razorpay keys are not configured', async () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;

      const res = castMockResponse(await POST(createPostRequest({ amount: 100 }) as any));
      expect(res.init).toEqual({ status: 503 });
      expect((res.body as any).error).toContain('not configured');
    });

    it('returns error from Razorpay API on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { code: 'BAD_REQUEST', description: 'Amount must be at least INR 1.00' },
        }),
      });

      const res = castMockResponse(await POST(createPostRequest({ amount: 0.001 }) as any));
      expect(res.init).toEqual({ status: 400 });
      expect((res.body as any).error).toContain('at least INR 1.00');
    });

    it('returns 500 when Razorpay API is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const res = castMockResponse(await POST(createPostRequest({ amount: 100 }) as any));
      expect(res.init).toEqual({ status: 500 });
      expect((res.body as any).error).toContain('Network error');
    });
  });
});
