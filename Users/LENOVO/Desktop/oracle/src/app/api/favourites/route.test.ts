import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, createGetRequest, createPostRequest, makeSetupChain } from '../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

import { GET, POST } from './route';
const setupChain = makeSetupChain(from, authMock);

describe('Favourites API /api/favourites', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  it('returns favourites list', async () => {
    const c = setupChain({ data: [{ id: 'f1', prompt_id: 'p1' }] });
    const res = castMockResponse(await GET());
    expect(from).toHaveBeenCalledWith('prompt_favourites');
    expect(res.body).toEqual([{ id: 'f1', prompt_id: 'p1' }]);
  });
  it('returns empty array when null', async () => { setupChain({ data: null }); const res = castMockResponse(await GET()); expect(res.body).toEqual([]); });
  it('returns 500 on error', async () => { setupChain({ data: null, error: new Error('DB') }); const res = castMockResponse(await GET()); expect(res.init).toEqual({ status: 500 }); });

  it('creates a favourite', async () => {
    const c = setupChain({ data: { id: 'f1', prompt_id: 'p1' } });
    const res = castMockResponse(await POST(createPostRequest({ prompt_id: 'p1' }) as any));
    expect(c.insert).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'f1', prompt_id: 'p1' });
  });
  it('returns 500 on insert error', async () => { setupChain({ data: null, error: new Error('Insert failed') }); const res = castMockResponse(await POST(createPostRequest({ prompt_id: 'p1' }) as any)); expect(res.init).toEqual({ status: 500 }); });
  describe("auth failure", () => {
    it("returns 401 when not authenticated", async () => {
      authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: "Unauthorized" }) } });
      const res = castMockResponse(await (GET as any)(createGetRequest()));
      expect(res.status).toBe(401);
    });
  });
});
