import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createGetRequest, createPostRequest, makeSetupChain, castMockResponse } from '../../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null) }));

import { PATCH, DELETE } from './route';
const setupChain = makeSetupChain(from, authMock);
const params = { params: Promise.resolve({ id: 'va-1' }) };

describe('Single Voice Agent API /api/voice-agents/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  // ── PATCH ──
  it('updates agent name', async () => {
    const c = setupChain({ data: { id: 'va-1', name: 'Updated Bot' } });
    const res = castMockResponse(await PATCH(createPostRequest({ name: 'Updated Bot' }) as any, params));
    expect(c.update).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'va-1', name: 'Updated Bot' });
  });

  it('updates agent provider', async () => {
    const c = setupChain({ data: { id: 'va-1', provider: 'sarvam' } });
    const res = castMockResponse(await PATCH(createPostRequest({ provider: 'sarvam' }) as any, params));
    expect(c.update).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'va-1', provider: 'sarvam' });
  });

  it('updates agent is_active', async () => {
    const c = setupChain({ data: { id: 'va-1', is_active: true } });
    const res = castMockResponse(await PATCH(createPostRequest({ is_active: true }) as any, params));
    expect(c.update).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'va-1', is_active: true });
  });

  it('updates agent tools', async () => {
    const c = setupChain({ data: { id: 'va-1', tools: ['Book Appointment', 'CRM Lookup'] } });
    const res = castMockResponse(await PATCH(createPostRequest({ tools: ['Book Appointment', 'CRM Lookup'] }) as any, params));
    expect(c.update).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'va-1', tools: ['Book Appointment', 'CRM Lookup'] });
  });

  it('returns 500 on update error', async () => {
    setupChain({ data: null, error: new Error('Update failed') });
    const res = castMockResponse(await PATCH(createPostRequest({ name: 'test' }) as any, params));
    expect(res.body).toEqual({ error: 'Update failed' });
  });

  it('returns 400 when no org found', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' }, supabase: { from }, org: null });
    const res = await PATCH(createPostRequest({ name: 'test' }) as any, params);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No organization found' });
  });

  // ── DELETE ──
  it('deletes a voice agent', async () => {
    setupChain({ data: null });
    const res = castMockResponse(await DELETE(createGetRequest() as any, params));
    expect(res.body).toEqual({ success: true });
  });

  it('returns 500 on delete error', async () => {
    setupChain({ data: null, error: new Error('Delete failed') });
    const res = castMockResponse(await DELETE(createGetRequest() as any, params));
    expect(res.body).toEqual({ error: 'Delete failed' });
  });

  it('returns 400 when no org found on delete', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' }, supabase: { from }, org: null });
    const res = await DELETE(createGetRequest() as any, params);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No organization found' });
  });
});
