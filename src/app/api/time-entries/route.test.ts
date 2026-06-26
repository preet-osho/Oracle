import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, createGetRequest, createPostRequest, makeSetupChain } from '../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

import { GET, POST } from './route';
const setupChain = makeSetupChain(from, authMock);

describe('Time Entries API /api/time-entries', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  it('returns time entries list', async () => {
    const c = setupChain({ data: [{ id: 'te-1', description: 'SEO work' }] });
    const res = castMockResponse(await GET(createGetRequest() as any));
    expect(from).toHaveBeenCalledWith('time_entries');
    expect(c.order).toHaveBeenCalledWith('date', { ascending: false });
    expect(res.body).toEqual([{ id: 'te-1', description: 'SEO work' }]);
  });
  it('filters by client_id', async () => {
    const c = setupChain({ data: [] });
    await GET(createGetRequest('http://localhost/api/time-entries?client_id=c1') as any);
    expect(c.eq).toHaveBeenCalledWith('client_id', 'c1');
  });
  it('returns 500 on error', async () => { setupChain({ data: null, error: new Error('DB') }); const res = castMockResponse(await GET(createGetRequest() as any)); expect(res.init).toEqual({ status: 500 }); });

  it('creates a time entry', async () => {
    const c = setupChain({ data: { id: 'te-1', description: 'SEO work' } });
    const res = castMockResponse(await POST(createPostRequest({ description: 'SEO work', clientId: 'c1' }) as any));
    expect(c.insert).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'te-1', description: 'SEO work' });
  });
  it('returns 500 on insert error', async () => { setupChain({ data: null, error: new Error('Insert failed') }); const res = castMockResponse(await POST(createPostRequest({}) as any)); expect(res.init).toEqual({ status: 500 }); });
  describe("auth failure", () => {
    it("returns 401 when not authenticated", async () => {
      authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: "Unauthorized" }) } });
      const res = castMockResponse(await GET(createGetRequest() as any));
      expect(res.status).toBe(401);
    });
  });
});
