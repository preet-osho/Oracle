import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createGetRequest, createPostRequest, makeSetupChain, castMockResponse } from '../../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null) }));

import { DELETE, PATCH } from './route';
const setupChain = makeSetupChain(from, authMock);
const params = { params: Promise.resolve({ id: 'wt-1' }) };

describe('Single Workflow Template API /api/workflow-templates/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  // ── DELETE ──
  it('deletes a non-built-in template', async () => {
    // First query: check is_builtin → returns false
    setupChain({ data: { is_builtin: false } });
    // Second query: actually delete
    setupChain({ data: null });
    const res = castMockResponse(await DELETE(createGetRequest() as any, params));
    expect(res.body).toEqual({ success: true });
  });

  it('rejects deleting built-in templates', async () => {
    setupChain({ data: { is_builtin: true } });
    const res = castMockResponse(await DELETE(createGetRequest() as any, params));
    expect(res.body).toEqual({ error: 'Cannot delete built-in templates' });
    expect(res.init).toEqual({ status: 400 });
  });

  it('returns 500 on delete error', async () => {
    setupChain({ data: { is_builtin: false } });
    setupChain({ data: null, error: new Error('Delete failed') });
    const res = castMockResponse(await DELETE(createGetRequest() as any, params));
    expect(res.body).toEqual({ error: 'Delete failed' });
  });

  it('returns 400 when no org found', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' }, supabase: { from }, org: null });
    const res = await DELETE(createGetRequest() as any, params);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No organization found' });
  });

  // ── PATCH ──
  it('updates template name', async () => {
    const c = setupChain({ data: { id: 'wt-1', name: 'Updated Name' } });
    const res = castMockResponse(await PATCH(createPostRequest({ name: 'Updated Name' }) as any, params));
    expect(c.update).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'wt-1', name: 'Updated Name' });
  });

  it('updates template steps', async () => {
    const newSteps = [{ id: 's1', name: 'Step 1', prompt: 'Do stuff', description: '' }];
    const c = setupChain({ data: { id: 'wt-1', steps: newSteps } });
    const res = castMockResponse(await PATCH(createPostRequest({ steps: newSteps }) as any, params));
    expect(c.update).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'wt-1', steps: newSteps });
  });

  it('updates template domains', async () => {
    const c = setupChain({ data: { id: 'wt-1', domains: ['SEO', 'Content'] } });
    const res = castMockResponse(await PATCH(createPostRequest({ domains: ['SEO', 'Content'] }) as any, params));
    expect(c.update).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'wt-1', domains: ['SEO', 'Content'] });
  });

  it('updates template color', async () => {
    const c = setupChain({ data: { id: 'wt-1', color: '#10b981' } });
    const res = castMockResponse(await PATCH(createPostRequest({ color: '#10b981' }) as any, params));
    expect(c.update).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'wt-1', color: '#10b981' });
  });

  it('updates use_count', async () => {
    const c = setupChain({ data: { id: 'wt-1', use_count: 10 } });
    const res = castMockResponse(await PATCH(createPostRequest({ use_count: 10 }) as any, params));
    expect(c.update).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'wt-1', use_count: 10 });
  });

  it('returns 500 on update error', async () => {
    setupChain({ data: null, error: new Error('Update failed') });
    const res = castMockResponse(await PATCH(createPostRequest({ name: 'test' }) as any, params));
    expect(res.body).toEqual({ error: 'Update failed' });
  });
});
