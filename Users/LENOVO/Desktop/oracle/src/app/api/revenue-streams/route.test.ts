import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, createGetRequest, createPostRequest, makeSetupChain } from '../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

import { GET, POST } from './route';
const setupChain = makeSetupChain(from, authMock);

describe('Revenue Streams API /api/revenue-streams', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  describe('GET', () => {
    it('returns revenue streams list', async () => {
      const c = setupChain({ data: [{ id: '1', name: 'SEO' }] });
      const res = castMockResponse(await GET(createGetRequest() as any));
      expect(from).toHaveBeenCalledWith('revenue_streams');
      expect(c.select).toHaveBeenCalledWith('*');
      expect(c.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(res.body).toEqual([{ id: '1', name: 'SEO' }]);
    });
    it('returns empty array when null', async () => { setupChain({ data: null }); const res = castMockResponse(await GET(createGetRequest() as any)); expect(res.body).toEqual([]); });
    it('filters by status', async () => {
      const c = setupChain({ data: [] });
      await GET(createGetRequest('http://localhost/api/revenue-streams?status=Active') as any);
      expect(c.eq).toHaveBeenCalledWith('status', 'Active');
    });
    it('returns 500 on error', async () => { setupChain({ data: null, error: new Error('DB error') }); const res = castMockResponse(await GET(createGetRequest() as any)); expect(res.init).toEqual({ status: 500 }); });
  });

  describe('POST', () => {
    it('creates a revenue stream with user_id', async () => {
      const c = setupChain({ data: { id: 'rs-1', name: 'SEO' } });
      const res = castMockResponse(await POST(createPostRequest({ name: 'SEO', type: 'Retainer', monthlyProjection: 50000 }) as any));
      expect(c.insert).toHaveBeenCalled();
      expect(c.insert.mock.calls[0][0].user_id).toBe('u1');
      expect(c.insert.mock.calls[0][0].name).toBe('SEO');
      expect(c.insert.mock.calls[0][0].type).toBe('Retainer');
      expect(c.insert.mock.calls[0][0].monthly_projection).toBe(50000);
      expect(res.body).toEqual({ id: 'rs-1', name: 'SEO' });
    });
    it('maps camelCase fields to snake_case', async () => {
      const c = setupChain({ data: { id: '1' } });
      await POST(createPostRequest({
        name: 'Acme', type: 'Product', monthlyProjection: 10000,
        annualProjection: 120000, tools: ['Next.js', 'Supabase'],
      }) as any);
      const inserted = c.insert.mock.calls[0][0];
      expect(inserted.monthly_projection).toBe(10000);
      expect(inserted.annual_projection).toBe(120000);
      expect(inserted.tools).toEqual(['Next.js', 'Supabase']);
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
