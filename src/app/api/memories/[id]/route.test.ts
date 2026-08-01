import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createGetRequest, createPostRequest, makeSetupChain, castMockResponse } from '../../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null) }));

import { DELETE, PATCH } from './route';
const setupChain = makeSetupChain(from, authMock);
const params = { params: Promise.resolve({ id: 'mem-1' }) };

describe('Single Memory API /api/memories/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  // ── DELETE ──
  it('deletes a memory by id', async () => {
    setupChain({ data: null });
    const res = await DELETE(createGetRequest() as any, params);
    expect(from().delete).toHaveBeenCalled();
    expect(res.body).toEqual({ success: true });
  });
  it('returns 500 on delete error', async () => { setupChain({ data: null, error: new Error('Delete failed') }); const res = await DELETE(createGetRequest() as any, params); expect(res.body).toEqual({ error: 'Delete failed' }); });

  // ── PATCH ──
  it('updates memory content', async () => {
    const c = setupChain({ data: { id: 'mem-1', content: 'Updated content' } });
    const res = await PATCH(createPostRequest({ content: 'Updated content' }) as any, params);
    expect(c.update).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'mem-1', content: 'Updated content' });
  });
  it('updates memory category', async () => {
    const c = setupChain({ data: { id: 'mem-1', category: 'preference' } });
    const res = await PATCH(createPostRequest({ category: 'preference' }) as any, params);
    expect(c.update).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'mem-1', category: 'preference' });
  });
  it('updates memory importance', async () => {
    const c = setupChain({ data: { id: 'mem-1', importance: 3 } });
    const res = await PATCH(createPostRequest({ importance: 3 }) as any, params);
    expect(c.update).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'mem-1', importance: 3 });
  });
  it('returns 400 when no fields to update', async () => {
    const res = castMockResponse(await PATCH(createPostRequest({}) as any, params));
    expect(res.body).toEqual({ error: 'No fields to update' });
    expect(res.init).toEqual({ status: 400 });
  });
  it('returns 500 on update error', async () => {
    setupChain({ data: null, error: new Error('Update failed') });
    const res = castMockResponse(await PATCH(createPostRequest({ content: 'test' }) as any, params));
    expect(res.body).toEqual({ error: 'Update failed' });
  });
  it('returns 500 when delete fails with error', async () => {
    setupChain({ data: null, error: new Error('Permission denied') });
    const res = castMockResponse(await DELETE(createGetRequest() as any, params));
    expect(res.body).toEqual({ error: 'Permission denied' });
    expect(res.init).toEqual({ status: 500 });
  });
});
