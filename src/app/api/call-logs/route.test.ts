import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createGetRequest, createPostRequest, makeSetupChain, castMockResponse } from '../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

import { GET, POST } from './route';
const setupChain = makeSetupChain(from, authMock);

describe('Call Logs API /api/call-logs', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  // ── GET ──
  it('returns call logs for the org', async () => {
    const logs = [
      { id: 'cl-1', agent_id: 'va-1', caller_number: '+91 98XXX', duration: 120, status: 'completed' },
    ];
    setupChain({ data: logs });
    const res = castMockResponse(await GET(createGetRequest() as any));
    expect(res.body).toEqual(logs);
  });

  it('returns empty array when no logs exist', async () => {
    setupChain({ data: [] });
    const res = castMockResponse(await GET(createGetRequest() as any));
    expect(res.body).toEqual([]);
  });

  it('returns 500 on fetch error', async () => {
    setupChain({ data: null, error: new Error('DB error') });
    const res = castMockResponse(await GET(createGetRequest() as any));
    expect(res.body).toEqual({ error: 'DB error' });
  });

  it('filters logs by agent_id when provided', async () => {
    const logs = [{ id: 'cl-1', agent_id: 'va-1' }];
    const c = setupChain({ data: logs });
    const req = { url: 'http://localhost/api/call-logs?agent_id=va-1' } as any;
    const res = castMockResponse(await GET(req));
    expect(c.eq).toHaveBeenCalled();
    expect(res.body).toEqual(logs);
  });

  it('returns 400 when no org found', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' }, supabase: { from }, org: null });
    const res = await GET(createGetRequest() as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No organization found' });
  });

  // ── POST ──
  it('creates a new call log', async () => {
    const input = { agent_id: 'va-1', caller_number: '+91 98XXX', duration: 120, status: 'completed', transcript: 'Hello' };
    const created = { id: 'cl_new', agent_id: 'va-1', caller_number: '+91 98XXX', duration: 120 };
    const c = setupChain({ data: created });
    const res = castMockResponse(await POST(createPostRequest(input) as any));
    expect(c.insert).toHaveBeenCalled();
    expect(res.body).toEqual(created);
  });

  it('returns 400 when agent_id is missing', async () => {
    const res = castMockResponse(await POST(createPostRequest({ caller_number: '+91 98XXX' }) as any));
    expect(res.body).toEqual({ error: 'agent_id is required' });
    expect(res.init).toEqual({ status: 400 });
  });

  it('defaults fields when optional values not provided', async () => {
    const input = { agent_id: 'va-1' };
    const created = { id: 'cl_min', agent_id: 'va-1', status: 'completed', sentiment: 'neutral' };
    setupChain({ data: created });
    const res = castMockResponse(await POST(createPostRequest(input) as any));
    expect(res.body).toEqual(created);
  });

  it('returns 500 on insert error', async () => {
    setupChain({ data: null, error: new Error('Insert failed') });
    const res = castMockResponse(await POST(createPostRequest({ agent_id: 'va-1' }) as any));
    expect(res.body).toEqual({ error: 'Insert failed' });
  });

  it('returns 400 when no org found on create', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' }, supabase: { from }, org: null });
    const res = await POST(createPostRequest({ agent_id: 'va-1' }) as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No organization found' });
  });
});
