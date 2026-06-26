import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createGetRequest, makeSetupChain } from '../../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

import { DELETE } from './route';
const setupChain = makeSetupChain(from, authMock);
const params = { params: Promise.resolve({ id: 'mem-1' }) };

describe('Single Memory API /api/memories/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });
  it('deletes a memory by id', async () => {
    const c = setupChain({ data: null });
    const res = await DELETE(createGetRequest() as any, params);
    expect(c.delete).toHaveBeenCalled();
    expect(res.body).toEqual({ success: true });
  });
  it('returns 500 on delete error', async () => { setupChain({ data: null, error: new Error('Delete failed') }); const res = await DELETE(createGetRequest() as any, params); expect(res.body).toEqual({ error: 'Delete failed' }); });
});
