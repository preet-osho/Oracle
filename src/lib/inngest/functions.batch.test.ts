// ═══════════════════════════════════════
// ORACLE — Batch Quality Review & Memory Extraction Tests
// ═══════════════════════════════════════

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mocks ─────────────────────

const { handlers, mockFrom, mockScoreResponse, mockExtractAndSaveMemories } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => any>,
  mockFrom: vi.fn(),
  mockScoreResponse: vi.fn(),
  mockExtractAndSaveMemories: vi.fn(),
}));

// ─── Mock Inngest client (capture handlers) ──

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    id: 'test',
    name: 'Test',
    createFunction: (opts: Record<string, unknown>, handler: (...args: unknown[]) => unknown) => {
      handlers[String(opts.id)] = handler;
      return handler;
    },
  },
}));

// ─── Mock Supabase client ──────────────

function makeMockChain(result: { data?: unknown; error?: unknown }) {
  const r = { data: result.data ?? null, error: result.error ?? null };
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue(r),
    maybeSingle: vi.fn().mockResolvedValue(r),
    then: (ok: any, fail?: any) => { if (r.error) fail?.(r.error); else ok(r); },
  };
  return chain;
}

const mockSupabaseClient = { from: mockFrom, auth: { getUser: vi.fn() } };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// ─── Mock router ───────────────────────

// NeverStopRouter is imported dynamically inside step.run callbacks but never
// called directly in these tests (scoreResponse is mocked). Provide a minimal stub.
vi.mock('@/lib/router', () => ({
  NeverStopRouter: { callAISyncServer: vi.fn().mockResolvedValue({ text: '', provider: 'test', model: 'test', inputTokens: 0, outputTokens: 0 }) },
}));

// ─── Mock quality scoring ──────────────

mockScoreResponse.mockResolvedValue({
  completeness: 20, specificity: 20, actionability: 20,
  indiaContext: 12, clientReady: 8, total: 80,
  notes: 'Well-structured response', scoredAt: Date.now(),
});

vi.mock('@/lib/quality', () => ({
  scoreResponse: (...a: any[]) => mockScoreResponse(...a),
}));

// ─── Mock memory extraction ────────────

mockExtractAndSaveMemories.mockResolvedValue(undefined);

vi.mock('@/lib/memory', () => ({
  extractAndSaveMemories: (...a: any[]) => mockExtractAndSaveMemories(...a),
}));

// ─── Mock logger ───────────────────────

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// ─── Import after mocks ────────────────

import './functions';

// ─── Helpers ───────────────────────────

function makeStepMock() {
  return {
    run: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
  };
}

function makeEvent(data: Record<string, unknown>) {
  return { data } as any;
}

/** Set up mockFrom to route by table name to different chains. */
function setupTableRoutes(routes: Record<string, { data?: unknown; error?: unknown }>) {
  mockFrom.mockImplementation((table: string) => {
    const route = routes[table];
    if (route) return makeMockChain(route);
    return makeMockChain({ data: [] });
  });
}

// ─── Tests ─────────────────────────────

const origEnv = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

afterEach(() => {
  process.env = { ...origEnv };
});

describe('batchQualityReview', () => {
  const handler = () => handlers['batch-quality-review'];

  beforeEach(() => {
    vi.clearAllMocks();
    mockScoreResponse.mockResolvedValue({
      completeness: 20, specificity: 20, actionability: 20,
      indiaContext: 12, clientReady: 8, total: 80,
      notes: 'Well-structured response', scoredAt: Date.now(),
    });
  });

  it('returns early when no conversations found', async () => {
    setupTableRoutes({ conversations: { data: [] } });
    const step = makeStepMock();

    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.orgId).toBe('org-1');
    expect(result.scored).toBe(0);
  });

  it('filters out already-scored conversations', async () => {
    setupTableRoutes({
      conversations: {
        data: [
          { id: 'c1', title: 'Test convo', messages: [], created_at: Date.now() },
          { id: 'c2', title: 'Another convo', messages: [], created_at: Date.now() },
        ],
      },
      quality_scores: { data: [{ conversation_id: 'c1' }] },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.orgId).toBe('org-1');
    // Both have short titles and empty messages
    expect(result.scored).toBe(0);
  });

  it('extracts last assistant message for scoring', async () => {
    setupTableRoutes({
      conversations: {
        data: [{
          id: 'c1', title: 'Test',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'This is a detailed AI response about SEO strategy for Indian businesses with specific recommendations and action items.' },
          ],
          created_at: Date.now(),
        }],
      },
      quality_scores: { data: [] },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.scored).toBe(1);
    expect(mockScoreResponse).toHaveBeenCalledWith(
      expect.stringContaining('detailed AI response'),
      expect.any(Function)
    );
  });

  it('inserts quality score to database', async () => {
    const insertChain = makeMockChain({ data: { id: 'qs1' } });

    // Route by table name; for quality_scores, use call counter so
    // the first call returns empty (check scored) and second returns insertChain.
    let qualityScoresCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'quality_scores') {
        qualityScoresCallCount++;
        if (qualityScoresCallCount === 2) return insertChain;
        return makeMockChain({ data: [] });
      }
      if (table === 'conversations') {
        return makeMockChain({
          data: [{
            id: 'c1', title: 'Test',
            messages: [{ role: 'assistant', content: 'A'.repeat(60) }],
            created_at: Date.now(),
          }],
        });
      }
      return makeMockChain({ data: [] });
    });

    const step = makeStepMock();
    await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(insertChain.insert).toHaveBeenCalled();
  });

  it('skips when scoreResponse returns null', async () => {
    setupTableRoutes({
      conversations: {
        data: [{
          id: 'c1', title: 'Test',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'A'.repeat(60) },
          ],
          created_at: Date.now(),
        }],
      },
      quality_scores: { data: [] },
    });
    mockScoreResponse.mockResolvedValueOnce(null);

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.scored).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockScoreResponse).toHaveBeenCalledTimes(1);
  });

  it('skips conversations with short response text', async () => {
    setupTableRoutes({
      conversations: {
        data: [{
          id: 'c1', title: 'Short',
          messages: [{ role: 'assistant', content: 'Hi' }],
          created_at: Date.now(),
        }],
      },
      quality_scores: { data: [] },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.scored).toBe(0);
    expect(mockScoreResponse).not.toHaveBeenCalled();
  });

  it('respects maxItems limit', async () => {
    const convos = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`, title: `Convo ${i}`,
      messages: [{ role: 'assistant', content: 'A'.repeat(60) }],
      created_at: Date.now() - i * 1000,
    }));

    setupTableRoutes({
      conversations: { data: convos },
      quality_scores: { data: [] },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 3 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.scored).toBeLessThanOrEqual(3);
  });

  it('handles DB error on conversations query gracefully', async () => {
    setupTableRoutes({
      conversations: { data: null, error: new Error('DB error') },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.orgId).toBe('org-1');
    expect(result.scored).toBe(0);
  });
});

describe('batchMemoryExtraction', () => {
  const handler = () => handlers['batch-memory-extraction'];

  beforeEach(() => {
    vi.clearAllMocks();
    mockExtractAndSaveMemories.mockResolvedValue(undefined);
  });

  it('returns early when no conversations found', async () => {
    setupTableRoutes({ conversations: { data: [] } });
    const step = makeStepMock();

    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.orgId).toBe('org-1');
    expect(result.extracted).toBe(0);
  });

  it('returns early when no client IDs found', async () => {
    setupTableRoutes({
      conversations: {
        data: [{ id: 'c1', title: 'Test', messages: [], client_id: null, created_at: Date.now() }],
      },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.extracted).toBe(0);
    expect(mockExtractAndSaveMemories).not.toHaveBeenCalled();
  });

  it('extracts memories for clients with room', async () => {
    setupTableRoutes({
      conversations: {
        data: [{
          id: 'c1', title: 'Test',
          messages: [
            { role: 'user', content: 'We need SEO help for our Indian restaurant chain' },
            { role: 'assistant', content: 'I recommend a comprehensive SEO strategy focusing on local keywords and Google Business profiles.' },
          ],
          client_id: 'client-1', created_at: Date.now(),
        }],
      },
      memories: { data: [] },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.extracted).toBe(1);
    expect(mockExtractAndSaveMemories).toHaveBeenCalledWith(
      'client-1',
      expect.stringContaining('[user]:')
    );
  });

  it('skips clients with 100+ memories', async () => {
    setupTableRoutes({
      conversations: {
        data: [{
          id: 'c1', title: 'Test',
          messages: [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi there' }],
          client_id: 'client-1', created_at: Date.now(),
        }],
      },
      memories: {
        data: Array.from({ length: 100 }, () => ({ client_id: 'client-1' })),
      },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.extracted).toBe(0);
    expect(mockExtractAndSaveMemories).not.toHaveBeenCalled();
  });

  it('formats transcript with role labels and delimiters', async () => {
    setupTableRoutes({
      conversations: {
        data: [{
          id: 'c1', title: 'Test',
          messages: [
            { role: 'user', content: 'Question about pricing' },
            { role: 'assistant', content: 'Our pricing starts at ₹15,000 per month for basic SEO packages.' },
          ],
          client_id: 'client-1', created_at: Date.now(),
        }],
      },
      memories: { data: [] },
    });

    const step = makeStepMock();
    await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(mockExtractAndSaveMemories).toHaveBeenCalledWith(
      'client-1',
      expect.stringContaining('[user]: Question about pricing')
    );
    expect(mockExtractAndSaveMemories).toHaveBeenCalledWith(
      'client-1',
      expect.stringContaining('---')
    );
  });

  it('falls back to title when transcript is short but title is long', async () => {
    setupTableRoutes({
      conversations: {
        data: [{
          id: 'c1', title: 'This is a detailed conversation about SEO strategy for Indian restaurant chain with specific recommendations',
          messages: [{ role: 'user', content: 'Hi' }],
          client_id: 'client-1', created_at: Date.now(),
        }],
      },
      memories: { data: [] },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    // Transcript ('[user]: Hi') is < 50 chars, falls back to title which is long enough
    expect(result.extracted).toBe(1);
    expect(mockExtractAndSaveMemories).toHaveBeenCalledWith(
      'client-1',
      expect.stringContaining('SEO strategy')
    );
  });

  it('skips clients with short conversation text', async () => {
    setupTableRoutes({
      conversations: {
        data: [{
          id: 'c1', title: 'Hi',
          messages: [{ role: 'user', content: 'Hi' }],
          client_id: 'client-1', created_at: Date.now(),
        }],
      },
      memories: { data: [] },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.extracted).toBe(0);
    expect(mockExtractAndSaveMemories).not.toHaveBeenCalled();
  });

  it('handles multiple clients', async () => {
    setupTableRoutes({
      conversations: {
        data: [
          { id: 'c1', title: 'T1', messages: [{ role: 'assistant', content: 'A'.repeat(60) }], client_id: 'client-1', created_at: Date.now() },
          { id: 'c2', title: 'T2', messages: [{ role: 'assistant', content: 'B'.repeat(60) }], client_id: 'client-2', created_at: Date.now() },
        ],
      },
      memories: { data: [] },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.extracted).toBe(2);
    expect(result.clients).toBe(2);
  });

  it('handles extraction errors gracefully', async () => {
    mockExtractAndSaveMemories.mockRejectedValueOnce(new Error('AI failed'));

    setupTableRoutes({
      conversations: {
        data: [{
          id: 'c1', title: 'Test',
          messages: [{ role: 'assistant', content: 'A'.repeat(60) }],
          client_id: 'client-1', created_at: Date.now(),
        }],
      },
      memories: { data: [] },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.orgId).toBe('org-1');
    expect(result.extracted).toBe(0);
  });

  it('handles DB error on conversations query gracefully', async () => {
    setupTableRoutes({
      conversations: { data: null, error: new Error('DB error') },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.orgId).toBe('org-1');
    expect(result.extracted).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// Pipeline Integration Tests
// Verify the full batch pipeline:
//   queryOrgRecentConversations → filter → score/extract → persist
// ═══════════════════════════════════════════════

describe('Quality Review Pipeline Integration', () => {
  const handler = () => handlers['batch-quality-review'];

  beforeEach(() => {
    vi.clearAllMocks();
    mockScoreResponse.mockResolvedValue({
      completeness: 20, specificity: 20, actionability: 20,
      indiaContext: 12, clientReady: 8, total: 80,
      notes: 'Well-structured response', scoredAt: Date.now(),
    });
  });

  it('full pipeline: query 5 conversations, 2 already scored → score only 3', async () => {
    const now = Date.now();
    const convos = [
      { id: 'c1', title: 'Convo 1', messages: [{ role: 'assistant', content: 'A'.repeat(60) }], created_at: now },
      { id: 'c2', title: 'Convo 2', messages: [{ role: 'assistant', content: 'B'.repeat(60) }], created_at: now - 1000 },
      { id: 'c3', title: 'Convo 3', messages: [{ role: 'assistant', content: 'C'.repeat(60) }], created_at: now - 2000 },
      { id: 'c4', title: 'Convo 4', messages: [{ role: 'assistant', content: 'D'.repeat(60) }], created_at: now - 3000 },
      { id: 'c5', title: 'Convo 5', messages: [{ role: 'assistant', content: 'E'.repeat(60) }], created_at: now - 4000 },
    ];

    // c1 and c4 already scored
    let qualityScoresCallCount = 0;
    const insertChain = makeMockChain({ data: { id: 'qs-new' } });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'conversations') return makeMockChain({ data: convos });
      if (table === 'quality_scores') {
        qualityScoresCallCount++;
        // First call: check which are scored (returns c1, c4)
        if (qualityScoresCallCount === 1) {
          return makeMockChain({ data: [{ conversation_id: 'c1' }, { conversation_id: 'c4' }] });
        }
        // Subsequent calls: inserts for c2, c3, c5
        return insertChain;
      }
      return makeMockChain({ data: [] });
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.scored).toBe(3);
    // scoreResponse called for c2, c3, c5 only
    expect(mockScoreResponse).toHaveBeenCalledTimes(3);
    expect(mockScoreResponse).toHaveBeenCalledWith(
      expect.stringContaining('B'.repeat(60)),
      expect.any(Function),
    );
  });

  it('pipeline verifies Supabase query chain uses correct org_id', async () => {
    const conversationChain = makeMockChain({ data: [] });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'conversations') return conversationChain;
      return makeMockChain({ data: [] });
    });

    const step = makeStepMock();
    await handler()!({
      event: makeEvent({ orgId: 'org-42', maxItems: 5 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    // Verify the query chain was built with the right filters
    expect(conversationChain.select).toHaveBeenCalledWith('id, title, messages, created_at');
    expect(conversationChain.eq).toHaveBeenCalledWith('org_id', 'org-42');
    expect(conversationChain.gte).toHaveBeenCalled();
    expect(conversationChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(conversationChain.limit).toHaveBeenCalledWith(15); // maxItems * 3
  });

  it('pipeline extracts correct last assistant message from multi-turn conversation', async () => {
    const now = Date.now();
    setupTableRoutes({
      conversations: {
        data: [{
          id: 'c1', title: 'SEO Chat',
          messages: [
            { role: 'user', content: 'What about SEO?' },
            { role: 'assistant', content: 'First short reply.' },
            { role: 'user', content: 'Can you elaborate?' },
            { role: 'assistant', content: 'Here is a comprehensive and detailed SEO analysis covering keyword research, on-page optimization, technical SEO audit findings, and content strategy recommendations for the Indian market.' },
          ],
          created_at: now,
        }],
      },
      quality_scores: { data: [] },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.scored).toBe(1);
    // Should score the LAST assistant message, not the first
    expect(mockScoreResponse).toHaveBeenCalledWith(
      expect.stringContaining('comprehensive and detailed SEO analysis'),
      expect.any(Function),
    );
    expect(mockScoreResponse).not.toHaveBeenCalledWith(
      expect.stringContaining('First short reply'),
      expect.any(Function),
    );
  });

  it('pipeline handles mix of eligible and ineligible conversations', async () => {
    const now = Date.now();
    setupTableRoutes({
      conversations: {
        data: [
          // Has long assistant response → eligible
          { id: 'c1', title: 'T1', messages: [{ role: 'assistant', content: 'A'.repeat(60) }], created_at: now },
          // Only short messages → ineligible (< 50 chars)
          { id: 'c2', title: 'Short', messages: [{ role: 'assistant', content: 'Hi' }], created_at: now - 1000 },
          // Has user messages but no assistant → falls back to title, but 'T3' is short → ineligible
          { id: 'c3', title: 'T3', messages: [{ role: 'user', content: 'Help' }], created_at: now - 2000 },
          // Has long assistant response → eligible
          { id: 'c4', title: 'T4', messages: [{ role: 'assistant', content: 'B'.repeat(60) }], created_at: now - 3000 },
        ],
      },
      quality_scores: { data: [] },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.scored).toBe(2); // only c1 and c4
    expect(mockScoreResponse).toHaveBeenCalledTimes(2);
  });

  it('pipeline persists score with conversation_id and total', async () => {
    const now = Date.now();
    const insertChain = makeMockChain({ data: { id: 'qs1' } });
    let qualityScoresCallCount = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'conversations') {
        return makeMockChain({
          data: [{
            id: 'c1', title: 'T',
            messages: [{ role: 'assistant', content: 'A'.repeat(60) }],
            created_at: now,
          }],
        });
      }
      if (table === 'quality_scores') {
        qualityScoresCallCount++;
        if (qualityScoresCallCount === 1) return makeMockChain({ data: [] });
        return insertChain;
      }
      return makeMockChain({ data: [] });
    });

    const step = makeStepMock();
    await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: 'c1',
        total: 80, // from mockScoreResponse
      }),
    );
  });
});

describe('Memory Extraction Pipeline Integration', () => {
  const handler = () => handlers['batch-memory-extraction'];

  beforeEach(() => {
    vi.clearAllMocks();
    mockExtractAndSaveMemories.mockResolvedValue(undefined);
  });

  it('full pipeline: query conversations → dedupe clients → check memory counts → extract', async () => {
    const now = Date.now();
    setupTableRoutes({
      conversations: {
        data: [
          { id: 'c1', title: 'T1', messages: [{ role: 'assistant', content: 'A'.repeat(60) }], client_id: 'client-1', created_at: now },
          { id: 'c2', title: 'T2', messages: [{ role: 'assistant', content: 'B'.repeat(60) }], client_id: 'client-1', created_at: now - 1000 },
          { id: 'c3', title: 'T3', messages: [{ role: 'assistant', content: 'C'.repeat(60) }], client_id: 'client-2', created_at: now - 2000 },
        ],
      },
      // client-1 has 50 memories (under cap), client-2 has 0
      memories: {
        data: Array.from({ length: 50 }, () => ({ client_id: 'client-1' })),
      },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.extracted).toBe(2);
    expect(result.clients).toBe(2);
    // Both clients should have extractAndSaveMemories called
    expect(mockExtractAndSaveMemories).toHaveBeenCalledTimes(2);
    expect(mockExtractAndSaveMemories).toHaveBeenCalledWith('client-1', expect.any(String));
    expect(mockExtractAndSaveMemories).toHaveBeenCalledWith('client-2', expect.any(String));
  });

  it('pipeline deduplicates clients from multiple conversations', async () => {
    const now = Date.now();
    setupTableRoutes({
      conversations: {
        data: [
          { id: 'c1', title: 'T1', messages: [{ role: 'assistant', content: 'A'.repeat(60) }], client_id: 'client-1', created_at: now },
          { id: 'c2', title: 'T2', messages: [{ role: 'assistant', content: 'B'.repeat(60) }], client_id: 'client-1', created_at: now - 1000 },
          { id: 'c3', title: 'T3', messages: [{ role: 'assistant', content: 'C'.repeat(60) }], client_id: 'client-1', created_at: now - 2000 },
        ],
      },
      memories: { data: [] },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    // 3 conversations from 1 client → only 1 extraction
    expect(result.extracted).toBe(1);
    expect(result.clients).toBe(1);
    expect(mockExtractAndSaveMemories).toHaveBeenCalledTimes(1);
  });

  it('pipeline verifies Supabase query chain uses correct org_id', async () => {
    const conversationChain = makeMockChain({ data: [] });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'conversations') return conversationChain;
      return makeMockChain({ data: [] });
    });

    const step = makeStepMock();
    await handler()!({
      event: makeEvent({ orgId: 'org-99', maxItems: 7 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(conversationChain.select).toHaveBeenCalledWith('id, title, messages, client_id, created_at');
    expect(conversationChain.eq).toHaveBeenCalledWith('org_id', 'org-99');
    expect(conversationChain.gte).toHaveBeenCalled();
    expect(conversationChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(conversationChain.limit).toHaveBeenCalledWith(21); // 7 * 3
  });

  it('pipeline checks memory counts and skips at-capacity clients', async () => {
    const now = Date.now();
    setupTableRoutes({
      conversations: {
        data: [
          { id: 'c1', title: 'T1', messages: [{ role: 'assistant', content: 'A'.repeat(60) }], client_id: 'client-full', created_at: now },
          { id: 'c2', title: 'T2', messages: [{ role: 'assistant', content: 'B'.repeat(60) }], client_id: 'client-OK', created_at: now - 1000 },
        ],
      },
      memories: {
        data: [
          // client-full has exactly 100 memories → skipped
          ...Array.from({ length: 100 }, () => ({ client_id: 'client-full' })),
          // client-OK has 10 memories → eligible
          ...Array.from({ length: 10 }, () => ({ client_id: 'client-OK' })),
        ],
      },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.extracted).toBe(1);
    expect(mockExtractAndSaveMemories).toHaveBeenCalledTimes(1);
    expect(mockExtractAndSaveMemories).toHaveBeenCalledWith('client-OK', expect.any(String));
    expect(mockExtractAndSaveMemories).not.toHaveBeenCalledWith('client-full', expect.any(String));
  });

  it('pipeline builds correct transcript from multi-turn conversation', async () => {
    const now = Date.now();
    setupTableRoutes({
      conversations: {
        data: [{
          id: 'c1', title: 'SEO Planning',
          messages: [
            { role: 'user', content: 'We need an SEO audit' },
            { role: 'assistant', content: 'I will conduct a comprehensive SEO audit focusing on technical, on-page, and off-page factors.' },
            { role: 'user', content: 'What about local SEO?' },
            { role: 'assistant', content: 'For local SEO, I recommend optimising Google Business Profile, building local citations, and creating location-specific landing pages for each branch.' },
          ],
          client_id: 'client-1',
          created_at: now,
        }],
      },
      memories: { data: [] },
    });

    const step = makeStepMock();
    await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(mockExtractAndSaveMemories).toHaveBeenCalledTimes(1);
    const transcript = mockExtractAndSaveMemories.mock.calls[0][1] as string;

    // Verify transcript format: role labels and delimiters
    expect(transcript).toContain('[user]: We need an SEO audit');
    expect(transcript).toContain('[assistant]: I will conduct');
    expect(transcript).toContain('[user]: What about local SEO?');
    expect(transcript).toContain('[assistant]: For local SEO');
    expect(transcript).toContain('---');
  });

  it('pipeline falls back to title when all messages are too short', async () => {
    const now = Date.now();
    setupTableRoutes({
      conversations: {
        data: [{
          id: 'c1',
          title: 'Comprehensive discussion about SEO strategy for Indian restaurant chain covering local search optimisation and Google Business Profile',
          messages: [
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello!' },
          ],
          client_id: 'client-1',
          created_at: now,
        }],
      },
      memories: { data: [] },
    });

    const step = makeStepMock();
    await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(mockExtractAndSaveMemories).toHaveBeenCalledTimes(1);
    const transcript = mockExtractAndSaveMemories.mock.calls[0][1] as string;
    // Transcript would be [user]: Hi then [assistant]: Hello! (under 50 chars)
    // Falls back to title
    expect(transcript).toContain('SEO strategy for Indian restaurant chain');
  });

  it('pipeline handles mix of eligible and ineligible clients', async () => {
    const now = Date.now();
    setupTableRoutes({
      conversations: {
        data: [
          // client-eligible: has long messages → eligible
          { id: 'c1', title: 'T1', messages: [{ role: 'assistant', content: 'A'.repeat(60) }], client_id: 'client-eligible', created_at: now },
          // client-noclient: no client_id → skipped
          { id: 'c2', title: 'T2', messages: [{ role: 'assistant', content: 'B'.repeat(60) }], client_id: null, created_at: now - 1000 },
          // client-full: 100 memories → skipped
          { id: 'c3', title: 'T3', messages: [{ role: 'assistant', content: 'C'.repeat(60) }], client_id: 'client-full', created_at: now - 2000 },
          // client-short: short text → skipped
          { id: 'c4', title: 'Hi', messages: [{ role: 'user', content: 'Hi' }], client_id: 'client-short', created_at: now - 3000 },
        ],
      },
      memories: {
        data: Array.from({ length: 100 }, () => ({ client_id: 'client-full' })),
      },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.extracted).toBe(1);
    expect(mockExtractAndSaveMemories).toHaveBeenCalledTimes(1);
    expect(mockExtractAndSaveMemories).toHaveBeenCalledWith('client-eligible', expect.any(String));
  });

  it('pipeline processes clients in order and reports correct counts', async () => {
    const now = Date.now();
    setupTableRoutes({
      conversations: {
        data: [
          { id: 'c1', title: 'T1', messages: [{ role: 'assistant', content: 'A'.repeat(60) }], client_id: 'client-a', created_at: now },
          { id: 'c2', title: 'T2', messages: [{ role: 'assistant', content: 'B'.repeat(60) }], client_id: 'client-b', created_at: now - 1000 },
          { id: 'c3', title: 'T3', messages: [{ role: 'assistant', content: 'C'.repeat(60) }], client_id: 'client-c', created_at: now - 2000 },
        ],
      },
      memories: { data: [] },
    });

    const step = makeStepMock();
    const result = await handler()!({
      event: makeEvent({ orgId: 'org-1', maxItems: 10 }),
      step: step as any,
      stepTool: {} as any,
      ctx: {} as any,
    });

    expect(result.extracted).toBe(3);
    expect(result.clients).toBe(3);
    // Verify each client was processed
    const clientIds = mockExtractAndSaveMemories.mock.calls.map((c: any[]) => c[0]);
    expect(clientIds).toContain('client-a');
    expect(clientIds).toContain('client-b');
    expect(clientIds).toContain('client-c');
  });
});
