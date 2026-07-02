import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ─────────────────────────────

const mockRpc = vi.fn();

// Chainable Supabase query builder mock
function createQueryBuilder() {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.delete = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  // Make it thenable so `await` works
  builder.then = vi.fn((resolve: (v: unknown) => void) =>
    resolve({ data: null, error: null })
  );
  return builder;
}

let mockQueryBuilder = createQueryBuilder();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => mockQueryBuilder),
    rpc: mockRpc,
  })),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock fetch (global)
const mockFetch = vi.fn();

// ─── Setup ─────────────────────────────

import { createClient } from '@supabase/supabase-js';
import {
  generateEmbeddings,
  generateEmbedding,
  storeEmbeddings,
  semanticSearch,
  deleteEmbeddings,
  isSemanticSearchAvailable,
} from './embeddings';

describe('Embeddings', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);

    // Set env vars for tests
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    // Reset query builder and Supabase mock
    mockQueryBuilder = createQueryBuilder();
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn(() => mockQueryBuilder),
      rpc: mockRpc,
    } as unknown as ReturnType<typeof createClient>);

    // Reset rpc mock to return success by default
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  // ── generateEmbeddings ──

  describe('generateEmbeddings', () => {
    it('returns empty array when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      const result = await generateEmbeddings(['hello']);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty input', async () => {
      const result = await generateEmbeddings([]);
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls OpenAI embeddings API with correct params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
        }),
      });

      await generateEmbeddings(['hello world']);

      expect(mockFetch).toHaveBeenCalledWith('https://api.openai.com/v1/embeddings', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-openai-key',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: ['hello world'],
          encoding_format: 'float',
        }),
      }));
    });

    it('returns embeddings in correct order when API returns scrambled indices', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            { embedding: [0.4, 0.5, 0.6], index: 1 },
            { embedding: [0.1, 0.2, 0.3], index: 0 },
          ],
        }),
      });

      const result = await generateEmbeddings(['first', 'second']);
      expect(result).toEqual([
        [0.1, 0.2, 0.3], // index 0
        [0.4, 0.5, 0.6], // index 1
      ]);
    });

    it('returns empty arrays for failed batches', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue('Rate limited'),
      });

      const result = await generateEmbeddings(['hello']);
      expect(result).toEqual([[]]);
    });

    it('returns empty arrays on network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const result = await generateEmbeddings(['hello']);
      expect(result).toEqual([[]]);
    });

    it('truncates text longer than MAX_CHUNK_LENGTH', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1], index: 0 }],
        }),
      });

      const longText = 'A'.repeat(10000); // Exceeds MAX_CHUNK_LENGTH (8000)
      await generateEmbeddings([longText]);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.input[0].length).toBe(8000); // Truncated
    });

    it('processes multiple batches when exceeding BATCH_SIZE', async () => {
      // BATCH_SIZE is 100. 150 texts → 2 batches: [0..99] and [100..149]
      const texts = Array.from({ length: 150 }, (_, i) => `text-${i}`);
      let callCount = 0;

      mockFetch.mockImplementation(() => {
        callCount++;
        const batchSize = callCount === 1 ? 100 : 50;
        const offset = callCount === 1 ? 0 : 100;
        const data = Array.from({ length: batchSize }, (_, i) => ({
          embedding: new Array(10).fill(0.1),
          index: i,
        }));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data }),
        });
      });

      const result = await generateEmbeddings(texts);
      expect(result).toHaveLength(150);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ── generateEmbedding ──

  describe('generateEmbedding', () => {
    it('generates a single embedding', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
        }),
      });

      const result = await generateEmbedding('hello world');
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it('returns empty array when API key is missing', async () => {
      delete process.env.OPENAI_API_KEY;
      const result = await generateEmbedding('hello');
      expect(result).toEqual([]);
    });
  });

  // ── storeEmbeddings ──

  describe('storeEmbeddings', () => {
    it('returns 0 when Supabase is not configured', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      // Reset modules to clear singleton
      vi.resetModules();
      const { storeEmbeddings: freshStoreEmbeddings } = await import('./embeddings');
      const result = await freshStoreEmbeddings({
        documentId: 'doc-1',
        chunks: ['chunk 1', 'chunk 2'],
      });
      expect(result).toBe(0);
    });

    it('generates embeddings and stores in Supabase', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            { embedding: [0.1, 0.2], index: 0 },
            { embedding: [0.3, 0.4], index: 1 },
          ],
        }),
      });

      const result = await storeEmbeddings({
        documentId: 'doc-1',
        chunks: ['chunk 1', 'chunk 2'],
      });

      expect(result).toBe(2);
      // Verify delete was called (re-index: delete old chunks)
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('document_id', 'doc-1');
      // Verify insert was called with correct rows
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      const insertCall = mockQueryBuilder.insert.mock.calls[0][0] as Array<Record<string, unknown>>;
      expect(insertCall).toHaveLength(2);
      expect(insertCall[0]).toMatchObject({
        id: 'doc-1_chunk_0',
        document_id: 'doc-1',
        chunk_index: 0,
        content: 'chunk 1',
      });
      expect(insertCall[1]).toMatchObject({
        id: 'doc-1_chunk_1',
        document_id: 'doc-1',
        chunk_index: 1,
        content: 'chunk 2',
      });
    });

    it('returns 0 when all embeddings fail', async () => {
      mockFetch.mockRejectedValue(new Error('API down'));

      const result = await storeEmbeddings({
        documentId: 'doc-1',
        chunks: ['chunk 1'],
      });

      expect(result).toBe(0);
    });

    it('filters out chunks with empty embeddings', async () => {
      // Return one valid and one empty embedding
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            { embedding: [0.1, 0.2], index: 0 },
            { embedding: [], index: 1 }, // Empty embedding
          ],
        }),
      });

      const result = await storeEmbeddings({
        documentId: 'doc-1',
        chunks: ['valid chunk', 'empty chunk'],
      });

      expect(result).toBe(1); // Only the valid chunk stored
      const insertCall = mockQueryBuilder.insert.mock.calls[0][0] as Array<Record<string, unknown>>;
      expect(insertCall).toHaveLength(1);
      expect(insertCall[0].content).toBe('valid chunk');
    });

    it('returns 0 when Supabase insert fails', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2], index: 0 }],
        }),
      });

      // Make insert return an error
      const errorBuilder = createQueryBuilder();
      errorBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: null, error: { message: 'Insert failed' } })
      );
      mockQueryBuilder.insert.mockReturnValue(errorBuilder);

      const result = await storeEmbeddings({
        documentId: 'doc-1',
        chunks: ['chunk 1'],
      });

      expect(result).toBe(0);
    });
  });

  // ── semanticSearch ──

  describe('semanticSearch', () => {
    it('returns empty array when Supabase is not configured', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      vi.resetModules();
      const { semanticSearch: freshSemanticSearch } = await import('./embeddings');
      const result = await freshSemanticSearch('query');
      expect(result).toEqual([]);
    });

    it('returns empty when query embedding fails', async () => {
      delete process.env.OPENAI_API_KEY;
      vi.resetModules();
      const { semanticSearch: freshSemanticSearch } = await import('./embeddings');
      const result = await freshSemanticSearch('query');
      expect(result).toEqual([]);
    });

    it('calls match_documents RPC with correct params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2], index: 0 }],
        }),
      });

      mockRpc.mockResolvedValue({
        data: [
          {
            id: 'chunk-1',
            document_id: 'doc-1',
            content: 'matching content',
            similarity: 0.85,
            chunk_index: 0,
          },
        ],
        error: null,
      });

      const result = await semanticSearch('test query', {
        matchThreshold: 0.5,
        matchCount: 3,
        documentIds: ['doc-1', 'doc-2'],
      });

      expect(mockRpc).toHaveBeenCalledWith('match_documents', {
        query_embedding: expect.any(Array),
        match_threshold: 0.5,
        match_count: 3,
        filter_document_ids: ['doc-1', 'doc-2'],
      });

      expect(result).toEqual([
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          content: 'matching content',
          similarity: 0.85,
          chunkIndex: 0,
        },
      ]);
    });

    it('uses default threshold and count when not specified', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1], index: 0 }],
        }),
      });

      await semanticSearch('query');

      expect(mockRpc).toHaveBeenCalledWith('match_documents', {
        query_embedding: expect.any(Array),
        match_threshold: 0.3,
        match_count: 5,
        filter_document_ids: null,
      });
    });

    it('returns empty array on RPC error', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1], index: 0 }],
        }),
      });

      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC function not found' },
      });

      const result = await semanticSearch('query');
      expect(result).toEqual([]);
    });

    it('returns empty when no results match threshold', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1], index: 0 }],
        }),
      });

      mockRpc.mockResolvedValue({ data: [], error: null });

      const result = await semanticSearch('obscure query');
      expect(result).toEqual([]);
    });
  });

  // ── deleteEmbeddings ──

  describe('deleteEmbeddings', () => {
    it('deletes chunks for a document', async () => {
      await deleteEmbeddings('doc-1');

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('document_id', 'doc-1');
    });

    it('does not throw when Supabase is not configured', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      vi.resetModules();
      const { deleteEmbeddings: freshDeleteEmbeddings } = await import('./embeddings');
      await expect(freshDeleteEmbeddings('doc-1')).resolves.toBeUndefined();
    });

    it('does not throw on delete error', async () => {
      const errorBuilder = createQueryBuilder();
      errorBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: null, error: { message: 'Delete failed' } })
      );
      mockQueryBuilder.delete.mockReturnValue(errorBuilder);

      await expect(deleteEmbeddings('doc-1')).resolves.toBeUndefined();
    });
  });

  // ── isSemanticSearchAvailable ──

  describe('isSemanticSearchAvailable', () => {
    it('returns true when all env vars are set', () => {
      expect(isSemanticSearchAvailable()).toBe(true);
    });

    it('returns false when OPENAI_API_KEY is missing', () => {
      delete process.env.OPENAI_API_KEY;
      expect(isSemanticSearchAvailable()).toBe(false);
    });

    it('returns false when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      expect(isSemanticSearchAvailable()).toBe(false);
    });

    it('returns false when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      expect(isSemanticSearchAvailable()).toBe(false);
    });
  });
});
