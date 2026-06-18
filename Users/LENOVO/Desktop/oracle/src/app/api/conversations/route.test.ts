import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, createGetRequest, createPostRequest, makeSetupChain } from '../test-helpers';

const { from, authMock } = vi.hoisted(() => ({
  from: vi.fn(),
  authMock: vi.fn(),
}));

vi.mock('@/lib/supabase/validate', () => ({
  validateAuth: (...a: any[]) => authMock(...a),
}));

import { GET, POST } from './route';
const setupChain = makeSetupChain(from, authMock);

describe('Conversations API /api/conversations', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  describe('GET', () => {
    it('returns conversations list', async () => {
      const c = setupChain({ data: [{ id: '1', title: 'Chat' }] });
      const res = castMockResponse(await GET());
      expect(from).toHaveBeenCalledWith('conversations');
      expect(c.select).toHaveBeenCalledWith('*');
      expect(c.order).toHaveBeenCalledWith('updated_at', { ascending: false });
      expect(res.body).toEqual([{ id: '1', title: 'Chat' }]);
    });

    it('returns empty array when no data', async () => {
      setupChain({ data: null });
      const res = castMockResponse(await GET());
      expect(res.body).toEqual([]);
    });

    it('returns 500 on supabase error', async () => {
      setupChain({ data: null, error: new Error('DB error') });
      const res = castMockResponse(await GET());
      expect(res.body).toEqual({ error: 'DB error' });
      expect(res.init).toEqual({ status: 500 });
    });
  });

  describe('POST', () => {
    it('creates a conversation with defaults', async () => {
      const c = setupChain({ data: { id: 'new-1', title: 'New Chat' } });
      const res = castMockResponse(await POST(createPostRequest({ title: 'New Chat' }) as any));
      expect(c.insert).toHaveBeenCalled();
      expect(res.body).toEqual({ id: 'new-1', title: 'New Chat' });
    });

    it('creates conversation with agent_type and project_id', async () => {
      const c = setupChain({ data: { id: '2' } });
      await POST(createPostRequest({ title: 'T', agent_type: 'seo', project_id: 'p1' }) as any);
      expect(c.insert.mock.calls[0][0].agent_type).toBe('seo');
      expect(c.insert.mock.calls[0][0].project_id).toBe('p1');
    });

    it('returns 500 on insert error', async () => {
      setupChain({ data: null, error: new Error('Insert failed') });
      const res = castMockResponse(await POST(createPostRequest({}) as any));
      expect(res.body).toEqual({ error: 'Insert failed' });
      expect(res.init).toEqual({ status: 500 });
    });
  });
  describe("auth failure", () => {
    it("returns 401 when not authenticated", async () => {
      authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: "Unauthorized" }) } });
      const res = castMockResponse(await (GET as any)(createGetRequest()));
      expect(res.status).toBe(401);
    });
  });
});
