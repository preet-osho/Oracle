import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, createGetRequest, createPostRequest, makeSetupChain } from '../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

import { GET, POST } from './route';
const setupChain = makeSetupChain(from, authMock);

describe('Leads API /api/leads', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  describe('GET', () => {
    it('returns leads list', async () => {
      const c = setupChain({ data: [{ id: '1', business_name: 'Acme' }] });
      const res = castMockResponse(await GET(createGetRequest() as any));
      expect(from).toHaveBeenCalledWith('leads');
      expect(c.select).toHaveBeenCalledWith('*');
      expect(c.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(res.body).toEqual([{ id: '1', business_name: 'Acme' }]);
    });
    it('returns empty array when null', async () => { setupChain({ data: null }); const res = castMockResponse(await GET(createGetRequest() as any)); expect(res.body).toEqual([]); });
    it('filters by status', async () => {
      const c = setupChain({ data: [] });
      await GET(createGetRequest('http://localhost/api/leads?status=Hot') as any);
      expect(c.eq).toHaveBeenCalledWith('status', 'Hot');
    });
    it('filters by source', async () => {
      const c = setupChain({ data: [] });
      await GET(createGetRequest('http://localhost/api/leads?source=Google%20Maps') as any);
      expect(c.eq).toHaveBeenCalledWith('source', 'Google Maps');
    });
    it('returns 500 on error', async () => { setupChain({ data: null, error: new Error('DB error') }); const res = castMockResponse(await GET(createGetRequest() as any)); expect(res.init).toEqual({ status: 500 }); });
  });

  describe('POST', () => {
    it('creates a lead with user_id', async () => {
      const c = setupChain({ data: { id: 'lead-1', business_name: 'Test' } });
      const res = castMockResponse(await POST(createPostRequest({ businessName: 'Test', city: 'Delhi' }) as any));
      expect(c.insert).toHaveBeenCalled();
      expect(c.insert.mock.calls[0][0].user_id).toBe('u1');
      expect(c.insert.mock.calls[0][0].business_name).toBe('Test');
      expect(c.insert.mock.calls[0][0].city).toBe('Delhi');
      expect(res.body).toEqual({ id: 'lead-1', business_name: 'Test' });
    });
    it('maps camelCase fields to snake_case', async () => {
      const c = setupChain({ data: { id: '1' } });
      await POST(createPostRequest({
        businessName: 'Acme', phone: '123', email: 'a@b.com',
        website: 'https://a.com', googleMapsUrl: 'https://maps.a.com',
        rating: 4.5, reviewCount: 10, triggerCriterion: 'No website',
        personalisedMessage: 'Hi there', assignedTo: 'Sarah',
        followUpDate: '2026-06-15',
      }) as any);
      const inserted = c.insert.mock.calls[0][0];
      expect(inserted.business_name).toBe('Acme');
      expect(inserted.google_maps_url).toBe('https://maps.a.com');
      expect(inserted.trigger_criterion).toBe('No website');
      expect(inserted.personalised_message).toBe('Hi there');
      expect(inserted.assigned_to).toBe('Sarah');
      expect(inserted.follow_up_date).toBe('2026-06-15');
    });
    it('returns 500 on insert error', async () => { setupChain({ data: null, error: new Error('Insert failed') }); const res = castMockResponse(await POST(createPostRequest({}) as any)); expect(res.body).toEqual({ error: 'Insert failed' }); });
  });

  describe('auth failure', () => {
    it('returns 401 when not authenticated', async () => {
      authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: 'Unauthorized' }) } });
      const res = castMockResponse(await GET(createGetRequest() as any));
      expect(res.status).toBe(401);
    });
  });
});
