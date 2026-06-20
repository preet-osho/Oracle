import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createGetRequest, castMockResponse } from '../../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

const mockEnforceRateLimit = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: (...a: any[]) => mockEnforceRateLimit(...a) }));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { GET, DELETE } from './route';

// ─── Mock chain builder ────────────────
// The indexed route makes two sequential from() calls:
//   1. from('knowledge_docs') — get user's doc IDs
//   2. from('document_chunks') — check/delete chunks
// We need from() to return different chains per table.

function makeChain(result: Record<string, unknown>) {
  const r = { data: result.data ?? [], error: result.error ?? null, ...result };
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    // Supabase never rejects — always resolves with { data, error }
    then: (ok: any) => { ok(r); },
  };
  return chain;
}

function setupChains(knowledgeDocsResult: { data?: unknown; error?: unknown }, chunksResult: { data?: unknown; error?: unknown; count?: number }) {
  const docsChain = makeChain(knowledgeDocsResult);
  const chunksChain = makeChain(chunksResult);

  from.mockImplementation((table: string) => {
    if (table === 'knowledge_docs') return docsChain;
    if (table === 'document_chunks') return chunksChain;
    return docsChain;
  });

  authMock.mockResolvedValue({
    user: { id: 'u1' },
    supabase: { from, auth: { getUser: vi.fn() } },
    org: { orgId: 'org-test-001', role: 'owner' },
  });

  return { docsChain, chunksChain };
}

// ─── Tests ─────────────────────────────

describe('Knowledge Docs Indexed /api/knowledge-docs/indexed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(null);
  });

  // ── GET ──

  describe('GET', () => {
    it('returns indexed doc IDs', async () => {
      const { docsChain, chunksChain } = setupChains(
        { data: [{ id: 'doc-1' }, { id: 'doc-2' }] },
        { data: [{ document_id: 'doc-1' }, { document_id: 'doc-1' }, { document_id: 'doc-2' }] },
      );

      const res = castMockResponse(await GET());

      expect(res.body).toEqual({ indexedIds: ['doc-1', 'doc-2'] });
      expect(docsChain.select).toHaveBeenCalledWith('id');
      expect(docsChain.eq).toHaveBeenCalledWith('org_id', 'org-test-001');
      expect(chunksChain.select).toHaveBeenCalledWith('document_id');
    });

    it('returns empty when user has no docs', async () => {
      setupChains({ data: [] }, { data: [] });

      const res = castMockResponse(await GET());
      expect(res.body).toEqual({ indexedIds: [] });
    });

    it('returns empty when docs query returns null', async () => {
      setupChains({ data: null }, { data: [] });

      const res = castMockResponse(await GET());
      expect(res.body).toEqual({ indexedIds: [] });
    });

    it('deduplicates document IDs from chunks', async () => {
      setupChains(
        { data: [{ id: 'doc-1' }] },
        { data: [{ document_id: 'doc-1' }, { document_id: 'doc-1' }, { document_id: 'doc-1' }] },
      );

      const res = castMockResponse(await GET());
      expect(res.body).toEqual({ indexedIds: ['doc-1'] });
    });

    it('returns empty when chunks query fails (migration not run)', async () => {
      setupChains(
        { data: [{ id: 'doc-1' }] },
        { data: null, error: { message: 'relation "document_chunks" does not exist' } },
      );

      const res = castMockResponse(await GET());
      expect(res.body).toEqual({ indexedIds: [] });
    });

    it('returns empty when no chunks exist', async () => {
      setupChains(
        { data: [{ id: 'doc-1' }, { id: 'doc-2' }] },
        { data: [] },
      );

      const res = castMockResponse(await GET());
      expect(res.body).toEqual({ indexedIds: [] });
    });

    it('returns 401 when not authenticated', async () => {
      authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: 'Unauthorized' }) } });
      const res = castMockResponse(await GET());
      expect(res.status).toBe(401);
    });
  });

  // ── DELETE ──

  describe('DELETE', () => {
    it('clears all embeddings for user docs', async () => {
      const { docsChain, chunksChain } = setupChains(
        { data: [{ id: 'doc-1' }, { id: 'doc-2' }] },
        { data: null, count: 15 },
      );

      const res = castMockResponse(await DELETE());

      expect(docsChain.select).toHaveBeenCalledWith('id');
      expect(docsChain.eq).toHaveBeenCalledWith('org_id', 'org-test-001');
      expect(chunksChain.delete).toHaveBeenCalled();
      expect(chunksChain.in).toHaveBeenCalledWith('document_id', ['doc-1', 'doc-2']);
      expect(res.body).toEqual({
        deleted: 15,
        message: 'Cleared 15 chunks across 2 documents',
      });
    });

    it('returns message when user has no docs', async () => {
      setupChains({ data: [] }, { data: null });

      const res = castMockResponse(await DELETE());
      expect(res.body).toEqual({ deleted: 0, message: 'No documents to clear' });
    });

    it('returns message when docs query returns null', async () => {
      setupChains({ data: null }, { data: null });

      const res = castMockResponse(await DELETE());
      expect(res.body).toEqual({ deleted: 0, message: 'No documents to clear' });
    });

    it('returns message when delete fails (migration not run)', async () => {
      setupChains(
        { data: [{ id: 'doc-1' }] },
        { data: null, error: { message: 'relation "document_chunks" does not exist' } },
      );

      const res = castMockResponse(await DELETE());
      expect(res.body).toEqual({
        deleted: 0,
        message: 'No embeddings to clear (migration may not be run)',
      });
    });

    it('returns 401 when not authenticated', async () => {
      authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: 'Unauthorized' }) } });
      const res = castMockResponse(await DELETE());
      expect(res.status).toBe(401);
    });

    it('returns 429 when rate limited', async () => {
      setupChains({ data: [{ id: 'doc-1' }] }, { data: null });
      const rlResponse = { status: 429, json: async () => ({ error: 'Rate limited' }) };
      mockEnforceRateLimit.mockResolvedValue(rlResponse);
      const res = castMockResponse(await DELETE());
      expect(res.status).toBe(429);
    });
  });
});
