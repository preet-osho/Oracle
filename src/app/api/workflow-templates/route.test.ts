import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createGetRequest, createPostRequest, makeSetupChain, castMockResponse } from '../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null) }));

import { GET, POST } from './route';
const setupChain = makeSetupChain(from, authMock);

describe('Workflow Templates API /api/workflow-templates', () => {
  beforeEach(() => { vi.clearAllMocks(); setupChain(); });

  // ── GET ──
  it('returns workflow templates for the org', async () => {
    const templates = [
      { id: 'wt-1', name: 'Client Onboarding', steps: [{ id: 's1', name: 'Research', prompt: 'research' }], is_builtin: true, use_count: 5 },
    ];
    setupChain({ data: templates });
    const res = castMockResponse(await GET());
    expect(res.body).toEqual(templates);
  });

  it('returns empty array when no templates exist', async () => {
    setupChain({ data: [] });
    const res = castMockResponse(await GET());
    expect(res.body).toEqual([]);
  });

  it('returns 500 on fetch error', async () => {
    setupChain({ data: null, error: new Error('DB connection failed') });
    const res = castMockResponse(await GET());
    expect(res.body).toEqual({ error: 'DB connection failed' });
  });

  it('returns 400 when no org found', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' }, supabase: { from }, org: null });
    const res = await GET();
    // native Response.json() — read via .json() and .status
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No organization found' });
  });

  // ── POST ──
  it('creates a new workflow template', async () => {
    const input = {
      name: 'Monthly Audit',
      description: 'Monthly client audit workflow',
      color: '#10b981',
      estimated_time: '3 hours',
      domains: ['SEO', 'Content'],
      steps: [
        { id: 's1', name: 'Audit SEO', description: 'Run SEO audit', prompt: 'Audit the client site for SEO issues' },
        { id: 's2', name: 'Audit Content', description: 'Run content audit', prompt: 'Audit the client content' },
      ],
    };
    const created = {
      id: 'wt_new_123',
      org_id: 'org-test-001',
      ...input,
      is_builtin: false,
      use_count: 0,
      created_at: 1234567890,
      updated_at: 1234567890,
    };
    const c = setupChain({ data: created });
    const res = castMockResponse(await POST(createPostRequest(input) as any));
    expect(c.insert).toHaveBeenCalled();
    expect(res.body).toEqual(created);
  });

  it('returns 400 when name is missing', async () => {
    const res = castMockResponse(await POST(createPostRequest({ steps: [{ name: 's', prompt: 'p' }] }) as any));
    expect(res.body).toEqual({ error: 'Name is required' });
    expect(res.init).toEqual({ status: 400 });
  });

  it('returns 400 when name is empty string', async () => {
    const res = castMockResponse(await POST(createPostRequest({ name: '  ', steps: [{ name: 's', prompt: 'p' }] }) as any));
    expect(res.body).toEqual({ error: 'Name is required' });
  });

  it('returns 400 when steps is missing', async () => {
    const res = castMockResponse(await POST(createPostRequest({ name: 'Test' }) as any));
    expect(res.body).toEqual({ error: 'At least one step is required' });
  });

  it('returns 400 when steps is empty array', async () => {
    const res = castMockResponse(await POST(createPostRequest({ name: 'Test', steps: [] }) as any));
    expect(res.body).toEqual({ error: 'At least one step is required' });
  });

  it('returns 500 on insert error', async () => {
    const input = { name: 'Test', steps: [{ name: 'Step 1', prompt: 'Do something' }] };
    setupChain({ data: null, error: new Error('Insert failed') });
    const res = castMockResponse(await POST(createPostRequest(input) as any));
    expect(res.body).toEqual({ error: 'Insert failed' });
  });

  it('defaults fields when optional values not provided', async () => {
    const input = { name: 'Minimal', steps: [{ name: 'Step 1', prompt: 'prompt' }] };
    const created = { id: 'wt_min', name: 'Minimal', color: '#3b82f6', estimated_time: '1-2 hours', domains: [] };
    setupChain({ data: created });
    const res = castMockResponse(await POST(createPostRequest(input) as any));
    expect(res.body).toEqual(created);
  });
});
