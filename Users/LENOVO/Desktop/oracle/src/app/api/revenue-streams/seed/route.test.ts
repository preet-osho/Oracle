import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, makeSetupChain } from '../../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

import { POST } from './route';
const setupChain = makeSetupChain(from, authMock);

describe('Revenue Streams Seed API /api/revenue-streams/seed', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  it('seeds templates when user has no streams', async () => {
    // First call: count = 0 (no existing streams
    const countChain = {
      select: vi.fn().mockReturnThis(),
      then: (ok: any) => ok({ count: 0, error: null }),
    };
    // Second call: insert returns seeded data
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (ok: any) => ok({ data: [{ id: '1', name: 'Website Development' }], error: null }),
    };

    let callCount = 0;
    from.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? countChain : insertChain;
    });

    const res = castMockResponse(await POST());
    expect((res.body as any).seeded).toBe(true);
    expect((res.body as any).streams).toEqual([{ id: '1', name: 'Website Development' }]);
  });

  it('returns existing streams when user already has them', async () => {
    // First call: count > 0
    const countChain = {
      select: vi.fn().mockReturnThis(),
      then: (ok: any) => ok({ count: 5, error: null }),
    };
    // Second call: fetch existing
    const fetchChain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (ok: any) => ok({ data: [{ id: 'existing-1', name: 'SEO' }], error: null }),
    };

    let callCount = 0;
    from.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? countChain : fetchChain;
    });

    const res = castMockResponse(await POST());
    expect((res.body as any).seeded).toBe(false);
    expect((res.body as any).streams).toEqual([{ id: 'existing-1', name: 'SEO' }]);
  });

  it('returns 500 on error', async () => {
    const errorChain = {
      select: vi.fn().mockReturnThis(),
      then: (_ok: any, fail: any) => fail(new Error('DB error')),
    };
    from.mockReturnValue(errorChain);

    const res = castMockResponse(await POST());
    expect(res.body).toEqual({ error: 'DB error' });
  });

  it('returns 401 when not authenticated', async () => {
    authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: 'Unauthorized' }) } });
    const res = castMockResponse(await POST());
    expect(res.status).toBe(401);
  });
});
