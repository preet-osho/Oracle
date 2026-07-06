import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, createGetRequest } from '../test-helpers';

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

const getDeliveryEventsMock = vi.fn();
const getDeliveryStatsMock = vi.fn();
vi.mock('@/lib/delivery-events', () => ({
  getDeliveryEvents: (...a: any[]) => getDeliveryEventsMock(...a),
  getDeliveryStats: (...a: any[]) => getDeliveryStatsMock(...a),
}));

import { GET } from './route';

describe('Webhook Health Check /api/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated
    authMock.mockResolvedValue({ user: { id: 'u1' }, supabase: {}, org: { orgId: 'org-1', role: 'owner' } });
    // Default: empty events
    getDeliveryEventsMock.mockReturnValue([]);
    getDeliveryStatsMock.mockReturnValue({
      totalEvents: 0,
      emailEvents: 0,
      whatsappEvents: 0,
      byType: {},
      byStatus: { delivered: 0, failed: 0, pending: 0, opened: 0, clicked: 0 },
      recentEvents: [],
    });
  });

  describe('auth enforcement', () => {
    it('returns 401 when not authenticated', async () => {
      authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: 'Unauthorized' }) } });
      const res = castMockResponse(await GET());
      expect(res.status).toBe(401);
    });
  });

  describe('response structure', () => {
    it('returns configured, endpoints, recentEvents, and lastReceivedAt', async () => {
      const res = castMockResponse(await GET());
      const body = res.body as Record<string, unknown>;
      expect(body).toHaveProperty('configured');
      expect(body).toHaveProperty('endpoints');
      expect(body).toHaveProperty('recentEvents');
      expect(body).toHaveProperty('lastReceivedAt');
    });

    it('returns configured.resend and configured.twilio booleans', async () => {
      const res = castMockResponse(await GET());
      const body = res.body as Record<string, unknown>;
      const configured = body.configured as Record<string, unknown>;
      expect(configured).toHaveProperty('resend');
      expect(configured).toHaveProperty('twilio');
      expect((configured.resend as Record<string, unknown>)).toHaveProperty('webhookSecret');
      expect((configured.twilio as Record<string, unknown>)).toHaveProperty('authToken');
    });

    it('returns endpoint metadata for resend and twilio', async () => {
      const res = castMockResponse(await GET());
      const body = res.body as Record<string, unknown>;
      const endpoints = body.endpoints as Record<string, unknown>;
      const resend = endpoints.resend as Record<string, unknown>;
      const twilio = endpoints.twilio as Record<string, unknown>;
      expect(resend.url).toBe('/api/webhooks/resend');
      expect(resend.method).toBe('POST');
      expect(twilio.url).toBe('/api/webhooks/twilio');
      expect(twilio.method).toBe('POST');
    });

    it('returns recentEvents with total, last24h, last7d, byProvider, byStatus', async () => {
      const res = castMockResponse(await GET());
      const body = res.body as Record<string, unknown>;
      const recentEvents = body.recentEvents as Record<string, unknown>;
      expect(recentEvents).toHaveProperty('total');
      expect(recentEvents).toHaveProperty('last24h');
      expect(recentEvents).toHaveProperty('last7d');
      expect(recentEvents).toHaveProperty('byProvider');
      expect(recentEvents).toHaveProperty('byStatus');
    });
  });

  describe('event counting', () => {
    it('counts events by provider', async () => {
      getDeliveryEventsMock.mockReturnValue([
        { provider: 'resend', receivedAt: Date.now() },
        { provider: 'resend', receivedAt: Date.now() },
        { provider: 'twilio', receivedAt: Date.now() },
      ]);
      getDeliveryStatsMock.mockReturnValue({
        totalEvents: 3,
        emailEvents: 2,
        whatsappEvents: 1,
        byType: {},
        byStatus: { delivered: 1, failed: 1, pending: 1, opened: 0, clicked: 0 },
        recentEvents: [],
      });

      const res = castMockResponse(await GET());
      const body = res.body as Record<string, unknown>;
      const recentEvents = body.recentEvents as Record<string, unknown>;
      const byProvider = recentEvents.byProvider as Record<string, number>;
      expect(byProvider.resend).toBe(2);
      expect(byProvider.twilio).toBe(1);
    });

    it('counts recent events within time windows', async () => {
      const now = Date.now();
      getDeliveryEventsMock.mockReturnValue([
        { provider: 'resend', receivedAt: now - 1000 },            // last24h ✓, last7d ✓
        { provider: 'twilio', receivedAt: now - 2 * 86400000 },   // last24h ✗, last7d ✓
        { provider: 'resend', receivedAt: now - 10 * 86400000 },  // last24h ✗, last7d ✗
      ]);
      getDeliveryStatsMock.mockReturnValue({
        totalEvents: 3,
        byType: {},
        byStatus: { delivered: 1, failed: 1, pending: 1, opened: 0, clicked: 0 },
        recentEvents: [],
      });

      const res = castMockResponse(await GET());
      const body = res.body as Record<string, unknown>;
      const recentEvents = body.recentEvents as Record<string, unknown>;
      expect(recentEvents.last24h).toBe(1);
      expect(recentEvents.last7d).toBe(2);
    });

    it('returns lastReceivedAt from most recent event', async () => {
      const now = Date.now();
      getDeliveryEventsMock.mockReturnValue([
        { provider: 'resend', receivedAt: now - 5000 },
        { provider: 'twilio', receivedAt: now },
      ]);
      getDeliveryStatsMock.mockReturnValue({
        totalEvents: 2,
        byType: {},
        byStatus: { delivered: 1, failed: 0, pending: 1, opened: 0, clicked: 0 },
        recentEvents: [],
      });

      const res = castMockResponse(await GET());
      const body = res.body as Record<string, unknown>;
      // getDeliveryEvents returns sorted by most recent first (unshift),
      // so first element is the most recent
      expect(body.lastReceivedAt).toBe(now - 5000);
    });

    it('returns null lastReceivedAt when no events', async () => {
      getDeliveryEventsMock.mockReturnValue([]);
      const res = castMockResponse(await GET());
      const body = res.body as Record<string, unknown>;
      expect(body.lastReceivedAt).toBeNull();
    });
  });

  describe('status counting', () => {
    it('passes through byStatus from getDeliveryStats', async () => {
      getDeliveryStatsMock.mockReturnValue({
        totalEvents: 10,
        byType: {},
        byStatus: { delivered: 7, failed: 2, pending: 1, opened: 5, clicked: 3 },
        recentEvents: [],
      });

      const res = castMockResponse(await GET());
      const body = res.body as Record<string, unknown>;
      const recentEvents = body.recentEvents as Record<string, unknown>;
      const byStatus = recentEvents.byStatus as Record<string, number>;
      expect(byStatus.delivered).toBe(7);
      expect(byStatus.failed).toBe(2);
      expect(byStatus.pending).toBe(1);
    });
  });
});
