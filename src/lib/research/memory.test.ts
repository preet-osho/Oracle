// ═══════════════════════════════════════
// ORACLE — Research Memory Tests
// CRUD operations, TTL expiry, cleanup
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Helpers ─────────────────────

/** Create a chainable mock that resolves to a preset value */
function createChainMock(resolveValue: unknown) {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolveValue),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    // Make the chain thenable — always resolves (Supabase resolves with {data, error})
    then: (resolve: (val: unknown) => void) => {
      resolve(resolveValue);
    },
  };
  return chain;
}

// ─── Module Mocks ─────────────────────

const { mockFrom, mockCreateClient } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockCreateClient = vi.fn();
  return { mockFrom, mockCreateClient };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Import after mocks ───────────────

import {
  storeFinding,
  listFindings,
  getFinding,
  deleteFinding,
  cleanupExpiredFindings,
  countFindings,
} from './memory';

// ─── Tests ────────────────────────────

describe('research memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    mockCreateClient.mockReturnValue({ from: mockFrom });
  });

  describe('storeFinding', () => {
    it('stores a finding with all fields', async () => {
      const now = Date.now();
      const mockRow = {
        id: 'test-id-1',
        user_id: 'user-1',
        client_id: 'client-1',
        research_type: 'competitor',
        target_url: 'https://example.com',
        target_query: 'best agency in mumbai',
        findings: { strengths: ['SEO'], weaknesses: ['no blog'] },
        report_markdown: '# Report',
        created_at: now,
        expires_at: now + 86400000,
      };

      const chain = createChainMock({ data: mockRow, error: null });
      chain.single.mockResolvedValue({ data: mockRow, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await storeFinding({
        userId: 'user-1',
        clientId: 'client-1',
        researchType: 'competitor',
        targetUrl: 'https://example.com',
        targetQuery: 'best agency in mumbai',
        findings: { strengths: ['SEO'], weaknesses: ['no blog'] },
        reportMarkdown: '# Report',
        ttlMs: 86400000,
      });

      expect(result.id).toBe('test-id-1');
      expect(result.userId).toBe('user-1');
      expect(result.clientId).toBe('client-1');
      expect(result.researchType).toBe('competitor');
      expect(result.targetUrl).toBe('https://example.com');
      expect(result.targetQuery).toBe('best agency in mumbai');
      expect(result.findings).toEqual({ strengths: ['SEO'], weaknesses: ['no blog'] });
      expect(result.reportMarkdown).toBe('# Report');
      expect(result.expiresAt).toBe(now + 86400000);
      expect(mockFrom).toHaveBeenCalledWith('research_findings');
      expect(chain.insert).toHaveBeenCalled();
    });

    it('stores a finding without optional fields', async () => {
      const now = Date.now();
      const mockRow = {
        id: 'test-id-2',
        user_id: 'user-1',
        client_id: null,
        research_type: 'market',
        target_url: null,
        target_query: null,
        findings: { data: 'test' },
        report_markdown: null,
        created_at: now,
        expires_at: null,
      };

      const chain = createChainMock({ data: mockRow, error: null });
      chain.single.mockResolvedValue({ data: mockRow, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await storeFinding({
        userId: 'user-1',
        researchType: 'market',
        findings: { data: 'test' },
      });

      expect(result.id).toBe('test-id-2');
      expect(result.clientId).toBeUndefined();
      expect(result.targetUrl).toBeUndefined();
      expect(result.targetQuery).toBeUndefined();
      expect(result.reportMarkdown).toBeUndefined();
      expect(result.expiresAt).toBeUndefined();
    });

    it('throws on Supabase error', async () => {
      const chain = createChainMock({ data: null, error: { message: 'Insert failed' } });
      chain.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
      mockFrom.mockReturnValue(chain);

      await expect(storeFinding({
        userId: 'user-1',
        researchType: 'competitor',
        findings: {},
      })).rejects.toThrow('Failed to store finding: Insert failed');
    });
  });

  describe('listFindings', () => {
    it('lists findings for a user', async () => {
      const mockRows = [
        { id: '1', user_id: 'user-1', research_type: 'competitor', findings: {}, created_at: Date.now() },
        { id: '2', user_id: 'user-1', research_type: 'market', findings: {}, created_at: Date.now() },
      ];
      const chain = createChainMock({ data: mockRows, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await listFindings({ userId: 'user-1' });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('filters by research type', async () => {
      const chain = createChainMock({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      await listFindings({ userId: 'user-1', researchType: 'competitor' });

      expect(chain.eq).toHaveBeenCalledWith('research_type', 'competitor');
    });

    it('filters by client id', async () => {
      const chain = createChainMock({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      await listFindings({ userId: 'user-1', clientId: 'client-1' });

      expect(chain.eq).toHaveBeenCalledWith('client_id', 'client-1');
    });

    it('applies TTL expiry filter by default', async () => {
      const chain = createChainMock({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      await listFindings({ userId: 'user-1' });

      expect(chain.or).toHaveBeenCalled();
    });

    it('skips TTL filter when includeExpired is true', async () => {
      const chain = createChainMock({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      await listFindings({ userId: 'user-1', includeExpired: true });

      expect(chain.or).not.toHaveBeenCalled();
    });

    it('throws on error', async () => {
      const chain = createChainMock({ data: null, error: { message: 'Query failed' } });
      mockFrom.mockReturnValue(chain);

      await expect(listFindings({ userId: 'user-1' })).rejects.toThrow('Failed to list findings');
    });
  });

  describe('getFinding', () => {
    it('returns a finding by id', async () => {
      const mockRow = {
        id: 'finding-1',
        user_id: 'user-1',
        research_type: 'competitor',
        findings: { test: true },
        created_at: Date.now(),
        expires_at: null,
      };
      const chain = createChainMock({ data: mockRow, error: null });
      chain.single.mockResolvedValue({ data: mockRow, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await getFinding('finding-1', 'user-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('finding-1');
      expect(result!.findings).toEqual({ test: true });
    });

    it('returns null for not found', async () => {
      const chain = createChainMock({ data: null, error: { code: 'PGRST116' } });
      chain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      mockFrom.mockReturnValue(chain);

      const result = await getFinding('nonexistent', 'user-1');

      expect(result).toBeNull();
    });

    it('returns null for expired findings', async () => {
      const mockRow = {
        id: 'expired-1',
        user_id: 'user-1',
        research_type: 'market',
        findings: {},
        created_at: Date.now() - 200000,
        expires_at: Date.now() - 100000,
      };
      const chain = createChainMock({ data: mockRow, error: null });
      chain.single.mockResolvedValue({ data: mockRow, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await getFinding('expired-1', 'user-1');

      expect(result).toBeNull();
    });

    it('throws on non-PGRST116 error', async () => {
      const chain = createChainMock({ data: null, error: { code: 'OTHER', message: 'DB error' } });
      chain.single.mockResolvedValue({ data: null, error: { code: 'OTHER', message: 'DB error' } });
      mockFrom.mockReturnValue(chain);

      await expect(getFinding('id', 'user-1')).rejects.toThrow('Failed to get finding');
    });
  });

  describe('deleteFinding', () => {
    it('deletes a finding successfully', async () => {
      const chain = createChainMock({ error: null });
      mockFrom.mockReturnValue(chain);

      const result = await deleteFinding('finding-1', 'user-1');

      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('research_findings');
      expect(chain.delete).toHaveBeenCalled();
    });

    it('throws on delete error', async () => {
      const chain = createChainMock({ error: { message: 'Delete failed' } });
      mockFrom.mockReturnValue(chain);

      await expect(deleteFinding('finding-1', 'user-1')).rejects.toThrow('Failed to delete finding');
    });
  });

  describe('cleanupExpiredFindings', () => {
    it('returns count of cleaned up findings', async () => {
      const chain = createChainMock({ data: [{ id: '1' }, { id: '2' }], error: null });
      chain.select.mockReturnValue({
        then: (resolve: (val: { data: unknown[]; error: null }) => void) => {
          resolve({ data: [{ id: '1' }, { id: '2' }], error: null });
        },
      });
      mockFrom.mockReturnValue(chain);

      const count = await cleanupExpiredFindings();

      expect(count).toBe(2);
    });

    it('returns 0 when no expired findings', async () => {
      const chain = createChainMock({ data: [], error: null });
      chain.select.mockReturnValue({
        then: (resolve: (val: { data: unknown[]; error: null }) => void) => {
          resolve({ data: [], error: null });
        },
      });
      mockFrom.mockReturnValue(chain);

      const count = await cleanupExpiredFindings();

      expect(count).toBe(0);
    });

    it('throws on cleanup error', async () => {
      const chain = createChainMock({ data: null, error: { message: 'Cleanup failed' } });
      chain.select.mockReturnValue({
        then: (resolve: (val: { data: null; error: { message: string } }) => void) => {
          resolve({ data: null, error: { message: 'Cleanup failed' } });
        },
      });
      mockFrom.mockReturnValue(chain);

      await expect(cleanupExpiredFindings()).rejects.toThrow('Failed to cleanup');
    });
  });

  describe('countFindings', () => {
    it('returns count of findings', async () => {
      const chain = createChainMock({ count: 5, error: null });
      chain.or.mockReturnValue({
        then: (resolve: (val: { count: number; error: null }) => void) => {
          resolve({ count: 5, error: null });
        },
      });
      mockFrom.mockReturnValue(chain);

      const count = await countFindings({ userId: 'user-1' });

      expect(count).toBe(5);
    });

    it('returns 0 on null count', async () => {
      const chain = createChainMock({ count: null, error: null });
      chain.or.mockReturnValue({
        then: (resolve: (val: { count: null; error: null }) => void) => {
          resolve({ count: null, error: null });
        },
      });
      mockFrom.mockReturnValue(chain);

      const count = await countFindings({ userId: 'user-1' });

      expect(count).toBe(0);
    });
  });
});
