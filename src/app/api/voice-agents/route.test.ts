import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createGetRequest, createPostRequest, makeSetupChain, castMockResponse } from '../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null) }));

import { GET, POST } from './route';
const setupChain = makeSetupChain(from, authMock);

describe('Voice Agents API /api/voice-agents', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  // ── GET ──
  it('returns voice agents for the org', async () => {
    const agents = [
      { id: 'va-1', name: 'Receptionist Bot', provider: 'vapi', language: 'English' },
    ];
    setupChain({ data: agents });
    const res = castMockResponse(await GET());
    expect(res.body).toEqual(agents);
  });

  it('returns empty array when no agents exist', async () => {
    setupChain({ data: [] });
    const res = castMockResponse(await GET());
    expect(res.body).toEqual([]);
  });

  it('returns 500 on fetch error', async () => {
    setupChain({ data: null, error: new Error('DB error') });
    const res = castMockResponse(await GET());
    expect(res.body).toEqual({ error: 'DB error' });
  });

  it('returns 400 when no org found', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' }, supabase: { from }, org: null });
    const res = await GET();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No organization found' });
  });

  // ── POST ──
  it('creates a new voice agent', async () => {
    const input = { name: 'Clinic Bot', provider: 'sarvam', voice: 'hindi-female-1', language: 'Hindi', greeting: 'Namaste', instructions: 'Help callers', tools: ['Book Appointment'] };
    const created = { id: 'va_new', name: 'Clinic Bot', provider: 'sarvam', is_active: false };
    const c = setupChain({ data: created });
    const res = castMockResponse(await POST(createPostRequest(input) as any));
    expect(c.insert).toHaveBeenCalled();
    expect(res.body).toEqual(created);
  });

  it('returns 400 when name is missing', async () => {
    const res = castMockResponse(await POST(createPostRequest({ provider: 'vapi' }) as any));
    expect(res.body).toEqual({ error: 'Name is required' });
    expect(res.init).toEqual({ status: 400 });
  });

  it('returns 400 when name is empty string', async () => {
    const res = castMockResponse(await POST(createPostRequest({ name: '  ' }) as any));
    expect(res.body).toEqual({ error: 'Name is required' });
  });

  it('defaults fields when optional values not provided', async () => {
    const input = { name: 'Minimal Bot' };
    const created = { id: 'va_min', name: 'Minimal Bot', provider: 'vapi', voice: 'Aria (Female, Professional)', language: 'English' };
    setupChain({ data: created });
    const res = castMockResponse(await POST(createPostRequest(input) as any));
    expect(res.body).toEqual(created);
  });

  it('returns 500 on insert error', async () => {
    setupChain({ data: null, error: new Error('Insert failed') });
    const res = castMockResponse(await POST(createPostRequest({ name: 'Bot' }) as any));
    expect(res.body).toEqual({ error: 'Insert failed' });
  });
});
