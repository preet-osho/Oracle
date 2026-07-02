import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  projectsApi,
  timeEntriesApi,
  invoicesApi,
  memoriesApi,
  knowledgeDocsApi,
  proposalsApi,
  customPromptsApi,
  favouritesApi,
  conversationsApi,
} from './api';

// ─── Helpers ───────────────────────────

function mockFetchOk(data: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockFetchFail(status: number, error?: string) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(error ? { error } : {}),
  });
}

function lastFetchArgs() {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
}

// ─── Tests ─────────────────────────────

describe('apiFetch (via API methods)', () => {
  it('passes an AbortSignal to fetch (via fetchWithTimeout)', async () => {
    mockFetchOk([]);
    await projectsApi.list();
    const [, opts] = lastFetchArgs();
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws on non-ok response with error body', async () => {
    mockFetchFail(404, 'Not found');
    await expect(projectsApi.get('123')).rejects.toThrow('Not found');
  });

  it('throws on non-ok response with status text fallback', async () => {
    mockFetchFail(500);
    await expect(projectsApi.list()).rejects.toThrow('API error: 500');
  });

  // ── Projects ──

  describe('projectsApi', () => {
    it('list calls GET /api/projects', async () => {
      mockFetchOk([]);
      const result = await projectsApi.list();
      expect(result).toEqual([]);
      const [url, opts] = lastFetchArgs();
      expect(url).toBe('/api/projects');
      expect(opts.method).toBeUndefined();
    });

    it('get calls GET /api/projects/:id', async () => {
      mockFetchOk({ id: 'p1' });
      const result = await projectsApi.get('p1');
      expect(result.id).toBe('p1');
      expect(lastFetchArgs()[0]).toBe('/api/projects/p1');
    });

    it('create calls POST with JSON body', async () => {
      mockFetchOk({ id: 'new' });
      const data = { client_name: 'Test', industry: 'SEO' } as never;
      await projectsApi.create(data);
      const [url, opts] = lastFetchArgs();
      expect(url).toBe('/api/projects');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body as string)).toEqual(data);
    });

    it('update calls PUT with JSON body', async () => {
      mockFetchOk({ id: 'p1' });
      await projectsApi.update('p1', { status: 'Active' });
      const [url, opts] = lastFetchArgs();
      expect(url).toBe('/api/projects/p1');
      expect(opts.method).toBe('PUT');
    });

    it('delete calls DELETE', async () => {
      mockFetchOk({ success: true });
      await projectsApi.delete('p1');
      const [url, opts] = lastFetchArgs();
      expect(url).toBe('/api/projects/p1');
      expect(opts.method).toBe('DELETE');
    });
  });

  // ── Time Entries ──

  describe('timeEntriesApi', () => {
    it('list without clientId calls GET /api/time-entries', async () => {
      mockFetchOk([]);
      await timeEntriesApi.list();
      expect(lastFetchArgs()[0]).toBe('/api/time-entries');
    });

    it('list with clientId appends query param', async () => {
      mockFetchOk([]);
      await timeEntriesApi.list('c1');
      expect(lastFetchArgs()[0]).toBe('/api/time-entries?client_id=c1');
    });

    it('create calls POST', async () => {
      mockFetchOk({ id: 't1' });
      const data = { client_id: 'c1', description: 'Work', hours: 2, rate: 100, date: 1, billable: true } as never;
      await timeEntriesApi.create(data);
      expect(lastFetchArgs()[1].method).toBe('POST');
    });

    it('delete calls DELETE', async () => {
      mockFetchOk({ success: true });
      await timeEntriesApi.delete('t1');
      expect(lastFetchArgs()[1].method).toBe('DELETE');
    });
  });

  // ── Invoices ──

  describe('invoicesApi', () => {
    it('list without clientId calls GET /api/invoices', async () => {
      mockFetchOk([]);
      await invoicesApi.list();
      expect(lastFetchArgs()[0]).toBe('/api/invoices');
    });

    it('list with clientId appends query param', async () => {
      mockFetchOk([]);
      await invoicesApi.list('c1');
      expect(lastFetchArgs()[0]).toBe('/api/invoices?client_id=c1');
    });

    it('create calls POST', async () => {
      mockFetchOk({ id: 'inv1' });
      await invoicesApi.create({} as never);
      expect(lastFetchArgs()[1].method).toBe('POST');
    });
  });

  // ── Memories ──

  describe('memoriesApi', () => {
    it('list calls GET with client_id query', async () => {
      mockFetchOk([]);
      await memoriesApi.list('c1');
      expect(lastFetchArgs()[0]).toBe('/api/memories?client_id=c1');
    });

    it('create calls POST', async () => {
      mockFetchOk({ id: 'm1' });
      await memoriesApi.create({ client_id: 'c1', content: 'test', category: 'fact', importance: 2 } as never);
      expect(lastFetchArgs()[1].method).toBe('POST');
    });

    it('delete calls DELETE', async () => {
      mockFetchOk({ success: true });
      await memoriesApi.delete('m1');
      expect(lastFetchArgs()[0]).toBe('/api/memories/m1');
      expect(lastFetchArgs()[1].method).toBe('DELETE');
    });

    it('getAllClientIds calls GET with all_clients param', async () => {
      mockFetchOk(['c1', 'c2']);
      const result = await memoriesApi.getAllClientIds();
      expect(lastFetchArgs()[0]).toBe('/api/memories?all_clients=true');
      expect(result).toEqual(['c1', 'c2']);
    });
  });

  // ── Knowledge Docs ──

  describe('knowledgeDocsApi', () => {
    it('list calls GET /api/knowledge-docs', async () => {
      mockFetchOk([]);
      await knowledgeDocsApi.list();
      expect(lastFetchArgs()[0]).toBe('/api/knowledge-docs');
    });

    it('create calls POST with name and content', async () => {
      mockFetchOk({ id: 'd1' });
      await knowledgeDocsApi.create({ name: 'doc', content: 'body' });
      const body = JSON.parse(lastFetchArgs()[1].body as string);
      expect(body).toEqual({ name: 'doc', content: 'body' });
    });

    it('delete calls DELETE', async () => {
      mockFetchOk({ success: true });
      await knowledgeDocsApi.delete('d1');
      expect(lastFetchArgs()[1].method).toBe('DELETE');
    });
  });

  // ── Proposals ──

  describe('proposalsApi', () => {
    it('list calls GET /api/proposals', async () => {
      mockFetchOk([]);
      await proposalsApi.list();
      expect(lastFetchArgs()[0]).toBe('/api/proposals');
    });

    it('create calls POST', async () => {
      mockFetchOk({ id: 'p1' });
      await proposalsApi.create({ brief: 'brief', domain: 'SEO', output: 'output' });
      expect(lastFetchArgs()[1].method).toBe('POST');
    });
  });

  // ── Custom Prompts ──

  describe('customPromptsApi', () => {
    it('list calls GET /api/prompts', async () => {
      mockFetchOk([]);
      await customPromptsApi.list();
      expect(lastFetchArgs()[0]).toBe('/api/prompts');
    });

    it('create calls POST', async () => {
      mockFetchOk({ id: 'cp1' });
      await customPromptsApi.create({ id: '', title: 't', category: 'c', domain: 'd', difficulty: 'Easy', time_estimate: '5m', tools: [], description: 'd', prompt: 'p' } as never);
      expect(lastFetchArgs()[1].method).toBe('POST');
    });
  });

  // ── Favourites ──

  describe('favouritesApi', () => {
    it('list calls GET /api/favourites', async () => {
      mockFetchOk([]);
      await favouritesApi.list();
      expect(lastFetchArgs()[0]).toBe('/api/favourites');
    });

    it('add calls POST with prompt_id', async () => {
      mockFetchOk({ id: 'f1' });
      await favouritesApi.add('prompt-123');
      const body = JSON.parse(lastFetchArgs()[1].body as string);
      expect(body.prompt_id).toBe('prompt-123');
    });

    it('remove calls DELETE with prompt id', async () => {
      mockFetchOk({ success: true });
      await favouritesApi.remove('prompt-123');
      expect(lastFetchArgs()[0]).toBe('/api/favourites/prompt-123');
      expect(lastFetchArgs()[1].method).toBe('DELETE');
    });
  });

  // ── Conversations ──

  describe('conversationsApi', () => {
    it('list calls GET /api/conversations', async () => {
      mockFetchOk([]);
      await conversationsApi.list();
      expect(lastFetchArgs()[0]).toBe('/api/conversations');
    });

    it('get calls GET /api/conversations/:id', async () => {
      mockFetchOk({ id: 'conv1' });
      await conversationsApi.get('conv1');
      expect(lastFetchArgs()[0]).toBe('/api/conversations/conv1');
    });

    it('create calls POST', async () => {
      mockFetchOk({ id: 'conv1' });
      await conversationsApi.create({ title: 'Test' });
      expect(lastFetchArgs()[1].method).toBe('POST');
    });

    it('update calls PUT', async () => {
      mockFetchOk({ id: 'conv1' });
      await conversationsApi.update('conv1', { title: 'Updated' });
      expect(lastFetchArgs()[1].method).toBe('PUT');
    });

    it('delete calls DELETE', async () => {
      mockFetchOk({ success: true });
      await conversationsApi.delete('conv1');
      expect(lastFetchArgs()[1].method).toBe('DELETE');
    });
  });
});
