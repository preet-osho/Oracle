import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, createGetRequest, createPostRequest, makeSetupChain } from '../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

import { GET, POST } from './route';
const setupChain = makeSetupChain(from, authMock);

describe('Knowledge Docs API /api/knowledge-docs', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  it('returns knowledge docs list', async () => {
    const c = setupChain({ data: [{ id: 'doc-1', name: 'Guide.md' }] });
    const res = castMockResponse(await GET());
    expect(from).toHaveBeenCalledWith('knowledge_docs');
    expect(res.body).toEqual([{ id: 'doc-1', name: 'Guide.md' }]);
  });
  it('returns empty array when null', async () => { setupChain({ data: null }); const res = castMockResponse(await GET()); expect(res.body).toEqual([]); });
  it('returns 500 on error', async () => { setupChain({ data: null, error: new Error('DB') }); const res = castMockResponse(await GET()); expect(res.init).toEqual({ status: 500 }); });

  it('creates a knowledge doc', async () => {
    const c = setupChain({ data: { id: 'doc-1', name: 'Guide.md' } });
    const res = castMockResponse(await POST(createPostRequest({ name: 'Guide.md', content: 'Content' }) as any));
    expect(c.insert).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'doc-1', name: 'Guide.md' });
  });
  it('sets source and tags defaults', async () => {
    const c = setupChain({ data: { id: '1' } });
    await POST(createPostRequest({ name: 'Doc' }) as any);
    expect(c.insert.mock.calls[0][0].source).toBe('upload');
    expect(c.insert.mock.calls[0][0].tags).toEqual([]);
  });
  it('returns 500 on insert error', async () => { setupChain({ data: null, error: new Error('Insert failed') }); const res = castMockResponse(await POST(createPostRequest({ name: 'X' }) as any)); expect(res.init).toEqual({ status: 500 }); });
  describe("auth failure", () => {
    it("returns 401 when not authenticated", async () => {
      authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: "Unauthorized" }) } });
      const res = castMockResponse(await (GET as any)(createGetRequest()));
      expect(res.status).toBe(401);
    });
  });
});
