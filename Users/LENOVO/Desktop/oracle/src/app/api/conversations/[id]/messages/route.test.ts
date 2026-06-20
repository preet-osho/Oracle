import { vi, describe, it, expect, beforeEach } from 'vitest';
import { castMockResponse, createPostRequest, makeSetupChain } from '../../../test-helpers';

const { from, authMock, validateBodyMock, enforceRateLimitMock } = vi.hoisted(() => ({
  from: vi.fn(),
  authMock: vi.fn(),
  validateBodyMock: vi.fn(),
  enforceRateLimitMock: vi.fn(),
}));
vi.mock('@/lib/supabase/validate', () => ({ validateAuth: (...a: any[]) => authMock(...a) }));
vi.mock('@/lib/validations', () => ({
  validateBody: (...a: any[]) => validateBodyMock(...a),
  AppendMessagesSchema: {},
}));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: (...a: any[]) => enforceRateLimitMock(...a) }));

import { POST } from './route';

const setupChain = makeSetupChain(from, authMock);
const params = { params: Promise.resolve({ id: 'conv-1' }) };

const validMessage = { role: 'user', content: 'Hello world', id: 'msg-1', timestamp: 1000 };
const validBody = { messages: [validMessage] };

describe('POST /api/conversations/[id]/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceRateLimitMock.mockResolvedValue(undefined);
    validateBodyMock.mockReturnValue({ data: validBody });
    setupChain();
  });

  it('appends messages to an existing conversation', async () => {
    const c = setupChain({ data: { id: 'conv-1', messages: [{ role: 'assistant', content: 'Hi' }] } });
    // First single() call returns existing messages, second returns updated result
    c.single
      .mockResolvedValueOnce({ data: { messages: [{ role: 'assistant', content: 'Hi' }] }, error: null })
      .mockResolvedValueOnce({ data: { id: 'conv-1', messages: [{ role: 'assistant', content: 'Hi' }, validMessage] }, error: null });

    const res = castMockResponse(await POST(createPostRequest(validBody) as any, params));
    expect(res.body).toEqual({ id: 'conv-1', messages: [{ role: 'assistant', content: 'Hi' }, validMessage] });
  });

  it('handles empty existing messages array', async () => {
    const c = setupChain({ data: { id: 'conv-1', messages: [] } });
    c.single
      .mockResolvedValueOnce({ data: { messages: [] }, error: null })
      .mockResolvedValueOnce({ data: { id: 'conv-1', messages: [validMessage] }, error: null });

    const res = castMockResponse(await POST(createPostRequest(validBody) as any, params));
    expect(res.body).toEqual({ id: 'conv-1', messages: [validMessage] });
  });

  it('appends multiple messages at once', async () => {
    const messages = [
      { role: 'user', content: 'First', id: 'm1', timestamp: 1 },
      { role: 'assistant', content: 'Second', id: 'm2', timestamp: 2 },
    ];
    validateBodyMock.mockReturnValue({ data: { messages } });
    const c = setupChain({ data: { messages: [] } });
    c.single
      .mockResolvedValueOnce({ data: { messages: [] }, error: null })
      .mockResolvedValueOnce({ data: { id: 'conv-1', messages }, error: null });

    const res = castMockResponse(await POST(createPostRequest({ messages }) as any, params));
    expect(res.body).toEqual({ id: 'conv-1', messages });
  });

  it('sets defaults for missing content and timestamp', async () => {
    const msgNoContent = { role: 'user', id: 'msg-2' };
    validateBodyMock.mockReturnValue({ data: { messages: [msgNoContent] } });
    const c = setupChain({ data: { messages: [] } });
    c.single
      .mockResolvedValueOnce({ data: { messages: [] }, error: null })
      .mockResolvedValueOnce({ data: { id: 'conv-1', messages: [{ ...msgNoContent, content: '', timestamp: expect.any(Number) }] }, error: null });

    const res = castMockResponse(await POST(createPostRequest({ messages: [msgNoContent] }) as any, params));
    expect(res.body).toEqual({ id: 'conv-1', messages: [{ ...msgNoContent, content: '', timestamp: expect.any(Number) }] });
  });

  it('returns 400 when not authenticated', async () => {
    authMock.mockResolvedValue({ error: { body: { error: 'Unauthorized' }, init: { status: 401 } } });
    const res = castMockResponse(await POST(createPostRequest(validBody) as any, params));
    expect(res.init).toEqual({ status: 401 });
  });

  it('returns 400 when no organization', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' }, supabase: from, org: null });
    // Route uses native Response.json() (not NextResponse.json()) for this path,
    // so castMockResponse won't intercept it — read the real Response body instead.
    const res = await POST(createPostRequest(validBody) as any, params) as Response;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'No organization found. Create or join an organization first.' });
  });

  it('returns rate limit response when rate limited', async () => {
    enforceRateLimitMock.mockResolvedValue({ body: { error: 'Rate limited' }, init: { status: 429 } });
    const res = castMockResponse(await POST(createPostRequest(validBody) as any, params));
    expect(res.body).toEqual({ error: 'Rate limited' });
    expect(res.init).toEqual({ status: 429 });
  });

  it('returns 400 on validation failure', async () => {
    validateBodyMock.mockReturnValue({ error: { body: { error: 'Validation failed: messages: Required' }, init: { status: 400 } } });
    const res = castMockResponse(await POST(createPostRequest({ messages: [] }) as any, params));
    expect(res.body).toEqual({ error: 'Validation failed: messages: Required' });
    expect(res.init).toEqual({ status: 400 });
  });

  it('returns 500 when fetch existing messages fails', async () => {
    setupChain({ data: null, error: new Error('DB fetch error') });
    const res = castMockResponse(await POST(createPostRequest(validBody) as any, params));
    expect(res.body).toEqual({ error: 'DB fetch error' });
    expect(res.init).toEqual({ status: 500 });
  });

  it('returns 500 when update fails', async () => {
    const c = setupChain({ data: { messages: [] } });
    c.single
      .mockResolvedValueOnce({ data: { messages: [] }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('Update failed') });
    const res = castMockResponse(await POST(createPostRequest(validBody) as any, params));
    expect(res.body).toEqual({ error: 'Update failed' });
    expect(res.init).toEqual({ status: 500 });
  });
});
