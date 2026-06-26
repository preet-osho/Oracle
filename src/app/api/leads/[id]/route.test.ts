import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, createGetRequest, createPostRequest, createPutRequest, makeSetupChain } from '../../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

import { GET, PUT, DELETE } from './route';
const setupChain = makeSetupChain(from, authMock);

describe('Single Lead API /api/leads/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  describe('GET', () => {
    it('returns a lead by id', async () => {
      const c = setupChain({ data: { id: 'lead-1', business_name: 'Acme' } });
      const res = castMockResponse(await GET(createGetRequest() as any, { params: Promise.resolve({ id: 'lead-1' }) }));
      expect(c.eq).toHaveBeenCalledWith('id', 'lead-1');
      expect(c.single).toHaveBeenCalled();
      expect(res.body).toEqual({ id: 'lead-1', business_name: 'Acme' });
    });
    it('returns 500 on error', async () => { setupChain({ data: null, error: new Error('Not found') }); const res = castMockResponse(await GET(createGetRequest() as any, { params: Promise.resolve({ id: 'bad' }) })); expect(res.init).toEqual({ status: 500 }); });
  });

  describe('PUT', () => {
    it('updates a lead', async () => {
      const c = setupChain({ data: { id: 'lead-1', status: 'Hot' } });
      const res = castMockResponse(await PUT(createPutRequest({ status: 'Hot', notes: 'Updated' }) as any, { params: Promise.resolve({ id: 'lead-1' }) }));
      expect(c.update).toHaveBeenCalled();
      expect(c.eq).toHaveBeenCalledWith('id', 'lead-1');
      expect(res.body).toEqual({ id: 'lead-1', status: 'Hot' });
    });
    it('maps camelCase to snake_case', async () => {
      const c = setupChain({ data: { id: '1' } });
      await PUT(createPutRequest({ businessName: 'New Name', personalisedMessage: 'msg' }) as any, { params: Promise.resolve({ id: '1' }) });
      const updateArg = c.update.mock.calls[0][0];
      expect(updateArg.business_name).toBe('New Name');
      expect(updateArg.personalised_message).toBe('msg');
    });
    it('returns 500 on error', async () => { setupChain({ data: null, error: new Error('Update failed') }); const res = castMockResponse(await PUT(createPutRequest({}) as any, { params: Promise.resolve({ id: 'bad' }) })); expect(res.init).toEqual({ status: 500 }); });
  });

  describe('DELETE', () => {
    it('deletes a lead', async () => {
      const c = setupChain({ data: null });
      const res = castMockResponse(await DELETE(createGetRequest() as any, { params: Promise.resolve({ id: 'lead-1' }) }));
      expect(c.delete).toHaveBeenCalled();
      expect(c.eq).toHaveBeenCalledWith('id', 'lead-1');
      expect(res.body).toEqual({ success: true });
    });
    it('returns 500 on error', async () => { setupChain({ data: null, error: new Error('Delete failed') }); const res = castMockResponse(await DELETE(createGetRequest() as any, { params: Promise.resolve({ id: 'bad' }) })); expect(res.init).toEqual({ status: 500 }); });
  });

  describe('auth failure', () => {
    it('returns 401 when not authenticated', async () => {
      authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: 'Unauthorized' }) } });
      const res = castMockResponse(await GET(createGetRequest() as any, { params: Promise.resolve({ id: 'lead-1' }) }));
      expect(res.status).toBe(401);
    });
  });
});
