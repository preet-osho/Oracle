import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, createGetRequest, createPutRequest, makeSetupChain } from '../../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

import { GET, PUT, DELETE } from './route';
const setupChain = makeSetupChain(from, authMock);

describe('Single Revenue Stream API /api/revenue-streams/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  describe('GET', () => {
    it('returns a stream by id', async () => {
      const c = setupChain({ data: { id: 'rs-1', name: 'SEO' } });
      const res = castMockResponse(await GET(createGetRequest() as any, { params: Promise.resolve({ id: 'rs-1' }) }));
      expect(c.eq).toHaveBeenCalledWith('id', 'rs-1');
      expect(c.single).toHaveBeenCalled();
      expect(res.body).toEqual({ id: 'rs-1', name: 'SEO' });
    });
    it('returns 500 on error', async () => { setupChain({ data: null, error: new Error('Not found') }); const res = castMockResponse(await GET(createGetRequest() as any, { params: Promise.resolve({ id: 'bad' }) })); expect(res.init).toEqual({ status: 500 }); });
  });

  describe('PUT', () => {
    it('updates a revenue stream', async () => {
      const c = setupChain({ data: { id: 'rs-1', status: 'Active' } });
      const res = castMockResponse(await PUT(createPutRequest({ status: 'Active', notes: 'Updated' }) as any, { params: Promise.resolve({ id: 'rs-1' }) }));
      expect(c.update).toHaveBeenCalled();
      expect(c.eq).toHaveBeenCalledWith('id', 'rs-1');
      expect(res.body).toEqual({ id: 'rs-1', status: 'Active' });
    });
    it('maps camelCase to snake_case', async () => {
      const c = setupChain({ data: { id: '1' } });
      await PUT(createPutRequest({ monthlyProjection: 50000, annualProjection: 600000 }) as any, { params: Promise.resolve({ id: '1' }) });
      const updateArg = c.update.mock.calls[0][0];
      expect(updateArg.monthly_projection).toBe(50000);
      expect(updateArg.annual_projection).toBe(600000);
    });
    it('returns 500 on error', async () => { setupChain({ data: null, error: new Error('Update failed') }); const res = castMockResponse(await PUT(createPutRequest({}) as any, { params: Promise.resolve({ id: 'bad' }) })); expect(res.init).toEqual({ status: 500 }); });
  });

  describe('DELETE', () => {
    it('deletes a revenue stream', async () => {
      const c = setupChain({ data: null });
      const res = castMockResponse(await DELETE(createGetRequest() as any, { params: Promise.resolve({ id: 'rs-1' }) }));
      expect(c.delete).toHaveBeenCalled();
      expect(c.eq).toHaveBeenCalledWith('id', 'rs-1');
      expect(res.body).toEqual({ success: true });
    });
    it('returns 500 on error', async () => { setupChain({ data: null, error: new Error('Delete failed') }); const res = castMockResponse(await DELETE(createGetRequest() as any, { params: Promise.resolve({ id: 'bad' }) })); expect(res.init).toEqual({ status: 500 }); });
  });

  describe('auth failure', () => {
    it('returns 401 when not authenticated', async () => {
      authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: 'Unauthorized' }) } });
      const res = castMockResponse(await GET(createGetRequest() as any, { params: Promise.resolve({ id: 'rs-1' }) }));
      expect(res.status).toBe(401);
    });
  });
});
