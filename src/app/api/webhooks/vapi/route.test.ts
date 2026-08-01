import { vi, describe, it, expect, beforeEach } from 'vitest';


// ─── Mocks ─────────────────────────────

const mockSupabaseFrom = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseEq = vi.fn();
const mockSupabaseSingle = vi.fn();
const mockSupabaseInsert = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
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

import { POST } from './route';

// ─── Helper: create VAPI webhook request ─────────

function createVapiRequest(body: unknown, headers?: Record<string, string>) {
  return {
    url: 'http://localhost/api/webhooks/vapi',
    json: async () => body,
    headers: {
      get: (name: string) => headers?.[name.toLowerCase()] || null,
    },
  } as any;
}

function setupSupabaseChain(result: { data?: unknown; error?: unknown }) {
  mockSupabaseSingle.mockResolvedValue(result);
  mockSupabaseEq.mockReturnValue({ single: mockSupabaseSingle });
  mockSupabaseSelect.mockReturnValue({ eq: mockSupabaseEq });
  mockSupabaseFrom.mockReturnValue({ select: mockSupabaseSelect, insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSupabaseSingle }) }) });
}

// ─── Tests ─────────────────────────────

describe('VAPI Webhook /api/webhooks/vapi', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.VAPI_WEBHOOK_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    setupSupabaseChain({ data: null });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── Authentication ──
  describe('authentication', () => {
    it('rejects request with invalid secret', async () => {
      const req = createVapiRequest(
        { message: { type: 'status-update', call: { id: 'c1', status: 'ringing', createdAt: new Date().toISOString() } } },
        { authorization: 'Bearer wrong-secret' }
      );
      const res = await POST(req);
      // Auth runs first; if secret is set and token is wrong, 401
      expect(res.status).toBe(401);
    });

    it('accepts request with valid secret', async () => {
      const req = createVapiRequest(
        { message: { type: 'status-update', call: { id: 'c1', status: 'ringing', createdAt: new Date().toISOString() } } },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it('skips auth when VAPI_WEBHOOK_SECRET is not set', async () => {
      delete process.env.VAPI_WEBHOOK_SECRET;
      const req = createVapiRequest(
        { message: { type: 'status-update', call: { id: 'c1', status: 'ringing', createdAt: new Date().toISOString() } } }
      );
      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  // ── Payload Validation ──
  describe('payload validation', () => {
    it('rejects invalid JSON body', async () => {
      const req = { url: 'http://localhost/api/webhooks/vapi', json: async () => { throw new Error('Invalid JSON'); }, headers: { get: (name: string) => name === 'authorization' ? 'Bearer test-secret' : null } } as any;
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('rejects payload missing message type', async () => {
      const req = createVapiRequest(
        { message: { call: { id: 'c1', status: 'ringing', createdAt: new Date().toISOString() } } },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('rejects payload missing call object', async () => {
      const req = createVapiRequest(
        { message: { type: 'status-update' } },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  // ── Status Update ──
  describe('status-update', () => {
    it('acknowledges status update events', async () => {
      const req = createVapiRequest(
        { message: { type: 'status-update', call: { id: 'c1', status: 'in-progress', createdAt: new Date().toISOString() } } },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  // ── Transcript ──
  describe('transcript', () => {
    it('acknowledges transcript events', async () => {
      const req = createVapiRequest(
        { message: { type: 'transcript', call: { id: 'c1', status: 'in-progress', createdAt: new Date().toISOString() }, transcript: { role: 'user', transcript: 'Hello', timestamp: Date.now() } } },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  // ── Tool Calls ──
  describe('tool-calls', () => {
    it('executes checkOrderStatus tool', async () => {
      const req = createVapiRequest(
        {
          message: {
            type: 'tool-calls',
            call: { id: 'c1', status: 'in-progress', createdAt: new Date().toISOString() },
            toolWithToolCallList: [
              { name: 'checkOrderStatus', toolCall: { id: 'tc1', parameters: { orderId: 'ORD-123' } } },
            ],
          },
        },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      const body = await res.json();
      expect(body.results).toHaveLength(1);
      expect(body.results[0].name).toBe('checkOrderStatus');
      expect(body.results[0].toolCallId).toBe('tc1');
      const result = JSON.parse(body.results[0].result);
      expect(result.status).toBe('delivered');
    });

    it('executes collectFeedback tool', async () => {
      const req = createVapiRequest(
        {
          message: {
            type: 'tool-calls',
            call: { id: 'c1', status: 'in-progress', createdAt: new Date().toISOString() },
            toolWithToolCallList: [
              { name: 'collectFeedback', toolCall: { id: 'tc2', parameters: { rating: '5' } } },
            ],
          },
        },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      const body = await res.json();
      const result = JSON.parse(body.results[0].result);
      expect(result.collected).toBe(true);
      expect(result.rating).toBe('5');
    });

    it('executes sendWhatsApp tool', async () => {
      const req = createVapiRequest(
        {
          message: {
            type: 'tool-calls',
            call: { id: 'c1', status: 'in-progress', createdAt: new Date().toISOString() },
            toolWithToolCallList: [
              { name: 'sendWhatsApp', toolCall: { id: 'tc3', parameters: { to: '+919876543210', message: 'Hello' } } },
            ],
          },
        },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      const body = await res.json();
      const result = JSON.parse(body.results[0].result);
      expect(result.sent).toBe(true);
      expect(result.to).toBe('+919876543210');
    });

    it('executes bookAppointment tool', async () => {
      const req = createVapiRequest(
        {
          message: {
            type: 'tool-calls',
            call: { id: 'c1', status: 'in-progress', createdAt: new Date().toISOString() },
            toolWithToolCallList: [
              { name: 'bookAppointment', toolCall: { id: 'tc4', parameters: { date: '2026-08-15', time: '10:00' } } },
            ],
          },
        },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      const body = await res.json();
      const result = JSON.parse(body.results[0].result);
      expect(result.booked).toBe(true);
      expect(result.date).toBe('2026-08-15');
    });

    it('executes transferToHuman tool', async () => {
      const req = createVapiRequest(
        {
          message: {
            type: 'tool-calls',
            call: { id: 'c1', status: 'in-progress', createdAt: new Date().toISOString() },
            toolWithToolCallList: [
              { name: 'transferToHuman', toolCall: { id: 'tc5', parameters: { reason: 'Complex query' } } },
            ],
          },
        },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      const body = await res.json();
      const result = JSON.parse(body.results[0].result);
      expect(result.transferred).toBe(true);
      expect(result.reason).toBe('Complex query');
    });

    it('handles unknown tools gracefully', async () => {
      const req = createVapiRequest(
        {
          message: {
            type: 'tool-calls',
            call: { id: 'c1', status: 'in-progress', createdAt: new Date().toISOString() },
            toolWithToolCallList: [
              { name: 'unknownTool', toolCall: { id: 'tc6', parameters: {} } },
            ],
          },
        },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      const body = await res.json();
      const result = JSON.parse(body.results[0].result);
      expect(result.status).toBe('unknown_tool');
      expect(result.tool).toBe('unknownTool');
    });

    it('returns empty results for empty tool list', async () => {
      const req = createVapiRequest(
        {
          message: {
            type: 'tool-calls',
            call: { id: 'c1', status: 'in-progress', createdAt: new Date().toISOString() },
            toolWithToolCallList: [],
          },
        },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      const body = await res.json();
      expect(body.results).toEqual([]);
    });
  });

  // ── Assistant Request ──
  describe('assistant-request', () => {
    it('returns default assistant ID when env is set', async () => {
      process.env.VAPI_DEFAULT_ASSISTANT_ID = 'default-asst-123';
      const req = createVapiRequest(
        { message: { type: 'assistant-request', call: { id: 'c1', status: 'ringing', createdAt: new Date().toISOString() } } },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      const body = await res.json();
      expect(body.assistantId).toBe('default-asst-123');
    });

    it('returns 404 when no default assistant configured', async () => {
      delete process.env.VAPI_DEFAULT_ASSISTANT_ID;
      const req = createVapiRequest(
        { message: { type: 'assistant-request', call: { id: 'c1', status: 'ringing', createdAt: new Date().toISOString() } } },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      expect(res.status).toBe(404);
    });
  });

  // ── End of Call Report ──
  describe('end-of-call-report', () => {
    it('acknowledges end-of-call events', async () => {
      const req = createVapiRequest(
        {
          message: {
            type: 'end-of-call-report',
            call: { id: 'c1', status: 'ended', duration: 120, createdAt: new Date().toISOString() },
            endedReason: 'hangup',
            artifact: { transcript: 'Hello, thank you for calling.' },
          },
        },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  // ── Unknown Event Types ──
  describe('unknown event types', () => {
    it('acknowledges unknown event types', async () => {
      const req = createVapiRequest(
        { message: { type: 'speech-update', call: { id: 'c1', status: 'in-progress', createdAt: new Date().toISOString() } } },
        { authorization: 'Bearer test-secret' }
      );
      const res = await POST(req);
      const body = await res.json();
      expect(body.received).toBe(true);
      expect(body.type).toBe('speech-update');
    });
  });
});
