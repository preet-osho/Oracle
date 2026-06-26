import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, createGetRequest, createPutRequest, makeSetupChain } from '../../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

import { GET, PUT, DELETE } from './route';
const setupChain = makeSetupChain(from, authMock);
const params = { params: Promise.resolve({ id: 'conv-1' }) };

describe('Single Conversation API /api/conversations/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  describe('GET', () => {
    it('fetches a conversation by id', async () => {
      const c = setupChain({ data: { id: 'conv-1', title: 'Test' } });
      const res = castMockResponse(await GET(createGetRequest() as any, params));
      expect(from).toHaveBeenCalledWith('conversations');
      expect(c.eq).toHaveBeenCalledWith('id', 'conv-1');
      expect(res.body).toEqual({ id: 'conv-1', title: 'Test' });
    });

    it('returns 500 on error', async () => {
      setupChain({ data: null, error: new Error('Not found') });
      const res = castMockResponse(await GET(createGetRequest() as any, params));
      expect(res.body).toEqual({ error: 'Not found' });
      expect(res.init).toEqual({ status: 500 });
    });
  });

  describe('PUT', () => {
    it('updates conversation fields', async () => {
      const c = setupChain({ data: { id: 'conv-1', title: 'Updated' } });
      const res = castMockResponse(await PUT(createPutRequest({ title: 'Updated' }) as any, params));
      expect(c.update).toHaveBeenCalled();
      expect(c.eq).toHaveBeenCalledWith('id', 'conv-1');
      expect(res.body).toEqual({ id: 'conv-1', title: 'Updated' });
    });

    it('updates messages and agent_type', async () => {
      const c = setupChain({ data: { id: 'conv-1' } });
      await PUT(createPutRequest({ messages: [{ role: 'user' }], agent_type: 'seo' }) as any, params);
      expect(c.update.mock.calls[0][0].messages).toEqual([{ role: 'user' }]);
      expect(c.update.mock.calls[0][0].agent_type).toBe('seo');
    });

    it('returns 500 on update error', async () => {
      setupChain({ data: null, error: new Error('Update failed') });
      const res = castMockResponse(await PUT(createPutRequest({ title: 'X' }) as any, params));
      expect(res.body).toEqual({ error: 'Update failed' });
    });
  });

  describe('DELETE', () => {
    it('deletes a conversation by id', async () => {
      const c = setupChain({ data: null, error: null });
      const res = castMockResponse(await DELETE(createGetRequest() as any, params));
      expect(c.delete).toHaveBeenCalled();
      expect(c.eq).toHaveBeenCalledWith('id', 'conv-1');
      expect(res.body).toEqual({ success: true });
    });

    it('returns 500 on delete error', async () => {
      setupChain({ data: null, error: new Error('Delete failed') });
      const res = castMockResponse(await DELETE(createGetRequest() as any, params));
      expect(res.body).toEqual({ error: 'Delete failed' });
    });
  });
});
