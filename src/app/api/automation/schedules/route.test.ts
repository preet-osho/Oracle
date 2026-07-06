import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, createGetRequest, createPostRequest, makeSetupChain } from '../../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

const mockHasPermissionSync = vi.fn().mockReturnValue({ allowed: true });
vi.mock('@/lib/permissions', () => ({ hasPermissionSync: (...a: any[]) => mockHasPermissionSync(...a) }));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { GET, POST } from './route';
const setupChain = makeSetupChain(from, authMock);

// ─── Mock chain builder for multi-call routes ───

function makeMockChain(result: { data?: unknown; error?: unknown }) {
  const r = { data: result.data ?? null, error: result.error ?? null };
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    order: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue(r),
    then: (ok: any, fail?: any) => { if (r.error) fail?.(r.error); else ok(r); },
  };
  return chain;
}

/**
 * Set up from() to return different chains for sequential calls.
 * First call returns the "existing check" chain, second call returns the "mutation" chain.
 */
function setupDualChain(
  existingData: unknown,
  mutationData: unknown,
  mutationError?: unknown,
) {
  const firstChain = makeMockChain({ data: existingData, error: null });
  const secondChain = makeMockChain({ data: mutationData, error: mutationError ?? null });

  let callCount = 0;
  from.mockImplementation(() => {
    callCount++;
    if (callCount === 1) return firstChain;
    return secondChain;
  });

  return { firstChain, secondChain };
}

describe('Automation Schedules API /api/automation/schedules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChain();
    mockHasPermissionSync.mockReturnValue({ allowed: true });
  });

  // ─── GET ─────────────────────────────

  describe('GET', () => {
    it('returns schedules and available schedule definitions', async () => {
      const schedules = [
        { id: 's1', org_id: 'org-test-001', type: 'web-scan', enabled: true },
        { id: 's2', org_id: 'org-test-001', type: 'lead-followup', enabled: false },
      ];
      setupChain({ data: schedules });
      const res = castMockResponse(await GET()) as any;
      expect(res.body.schedules).toEqual(schedules);
      expect(res.body.available).toBeDefined();
      expect(Array.isArray(res.body.available)).toBe(true);
      expect(res.body.available.length).toBe(10);
    });

    it('returns empty schedules when no data', async () => {
      setupChain({ data: [] });
      const res = castMockResponse(await GET()) as any;
      expect(res.body.schedules).toEqual([]);
      expect(res.body.available.length).toBe(10);
    });

    it('returns empty schedules when query returns null', async () => {
      setupChain({ data: null });
      const res = castMockResponse(await GET()) as any;
      expect(res.body.schedules).toEqual([]);
    });

    it('returns empty schedules on DB error (graceful)', async () => {
      setupChain({ data: null, error: new Error('DB error') });
      const res = castMockResponse(await GET()) as any;
      expect(res.body.schedules).toEqual([]);
      expect(res.body.available).toBeDefined();
    });

    it('returns 401 when not authenticated', async () => {
      authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: 'Unauthorized' }) } });
      const res = castMockResponse(await GET());
      expect(res.status).toBe(401);
    });

    it('returns 400 when no org context', async () => {
      authMock.mockResolvedValue({ user: { id: 'u1' }, supabase: { from }, org: null });
      const res = castMockResponse(await GET());
      expect(res.init).toEqual({ status: 400 });
    });

    it('queries with correct org_id', async () => {
      const c = setupChain({ data: [] });
      await GET();
      expect(c.eq).toHaveBeenCalledWith('org_id', 'org-test-001');
    });

    it('returns available definitions with correct types', async () => {
      setupChain({ data: [] });
      const res = castMockResponse(await GET()) as any;
      const types = res.body.available.map((d: any) => d.type);
      expect(types).toContain('web-scan');
      expect(types).toContain('lead-followup');
      expect(types).toContain('report-weekly');
      expect(types).toContain('report-monthly');
      expect(types).toContain('quality-review');
      expect(types).toContain('memory-extraction');
    });
  });

  // ─── POST ────────────────────────────

  describe('POST', () => {
    it('creates a new schedule when none exists', async () => {
      const { secondChain } = setupDualChain(null, { id: 'new-schedule-1' });

      const res = castMockResponse(await POST(
        createPostRequest({ type: 'web-scan' }) as any
      )) as any;
      expect(res.body.success).toBe(true);
      expect(res.body.action).toBe('created');
      expect(res.body.scheduleId).toBe('new-schedule-1');
      expect(secondChain.insert).toHaveBeenCalled();
    });

    it('updates an existing schedule of the same type', async () => {
      setupDualChain({ id: 'existing-schedule-1' }, { id: 'existing-schedule-1' });

      const res = castMockResponse(await POST(
        createPostRequest({ type: 'web-scan', frequency: 'daily' }) as any
      )) as any;
      expect(res.body.success).toBe(true);
      expect(res.body.action).toBe('updated');
      expect(res.body.scheduleId).toBe('existing-schedule-1');
    });

    it('returns 400 for invalid schedule type', async () => {
      const res = castMockResponse(await POST(
        createPostRequest({ type: 'nonexistent-type' }) as any
      ));
      expect(res.init).toEqual({ status: 400 });
    });

    it('returns 400 when type is missing', async () => {
      const res = castMockResponse(await POST(
        createPostRequest({}) as any
      ));
      expect(res.init).toEqual({ status: 400 });
    });

    it('returns 400 for invalid cron expression', async () => {
      const res = castMockResponse(await POST(
        createPostRequest({ type: 'web-scan', cronExpression: 'invalid' }) as any
      ));
      expect(res.init).toEqual({ status: 400 });
    });

    it('returns 400 for invalid frequency', async () => {
      const res = castMockResponse(await POST(
        createPostRequest({ type: 'web-scan', frequency: 'yearly' }) as any
      ));
      expect(res.init).toEqual({ status: 400 });
    });

    it('returns 403 when user lacks admin permission', async () => {
      mockHasPermissionSync.mockReturnValue({ allowed: false, reason: 'Requires admin role' });
      const res = castMockResponse(await POST(
        createPostRequest({ type: 'web-scan' }) as any
      ));
      expect(res.init).toEqual({ status: 403 });
    });

    it('returns 401 when not authenticated', async () => {
      authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: 'Unauthorized' }) } });
      const res = castMockResponse(await POST(
        createPostRequest({ type: 'web-scan' }) as any
      ));
      expect(res.status).toBe(401);
    });

    it('returns 400 when no org context', async () => {
      authMock.mockResolvedValue({ user: { id: 'u1' }, supabase: { from }, org: null });
      const res = castMockResponse(await POST(
        createPostRequest({ type: 'web-scan' }) as any
      ));
      expect(res.init).toEqual({ status: 400 });
    });

    it('returns 500 on insert error', async () => {
      setupDualChain(null, null, new Error('Insert failed'));

      const res = castMockResponse(await POST(
        createPostRequest({ type: 'web-scan' }) as any
      ));
      expect(res.init).toEqual({ status: 500 });
    });

    it('returns 500 on update error', async () => {
      setupDualChain({ id: 'existing-1' }, null, new Error('Update failed'));

      const res = castMockResponse(await POST(
        createPostRequest({ type: 'web-scan' }) as any
      ));
      expect(res.init).toEqual({ status: 500 });
    });

    it('allows setting custom cron expression', async () => {
      setupDualChain(null, { id: 's-custom' });

      const res = castMockResponse(await POST(
        createPostRequest({ type: 'lead-followup', cronExpression: '0 14 * * 3' }) as any
      )) as any;
      expect(res.body.success).toBe(true);
      expect(res.body.action).toBe('created');
    });

    it('allows disabling a schedule', async () => {
      setupDualChain({ id: 's-enabled' }, { id: 's-enabled' });

      const res = castMockResponse(await POST(
        createPostRequest({ type: 'web-scan', enabled: false }) as any
      )) as any;
      expect(res.body.success).toBe(true);
      expect(res.body.action).toBe('updated');
    });

    it('allows setting custom config', async () => {
      setupDualChain(null, { id: 's-config' });

      const res = castMockResponse(await POST(
        createPostRequest({ type: 'web-scan', config: { categories: ['ai-model'] } }) as any
      )) as any;
      expect(res.body.success).toBe(true);
    });
  });
});
