// ═══════════════════════════════════════
// Tests for POST /api/webhooks (Resend, Twilio, Test)
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { vi as vitestVi } from 'vitest';

// ─── Hoisted mock references ────────────

const { mockStoreDeliveryEvent, mockVerify, mockValidateAuth, mockGetDeliveryEvents, mockGetDeliveryStats, mockValidateRequest } = vitestVi.hoisted(() => ({
  mockStoreDeliveryEvent: vi.fn().mockImplementation((event: Record<string, unknown>) => ({
    id: 'evt-test-123',
    receivedAt: Date.now(),
    ...event,
  })),
  mockVerify: vi.fn(),
  mockValidateAuth: vi.fn(),
  mockGetDeliveryEvents: vi.fn().mockReturnValue([]),
  mockGetDeliveryStats: vi.fn().mockReturnValue({
    totalEvents: 0,
    emailEvents: 0,
    whatsappEvents: 0,
    byType: {},
    byStatus: { delivered: 0, failed: 0, pending: 0, opened: 0, clicked: 0 },
    recentEvents: [],
  }),
  mockValidateRequest: vi.fn().mockReturnValue(true),
}));

// ─── Module Mocks ──────────────────────

vi.mock('@/lib/delivery-events', () => ({
  storeDeliveryEvent: (...args: unknown[]) => mockStoreDeliveryEvent(...args),
  getDeliveryEvents: (...args: unknown[]) => mockGetDeliveryEvents(...args),
  getDeliveryStats: (...args: unknown[]) => mockGetDeliveryStats(...args),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(function () {
    return { verify: mockVerify };
  }),
}));

vi.mock('twilio', () => ({
  default: {
    validateRequest: mockValidateRequest,
  },
}));

vi.mock('@/lib/supabase/validate', () => ({
  validateAuth: (...args: unknown[]) => mockValidateAuth(...args),
}));

// ─── Helper: Create Mock Request ────────

function createMockRequest(options: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  contentType?: string;
}): NextRequest {
  const url = options.url || 'http://localhost:3000/api/webhooks/resend';
  const headers = new Headers();

  if (options.contentType) {
    headers.set('Content-Type', options.contentType);
  }

  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  return new NextRequest(url, {
    method: options.method || 'POST',
    headers,
    body: options.body,
  });
}

// ═══════════════════════════════════════
// Resend Webhook Tests
// ═══════════════════════════════════════

describe('POST /api/webhooks/resend', () => {
  beforeEach(() => {
    mockStoreDeliveryEvent.mockClear();
    mockVerify.mockReset();
    process.env.RESEND_WEBHOOK_SECRET = 'test-webhook-secret';
  });

  afterEach(() => {
    delete process.env.RESEND_WEBHOOK_SECRET;
  });

  it('rejects request without Svix headers', async () => {
    const { POST } = await import('./resend/route');
    const request = createMockRequest({
      body: JSON.stringify({ type: 'email.delivered' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing webhook headers');
  });

  it('rejects request when webhook secret not configured', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;

    const { POST } = await import('./resend/route');
    const request = createMockRequest({
      headers: {
        'svix-id': 'msg_test123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,test-signature',
      },
      body: JSON.stringify({ type: 'email.delivered' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Webhook secret not configured');
  });

  it('rejects request with invalid signature', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const { POST } = await import('./resend/route');
    const request = createMockRequest({
      headers: {
        'svix-id': 'msg_test123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,invalid-signature',
      },
      body: JSON.stringify({ type: 'email.delivered' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid signature');
  });

  it('processes email.delivered event successfully', async () => {
    const mockEvent = {
      type: 'email.delivered',
      created_at: '2024-01-15T10:30:00Z',
      data: {
        email_id: 'msg_abc123',
        from: 'oracle@example.com',
        to: ['user@example.com'],
        subject: 'Test Email',
        tags: { campaign: 'welcome' },
        created_at: '2024-01-15T10:30:00Z',
      },
    };
    mockVerify.mockImplementation(() => mockEvent);

    const { POST } = await import('./resend/route');
    const request = createMockRequest({
      headers: {
        'svix-id': 'msg_test123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,valid-signature',
      },
      body: JSON.stringify(mockEvent),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.eventType).toBe('email.delivered');
    expect(data.eventId).toBe('evt-test-123');

    expect(mockStoreDeliveryEvent).toHaveBeenCalledWith({
      provider: 'resend',
      channel: 'email',
      eventType: 'email.delivered',
      messageId: 'msg_abc123',
      recipient: 'user@example.com',
      sender: 'oracle@example.com',
      subject: 'Test Email',
      errorCode: undefined,
      errorMessage: undefined,
      metadata: {
        svixId: 'msg_test123',
        tags: { campaign: 'welcome' },
        bounce: undefined,
        click: undefined,
        createdAt: '2024-01-15T10:30:00Z',
      },
    });
  });

  it('processes email.bounced event with bounce data', async () => {
    const mockEvent = {
      type: 'email.bounced',
      created_at: '2024-01-15T10:30:00Z',
      data: {
        email_id: 'msg_bounce123',
        from: 'oracle@example.com',
        to: ['invalid@example.com'],
        bounce: {
          type: 'hard',
          subType: 'invalid-email',
          message: 'Email address does not exist',
        },
        created_at: '2024-01-15T10:30:00Z',
      },
    };
    mockVerify.mockImplementation(() => mockEvent);

    const { POST } = await import('./resend/route');
    const request = createMockRequest({
      headers: {
        'svix-id': 'msg_test123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,valid-signature',
      },
      body: JSON.stringify(mockEvent),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.eventType).toBe('email.bounced');

    expect(mockStoreDeliveryEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'hard',
        errorMessage: 'Email address does not exist',
      }),
    );
  });

  it('processes email.clicked event with click data', async () => {
    const mockEvent = {
      type: 'email.clicked',
      created_at: '2024-01-15T10:30:00Z',
      data: {
        email_id: 'msg_click123',
        from: 'oracle@example.com',
        to: ['user@example.com'],
        click: {
          url: 'https://example.com/landing',
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
        created_at: '2024-01-15T10:30:00Z',
      },
    };
    mockVerify.mockImplementation(() => mockEvent);

    const { POST } = await import('./resend/route');
    const request = createMockRequest({
      headers: {
        'svix-id': 'msg_test123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,valid-signature',
      },
      body: JSON.stringify(mockEvent),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.eventType).toBe('email.clicked');

    expect(mockStoreDeliveryEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: 'https://example.com/landing',
      }),
    );
  });

  it('skips unknown event types', async () => {
    const mockEvent = {
      type: 'email.unknown_type',
      created_at: '2024-01-15T10:30:00Z',
      data: {
        email_id: 'msg_unknown123',
        from: 'oracle@example.com',
        to: ['user@example.com'],
        created_at: '2024-01-15T10:30:00Z',
      },
    };
    mockVerify.mockImplementation(() => mockEvent);

    const { POST } = await import('./resend/route');
    const request = createMockRequest({
      headers: {
        'svix-id': 'msg_test123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,valid-signature',
      },
      body: JSON.stringify(mockEvent),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.skipped).toBe(true);
    expect(data.type).toBe('email.unknown_type');
    expect(mockStoreDeliveryEvent).not.toHaveBeenCalled();
  });

  it('processes all valid email event types', async () => {
    const validTypes = [
      'email.sent',
      'email.delivered',
      'email.opened',
      'email.clicked',
      'email.bounced',
      'email.complained',
      'email.failed',
      'email.delivery_delayed',
      'email.received',
      'email.scheduled',
      'email.suppressed',
    ];

    for (const eventType of validTypes) {
      mockStoreDeliveryEvent.mockClear();
      mockVerify.mockImplementation(() => ({
        type: eventType,
        created_at: '2024-01-15T10:30:00Z',
        data: {
          email_id: `msg_${eventType}`,
          from: 'oracle@example.com',
          to: ['user@example.com'],
          created_at: '2024-01-15T10:30:00Z',
        },
      }));

      const { POST } = await import('./resend/route');
      const request = createMockRequest({
        headers: {
          'svix-id': 'msg_test123',
          'svix-timestamp': '1234567890',
          'svix-signature': 'v1,valid-signature',
        },
        body: JSON.stringify({ type: eventType }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.received).toBe(true);
      expect(data.eventType).toBe(eventType);
      expect(mockStoreDeliveryEvent).toHaveBeenCalledTimes(1);
    }
  });
});

// ═══════════════════════════════════════
// Twilio Webhook Tests
// ═══════════════════════════════════════

describe('POST /api/webhooks/twilio', () => {
  beforeEach(() => {
    mockStoreDeliveryEvent.mockClear();
    mockValidateRequest.mockReset();
    mockValidateRequest.mockReturnValue(true);
    process.env.TWILIO_AUTH_TOKEN = 'test-twilio-auth-token';
  });

  afterEach(() => {
    delete process.env.TWILIO_AUTH_TOKEN;
  });

  it('processes delivered status successfully', async () => {
    const { POST } = await import('./twilio/route');
    const body = new URLSearchParams({
      MessageSid: 'SM1234567890',
      MessageStatus: 'delivered',
      To: 'whatsapp:+919876543210',
      From: 'whatsapp:+911234567890',
    }).toString();

    const request = createMockRequest({
      url: 'http://localhost:3000/api/webhooks/twilio',
      headers: { 'x-twilio-signature': 'valid-signature' },
      body,
      contentType: 'application/x-www-form-urlencoded',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.eventType).toBe('whatsapp.delivered');

    expect(mockStoreDeliveryEvent).toHaveBeenCalledWith({
      provider: 'twilio',
      channel: 'whatsapp',
      eventType: 'whatsapp.delivered',
      messageId: 'SM1234567890',
      recipient: '+919876543210',
      sender: '+911234567890',
      errorCode: undefined,
      errorMessage: undefined,
      metadata: {
        messageSid: 'SM1234567890',
        smsMessageSid: undefined,
        numMedia: undefined,
        numSegments: undefined,
      },
    });
  });

  it('processes failed status with error code', async () => {
    const { POST } = await import('./twilio/route');
    const body = new URLSearchParams({
      MessageSid: 'SM_FAILED_123',
      MessageStatus: 'failed',
      To: 'whatsapp:+919876543210',
      From: 'whatsapp:+911234567890',
      ErrorCode: '30006',
      ErrorMessage: 'Landline or unreachable mobile number',
    }).toString();

    const request = createMockRequest({
      url: 'http://localhost:3000/api/webhooks/twilio',
      headers: { 'x-twilio-signature': 'valid-signature' },
      body,
      contentType: 'application/x-www-form-urlencoded',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.eventType).toBe('whatsapp.failed');

    expect(mockStoreDeliveryEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: '30006',
        errorMessage: 'Landline or unreachable mobile number',
      }),
    );
  });

  it('processes all valid WhatsApp statuses', async () => {
    const validStatuses = [
      { twilio: 'queued', expected: 'whatsapp.queued' },
      { twilio: 'sent', expected: 'whatsapp.sent' },
      { twilio: 'delivered', expected: 'whatsapp.delivered' },
      { twilio: 'read', expected: 'whatsapp.read' },
      { twilio: 'failed', expected: 'whatsapp.failed' },
      { twilio: 'undelivered', expected: 'whatsapp.undelivered' },
    ];

    for (const { twilio: twilioStatus, expected } of validStatuses) {
      mockStoreDeliveryEvent.mockClear();

      const { POST } = await import('./twilio/route');
      const body = new URLSearchParams({
        MessageSid: `SM_${twilioStatus}`,
        MessageStatus: twilioStatus,
        To: 'whatsapp:+919876543210',
        From: 'whatsapp:+911234567890',
      }).toString();

      const request = createMockRequest({
        url: 'http://localhost:3000/api/webhooks/twilio',
        headers: { 'x-twilio-signature': 'valid-signature' },
        body,
        contentType: 'application/x-www-form-urlencoded',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.received).toBe(true);
      expect(data.eventType).toBe(expected);
      expect(mockStoreDeliveryEvent).toHaveBeenCalledTimes(1);
    }
  });

  it('rejects request with invalid signature when auth token configured', async () => {
    mockValidateRequest.mockReturnValue(false);

    const { POST } = await import('./twilio/route');
    const body = new URLSearchParams({
      MessageSid: 'SM1234567890',
      MessageStatus: 'delivered',
      To: 'whatsapp:+919876543210',
      From: 'whatsapp:+911234567890',
    }).toString();

    const request = createMockRequest({
      url: 'http://localhost:3000/api/webhooks/twilio',
      headers: { 'x-twilio-signature': 'invalid-signature' },
      body,
      contentType: 'application/x-www-form-urlencoded',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid signature');
  });

  it('handles twilio.validateRequest throwing an error', async () => {
    mockValidateRequest.mockImplementation(() => {
      throw new Error('Validation error');
    });

    const { POST } = await import('./twilio/route');
    const body = new URLSearchParams({
      MessageSid: 'SM1234567890',
      MessageStatus: 'delivered',
      To: 'whatsapp:+919876543210',
      From: 'whatsapp:+911234567890',
    }).toString();

    const request = createMockRequest({
      url: 'http://localhost:3000/api/webhooks/twilio',
      headers: { 'x-twilio-signature': 'invalid-signature' },
      body,
      contentType: 'application/x-www-form-urlencoded',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Signature validation failed');
  });

  it('skips signature validation when auth token not configured', async () => {
    delete process.env.TWILIO_AUTH_TOKEN;

    const { POST } = await import('./twilio/route');
    const body = new URLSearchParams({
      MessageSid: 'SM1234567890',
      MessageStatus: 'delivered',
      To: 'whatsapp:+919876543210',
      From: 'whatsapp:+911234567890',
    }).toString();

    const request = createMockRequest({
      url: 'http://localhost:3000/api/webhooks/twilio',
      body,
      contentType: 'application/x-www-form-urlencoded',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it('rejects request without MessageSid', async () => {
    const { POST } = await import('./twilio/route');
    const body = new URLSearchParams({
      MessageStatus: 'delivered',
      To: 'whatsapp:+919876543210',
      From: 'whatsapp:+911234567890',
    }).toString();

    const request = createMockRequest({
      url: 'http://localhost:3000/api/webhooks/twilio',
      headers: { 'x-twilio-signature': 'valid-signature' },
      body,
      contentType: 'application/x-www-form-urlencoded',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required fields');
  });

  it('rejects request without MessageStatus', async () => {
    const { POST } = await import('./twilio/route');
    const body = new URLSearchParams({
      MessageSid: 'SM1234567890',
      To: 'whatsapp:+919876543210',
      From: 'whatsapp:+911234567890',
    }).toString();

    const request = createMockRequest({
      url: 'http://localhost:3000/api/webhooks/twilio',
      headers: { 'x-twilio-signature': 'valid-signature' },
      body,
      contentType: 'application/x-www-form-urlencoded',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required fields');
  });

  it('skips unknown statuses', async () => {
    const { POST } = await import('./twilio/route');
    const body = new URLSearchParams({
      MessageSid: 'SM_UNKNOWN_123',
      MessageStatus: 'unknown_status',
      To: 'whatsapp:+919876543210',
      From: 'whatsapp:+911234567890',
    }).toString();

    const request = createMockRequest({
      url: 'http://localhost:3000/api/webhooks/twilio',
      headers: { 'x-twilio-signature': 'valid-signature' },
      body,
      contentType: 'application/x-www-form-urlencoded',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.skipped).toBe(true);
    expect(data.status).toBe('unknown_status');
    expect(mockStoreDeliveryEvent).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════
// Test Webhook Tests
// ═══════════════════════════════════════

describe('POST /api/webhooks/test', () => {
  beforeEach(() => {
    mockStoreDeliveryEvent.mockClear();
    process.env.NODE_ENV = 'test';
  });

  it('injects single test event', async () => {
    const { POST } = await import('./test/route');
    const request = createMockRequest({
      url: 'http://localhost:3000/api/webhooks/test',
      body: JSON.stringify({
        channel: 'email',
        provider: 'resend',
        eventType: 'email.delivered',
        recipient: 'test@example.com',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.event).toBeDefined();
    expect(data.event.eventType).toBe('email.delivered');

    expect(mockStoreDeliveryEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'resend',
        channel: 'email',
        eventType: 'email.delivered',
        metadata: expect.objectContaining({ testEvent: true }),
      }),
    );
  });

  it('injects batch test events (creates initial + batch count)', async () => {
    const { POST } = await import('./test/route');
    const request = createMockRequest({
      url: 'http://localhost:3000/api/webhooks/test',
      body: JSON.stringify({
        batch: true,
        count: 5,
        channel: 'email',
        provider: 'resend',
        eventType: 'email.sent',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(5);

    // Route creates 1 initial event + 5 batch events
    expect(mockStoreDeliveryEvent).toHaveBeenCalledTimes(6);
  });

  it('limits batch count to 100', async () => {
    const { POST } = await import('./test/route');
    const request = createMockRequest({
      url: 'http://localhost:3000/api/webhooks/test',
      body: JSON.stringify({
        batch: true,
        count: 150,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Route creates 1 initial event + 100 batch events (capped)
    expect(data.count).toBe(100);
    expect(mockStoreDeliveryEvent).toHaveBeenCalledTimes(101);
  });

  it('returns 403 in production', async () => {
    process.env.NODE_ENV = 'production';

    const { POST } = await import('./test/route');
    const request = createMockRequest({
      url: 'http://localhost:3000/api/webhooks/test',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('development');
  });

  it('generates default event type when not provided', async () => {
    const { POST } = await import('./test/route');
    const request = createMockRequest({
      url: 'http://localhost:3000/api/webhooks/test',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.event).toBeDefined();
    expect(mockStoreDeliveryEvent).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════
// Webhook Health Check Tests
// ═══════════════════════════════════════

describe('GET /api/webhooks', () => {
  beforeEach(() => {
    mockValidateAuth.mockReset();
    mockGetDeliveryEvents.mockReset();
    mockGetDeliveryStats.mockReset();
    mockValidateAuth.mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      supabase: {},
      org: { orgId: 'org-123', role: 'owner' },
    });
    mockGetDeliveryEvents.mockReturnValue([]);
    mockGetDeliveryStats.mockReturnValue({
      totalEvents: 0,
      emailEvents: 0,
      whatsappEvents: 0,
      byType: {},
      byStatus: { delivered: 0, failed: 0, pending: 0, opened: 0, clicked: 0 },
      recentEvents: [],
    });
  });

  afterEach(() => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    delete process.env.TWILIO_AUTH_TOKEN;
  });

  it('returns webhook configuration status', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'test-secret';
    process.env.TWILIO_AUTH_TOKEN = 'test-token';

    const { GET } = await import('./route');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.configured.resend.webhookSecret).toBe(true);
    expect(data.configured.twilio.authToken).toBe(true);
    expect(data.endpoints.resend.url).toBe('/api/webhooks/resend');
    expect(data.endpoints.twilio.url).toBe('/api/webhooks/twilio');
  });

  it('returns false when secrets not configured', async () => {
    const { GET } = await import('./route');

    const response = await GET();
    const data = await response.json();

    expect(data.configured.resend.webhookSecret).toBe(false);
    expect(data.configured.twilio.authToken).toBe(false);
  });

  it('returns 401 when not authenticated', async () => {
    mockValidateAuth.mockResolvedValue({
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const { GET } = await import('./route');

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it('includes recent event counts', async () => {
    mockGetDeliveryEvents.mockReturnValue([
      { provider: 'resend', channel: 'email', receivedAt: Date.now() },
      { provider: 'twilio', channel: 'whatsapp', receivedAt: Date.now() },
    ]);
    mockGetDeliveryStats.mockReturnValue({
      totalEvents: 2,
      emailEvents: 1,
      whatsappEvents: 1,
      byType: {},
      byStatus: { delivered: 1, failed: 0, pending: 1, opened: 0, clicked: 0 },
      recentEvents: [],
    });

    const { GET } = await import('./route');

    const response = await GET();
    const data = await response.json();

    expect(data.recentEvents.total).toBe(2);
    expect(data.recentEvents.byProvider.resend).toBe(1);
    expect(data.recentEvents.byProvider.twilio).toBe(1);
  });
});
