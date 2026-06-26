import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createPostRequest, castMockResponse, makeSetupChain } from '../../../test-helpers';

const { from, authMock } = vi.hoisted(() => ({ from: vi.fn(), authMock: vi.fn() }));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));

const mockEnforceRateLimit = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: (...a: any[]) => mockEnforceRateLimit(...a) }));

const mockIsSemanticSearchAvailable = vi.fn().mockReturnValue(true);
const mockStoreEmbeddings = vi.fn().mockResolvedValue(3);
vi.mock('@/lib/embeddings', () => ({
  isSemanticSearchAvailable: () => mockIsSemanticSearchAvailable(),
  storeEmbeddings: (...a: any[]) => mockStoreEmbeddings(...a),
}));

const mockChunkText = vi.fn().mockReturnValue(['chunk 1', 'chunk 2', 'chunk 3']);
vi.mock('@/lib/rag', () => ({ chunkText: (...a: any[]) => mockChunkText(...a) }));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { POST } from './route';
const setupChain = makeSetupChain(from, authMock);
const params = { params: Promise.resolve({ id: 'doc-1' }) };

describe('Single Knowledge Doc Re-index /api/knowledge-docs/[id]/reindex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(null);
    mockIsSemanticSearchAvailable.mockReturnValue(true);
    mockStoreEmbeddings.mockResolvedValue(3);
    mockChunkText.mockReturnValue(['chunk 1', 'chunk 2', 'chunk 3']);
    setupChain();
  });

  it('re-indexes a document successfully', async () => {
    setupChain({ data: { id: 'doc-1', name: 'Guide.md', content: 'Some content about SEO' } });
    const res = castMockResponse(await POST(createPostRequest({}) as any, params));

    expect(mockStoreEmbeddings).toHaveBeenCalledWith({
      documentId: 'doc-1',
      chunks: ['chunk 1', 'chunk 2', 'chunk 3'],
    });
    expect(res.body).toEqual({
      indexed: true,
      chunks: 3,
      message: 'Re-indexed "Guide.md" (3 chunks)',
    });
  });

  it('returns 401 when not authenticated', async () => {
    authMock.mockResolvedValue({ error: { status: 401, json: async () => ({ error: 'Unauthorized' }) } });
    const res = castMockResponse(await POST(createPostRequest({}) as any, params));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    const rateLimitResponse = { status: 429, json: async () => ({ error: 'Rate limited' }) };
    mockEnforceRateLimit.mockResolvedValue(rateLimitResponse);
    const res = castMockResponse(await POST(createPostRequest({}) as any, params));
    expect(res.status).toBe(429);
  });

  it('returns 400 when semantic search is not configured', async () => {
    mockIsSemanticSearchAvailable.mockReturnValue(false);
    const res = castMockResponse(await POST(createPostRequest({}) as any, params));
    expect(res.init).toEqual({ status: 400 });
    expect(res.body).toEqual({
      error: 'Semantic search not configured. Set OPENAI_API_KEY and Supabase credentials.',
    });
  });

  it('returns 404 when document is not found', async () => {
    setupChain({ data: null, error: { message: 'Row not found' } });
    const res = castMockResponse(await POST(createPostRequest({}) as any, params));
    expect(res.init).toEqual({ status: 404 });
    expect(res.body).toEqual({ error: 'Document not found' });
  });

  it('returns message when document has no content to index', async () => {
    setupChain({ data: { id: 'doc-1', name: 'Empty.md', content: '' } });
    mockChunkText.mockReturnValue([]);
    const res = castMockResponse(await POST(createPostRequest({}) as any, params));
    expect(res.body).toEqual({
      indexed: false,
      chunks: 0,
      message: 'Document has no content to index',
    });
    expect(mockStoreEmbeddings).not.toHaveBeenCalled();
  });

  it('returns message when no embeddings are generated', async () => {
    setupChain({ data: { id: 'doc-1', name: 'Guide.md', content: 'Some content' } });
    mockStoreEmbeddings.mockResolvedValue(0);
    const res = castMockResponse(await POST(createPostRequest({}) as any, params));
    expect(res.body).toEqual({
      indexed: false,
      chunks: 0,
      message: 'No embeddings generated for "Guide.md"',
    });
  });

  it('returns 500 when storeEmbeddings throws', async () => {
    setupChain({ data: { id: 'doc-1', name: 'Guide.md', content: 'Content' } });
    mockStoreEmbeddings.mockRejectedValue(new Error('API down'));
    const res = castMockResponse(await POST(createPostRequest({}) as any, params));
    expect(res.init).toEqual({ status: 500 });
    expect(res.body).toEqual({ error: 'Failed to re-index "Guide.md"' });
  });
});
