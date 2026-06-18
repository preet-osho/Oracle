import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, createGetRequest, createPostRequest, makeSetupChain } from '../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

import { GET, POST } from './route';
const setupChain = makeSetupChain(from, authMock);

describe('Memories API /api/memories', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  it('returns memories for a client_id', async () => {
    const c = setupChain({ data: [{ id: '1', client_id: 'c1' }] });
    const res = castMockResponse(await GET(createGetRequest('http://localhost/api/memories?client_id=c1') as any));
    expect(c.eq).toHaveBeenCalledWith('client_id', 'c1');
    expect(res.body).toEqual([{ id: '1', client_id: 'c1' }]);
  });
  it('returns 400 when no client_id', async () => {
    const res = castMockResponse(await GET(createGetRequest('http://localhost/api/memories') as any));
    expect(res.body).toEqual({ error: 'client_id is required' });
    expect(res.init).toEqual({ status: 400 });
  });
  it('returns unique client_ids when all_clients=true', async () => {
    const c = setupChain({ data: [{ client_id: 'c1' }, { client_id: 'c2' }, { client_id: 'c1' }] });
    const res = castMockResponse(await GET(createGetRequest('http://localhost/api/memories?all_clients=true') as any));
    expect(c.select).toHaveBeenCalledWith('client_id');
    expect(res.body).toEqual(['c1', 'c2']);
  });
  it('returns 500 on error', async () => { setupChain({ data: null, error: new Error('DB') }); const res = castMockResponse(await GET(createGetRequest('http://localhost/api/memories?client_id=c1') as any)); expect(res.init).toEqual({ status: 500 }); });

  it('creates a memory', async () => {
    const c = setupChain({ data: { id: 'm1', content: 'New' } });
    const res = castMockResponse(await POST(createPostRequest({ content: 'New', clientId: 'c1' }) as any));
    expect(c.insert).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'm1', content: 'New' });
  });
  it('returns 500 on insert error', async () => { setupChain({ data: null, error: new Error('Insert failed') }); const res = castMockResponse(await POST(createPostRequest({ content: 'X', clientId: 'c1' }) as any)); expect(res.init).toEqual({ status: 500 }); });
  describe("auth failure", () => {
    it("returns 401 when not authenticated", async () => {
      authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: "Unauthorized" }) } });
      const res = castMockResponse(await GET(createGetRequest() as any));
      expect(res.status).toBe(401);
    });
  });
});
