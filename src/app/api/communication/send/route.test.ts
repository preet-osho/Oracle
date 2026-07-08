import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { CommunicationChannel } from '@/lib/communication-hub-types';

// ─── Mocks ───────────────────────────

// Auth mock
const mockValidateAuth = vi.fn();
vi.mock('@/lib/supabase/validate', () => ({
  validateAuth: (...a: any[]) => mockValidateAuth(...a),
}));

// Rate limit mock
const mockCheckRateLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...a: any[]) => mockCheckRateLimit(...a),
  API_WRITE_RATE_LIMIT: { maxRequests: 30, windowMs: 60_000 },
}));

// Audit log mock (fire-and-forget, just verify it's called)
const mockWriteAuditLog = vi.fn();
vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: (...a: any[]) => mockWriteAuditLog(...a),
  AUDIT_ACTIONS: {
    RATE_LIMIT_EXCEEDED: 'security.rate_limit_exceeded',
  },
}));

// Communication hub server mocks
const mockSendMessage = vi.fn();
const mockSendBulkMessages = vi.fn();
const mockCheckCommunicationHealth = vi.fn();
vi.mock('@/lib/communication-hub-server', () => ({
  sendMessage: (...a: any[]) => mockSendMessage(...a),
  sendBulkMessages: (...a: any[]) => mockSendBulkMessages(...a),
  checkCommunicationHealth: (...a: any[]) => mockCheckCommunicationHealth(...a),
  isValidEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  isValidWhatsAppNumber: (phone: string) => {
    const cleaned = phone.replace(/[^0-9+]/g, '');
    return /^\+[1-9]\d{6,14}$/.test(cleaned);
  },
}));

// ─── Imports (after mocks) ──────────

import { POST, GET } from './route';

// ─── Helpers ─────────────────────────

function authOk() {
  mockValidateAuth.mockResolvedValue({
    user: { id: 'user-1', email: 'test@example.com' },
    supabase: {},
    org: { orgId: 'org-1', role: 'owner' as const },
  });
}

function authNoOrg() {
  mockValidateAuth.mockResolvedValue({
    user: { id: 'user-1', email: 'test@example.com' },
    supabase: {},
    org: null,
  });
}

function authUnauthorized() {
  mockValidateAuth.mockResolvedValue({ error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) });
}

function rateLimitOk() {
  mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
}

function rateLimitExceeded() {
  mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30_000 });
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/communication/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}

function successResult(overrides?: Record<string, unknown>) {
  return {
    success: true,
    channel: 'email' as CommunicationChannel,
    messageId: 'msg-123',
    provider: 'resend',
    timestamp: Date.now(),
    ...overrides,
  };
}

function failResult(error = 'Provider error') {
  return {
    success: false,
    channel: 'email' as CommunicationChannel,
    provider: 'resend',
    error,
    timestamp: Date.now(),
  };
}

// ═══════════════════════════════════════
// GET Handler Tests (Health Check)
// ═══════════════════════════════════════

describe('GET /api/communication/send (Health Check)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCommunicationHealth.mockResolvedValue({
      email: { resend: true, sendgrid: false, preferred: 'resend' },
      whatsapp: { configured: true, fromNumber: '+919876543210' },
    });
  });

  it('returns health status without requiring authentication', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('email');
    expect(body).toHaveProperty('whatsapp');
  });

  it('does not call validateAuth (unauthenticated endpoint)', async () => {
    await GET();
    expect(mockValidateAuth).not.toHaveBeenCalled();
  });

  it('returns degraded status when no providers configured', async () => {
    mockCheckCommunicationHealth.mockResolvedValue({
      email: { resend: false, sendgrid: false, preferred: 'resend' },
      whatsapp: { configured: false, fromNumber: '' },
    });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.email.resend).toBe(false);
    expect(body.whatsapp.configured).toBe(false);
  });

  it('propagates health check errors', async () => {
    mockCheckCommunicationHealth.mockRejectedValue(new Error('Provider unreachable'));
    await expect(GET()).rejects.toThrow('Provider unreachable');
  });
});

// ═══════════════════════════════════════
// POST Handler — Authentication
// ═══════════════════════════════════════

describe('POST /api/communication/send — Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitOk();
  });

  it('returns 401 when user is not authenticated', async () => {
    authUnauthorized();
    const res = await POST(makeRequest({ channel: 'email', to: 'a@b.com', subject: 'Hi', body: 'Hello' }));
    expect(res.status).toBe(401);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('returns 400 when user has no organization', async () => {
    authNoOrg();
    const res = await POST(makeRequest({ channel: 'email', to: 'a@b.com', subject: 'Hi', body: 'Hello' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('organization');
  });

  it('passes auth context to sendMessage audit log', async () => {
    authOk();
    mockSendMessage.mockResolvedValue(successResult());
    await POST(makeRequest({ channel: 'email', to: 'user@test.com', subject: 'Hi', body: 'Hello' }));
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', action: 'communication.send' }),
    );
  });
});

// ═══════════════════════════════════════
// POST Handler — Rate Limiting
// ═══════════════════════════════════════

describe('POST /api/communication/send — Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authOk();
  });

  it('returns 429 when rate limit is exceeded', async () => {
    rateLimitExceeded();
    const res = await POST(makeRequest({ channel: 'email', to: 'a@b.com', subject: 'Hi', body: 'Hello' }));
    expect(res.status).toBe(429);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('includes Retry-After header in 429 response', async () => {
    rateLimitExceeded();
    const res = await POST(makeRequest({ channel: 'email', to: 'a@b.com', subject: 'Hi', body: 'Hello' }));
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
  });

  it('audit logs rate limit exceeded events', async () => {
    rateLimitExceeded();
    await POST(makeRequest({ channel: 'email', to: 'a@b.com', subject: 'Hi', body: 'Hello' }));
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'security.rate_limit_exceeded' }),
    );
  });
});

// ═══════════════════════════════════════
// POST Handler — Single Email Send
// ═══════════════════════════════════════

describe('POST /api/communication/send — Single Email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authOk();
    rateLimitOk();
  });

  it('sends a single email successfully', async () => {
    mockSendMessage.mockResolvedValue(successResult());
    const res = await POST(makeRequest({
      channel: 'email',
      to: 'user@example.com',
      subject: 'Test Subject',
      body: 'Hello World',
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.messageId).toBe('msg-123');
    expect(body.provider).toBe('resend');
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'email',
      to: ['user@example.com'],
      subject: 'Test Subject',
      body: 'Hello World',
    }));
  });

  it('supports multiple email recipients', async () => {
    mockSendMessage.mockResolvedValue(successResult());
    await POST(makeRequest({
      channel: 'email',
      to: ['a@test.com', 'b@test.com'],
      subject: 'Newsletter',
      body: 'Content',
    }));
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      to: ['a@test.com', 'b@test.com'],
    }));
  });

  it('returns 500 when email send fails', async () => {
    mockSendMessage.mockResolvedValue(failResult('Resend API error'));
    const res = await POST(makeRequest({
      channel: 'email',
      to: 'user@example.com',
      subject: 'Test',
      body: 'Hello',
    }));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('Resend API error');
  });

  it('returns 400 for invalid email address', async () => {
    const res = await POST(makeRequest({
      channel: 'email',
      to: 'not-an-email',
      subject: 'Test',
      body: 'Hello',
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid email');
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('returns 400 when subject is missing for email', async () => {
    const res = await POST(makeRequest({
      channel: 'email',
      to: 'user@example.com',
      body: 'Hello',
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Subject');
  });

  it('returns 400 when body is missing for non-template message', async () => {
    const res = await POST(makeRequest({
      channel: 'email',
      to: 'user@example.com',
      subject: 'Hi',
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('body');
  });

  it('passes through optional html, tags, and priority', async () => {
    mockSendMessage.mockResolvedValue(successResult());
    await POST(makeRequest({
      channel: 'email',
      to: 'user@example.com',
      subject: 'Rich',
      body: 'Plain text',
      html: '<p>Rich text</p>',
      tags: { campaign: 'summer' },
      priority: 'high',
    }));
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      html: '<p>Rich text</p>',
      tags: { campaign: 'summer' },
      priority: 'high',
    }));
  });
});

// ═══════════════════════════════════════
// POST Handler — Single WhatsApp Send
// ═══════════════════════════════════════

describe('POST /api/communication/send — Single WhatsApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authOk();
    rateLimitOk();
  });

  it('sends a single WhatsApp message successfully', async () => {
    mockSendMessage.mockResolvedValue(successResult({ channel: 'whatsapp' as CommunicationChannel, provider: 'twilio', messageId: 'SM-abc' }));
    const res = await POST(makeRequest({
      channel: 'whatsapp',
      to: '+919876543210',
      body: 'Hello via WhatsApp',
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.provider).toBe('twilio');
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'whatsapp',
      to: ['+919876543210'],
      body: 'Hello via WhatsApp',
    }));
  });

  it('returns 400 for invalid WhatsApp number', async () => {
    const res = await POST(makeRequest({
      channel: 'whatsapp',
      to: '12345',
      body: 'Hello',
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid WhatsApp');
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('does not require subject for WhatsApp messages', async () => {
    mockSendMessage.mockResolvedValue(successResult({ channel: 'whatsapp' as CommunicationChannel }));
    const res = await POST(makeRequest({
      channel: 'whatsapp',
      to: '+919876543210',
      body: 'No subject needed',
    }));
    expect(res.status).toBe(200);
  });

  it('returns 500 when WhatsApp send fails', async () => {
    mockSendMessage.mockResolvedValue(failResult('Twilio error'));
    const res = await POST(makeRequest({
      channel: 'whatsapp',
      to: '+919876543210',
      body: 'Hello',
    }));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('Twilio error');
  });

  it('supports media URL for WhatsApp', async () => {
    mockSendMessage.mockResolvedValue(successResult({ channel: 'whatsapp' as CommunicationChannel }));
    await POST(makeRequest({
      channel: 'whatsapp',
      to: '+919876543210',
      body: 'Check this out',
      mediaUrl: ['https://example.com/image.jpg'],
    }));
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      mediaUrl: ['https://example.com/image.jpg'],
    }));
  });
});

// ═══════════════════════════════════════
// POST Handler — Bulk Send
// ═══════════════════════════════════════

describe('POST /api/communication/send — Bulk Send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authOk();
    rateLimitOk();
  });

  it('sends bulk emails successfully', async () => {
    mockSendBulkMessages.mockResolvedValue([
      { success: true, channel: 'email', messageId: 'msg-1', provider: 'resend', timestamp: Date.now() },
      { success: true, channel: 'email', messageId: 'msg-2', provider: 'resend', timestamp: Date.now() },
    ]);
    const res = await POST(makeRequest({
      channel: 'email',
      recipients: ['a@test.com', 'b@test.com'],
      subject: 'Bulk Newsletter',
      body: 'Content here',
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.total).toBe(2);
    expect(body.successful).toBe(2);
    expect(body.failed).toBe(0);
    expect(mockSendBulkMessages).toHaveBeenCalledWith('email', ['a@test.com', 'b@test.com'], 'Bulk Newsletter', 'Content here', expect.any(Object));
  });

  it('returns partial success when some bulk sends fail', async () => {
    mockSendBulkMessages.mockResolvedValue([
      { success: true, channel: 'email', messageId: 'msg-1', provider: 'resend', timestamp: Date.now() },
      { success: false, channel: 'email', provider: 'resend', error: 'Bounced', timestamp: Date.now() },
    ]);
    const res = await POST(makeRequest({
      channel: 'email',
      recipients: ['a@test.com', 'b@test.com'],
      subject: 'Newsletter',
      body: 'Content',
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.successful).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.results).toHaveLength(2);
    expect(body.results[1].error).toBe('Bounced');
  });

  it('returns 400 when bulk recipients exceed 100', async () => {
    const recipients = Array.from({ length: 101 }, (_, i) => `user${i}@test.com`);
    const res = await POST(makeRequest({
      channel: 'email',
      recipients,
      subject: 'Big List',
      body: 'Content',
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('100');
    expect(mockSendBulkMessages).not.toHaveBeenCalled();
  });

  it('returns 400 for empty bulk recipients', async () => {
    const res = await POST(makeRequest({
      channel: 'email',
      recipients: [],
      subject: 'Empty',
      body: 'Content',
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('recipient');
  });

  it('validates bulk email addresses', async () => {
    const res = await POST(makeRequest({
      channel: 'email',
      recipients: ['valid@test.com', 'invalid-email'],
      subject: 'Test',
      body: 'Content',
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid email');
    expect(mockSendBulkMessages).not.toHaveBeenCalled();
  });

  it('validates bulk WhatsApp numbers', async () => {
    const res = await POST(makeRequest({
      channel: 'whatsapp',
      recipients: ['+919876543210', '12345'],
      subject: 'Test',
      body: 'Content',
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid WhatsApp');
  });

  it('sends bulk WhatsApp messages', async () => {
    mockSendBulkMessages.mockResolvedValue([
      { success: true, channel: 'whatsapp', messageId: 'SM-1', provider: 'twilio', timestamp: Date.now() },
    ]);
    const res = await POST(makeRequest({
      channel: 'whatsapp',
      recipients: ['+919876543210'],
      subject: 'Test',
      body: 'Bulk WA',
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSendBulkMessages).toHaveBeenCalledWith('whatsapp', ['+919876543210'], 'Test', 'Bulk WA', expect.any(Object));
  });

  it('audit logs bulk send action', async () => {
    mockSendBulkMessages.mockResolvedValue([
      { success: true, channel: 'email', messageId: 'msg-1', provider: 'resend', timestamp: Date.now() },
    ]);
    await POST(makeRequest({
      channel: 'email',
      recipients: ['a@test.com'],
      subject: 'Test',
      body: 'Content',
    }));
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', action: 'communication.bulk_send', entityType: 'email' }),
    );
  });
});

// ═══════════════════════════════════════
// POST Handler — Validation Edge Cases
// ═══════════════════════════════════════

describe('POST /api/communication/send — Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authOk();
    rateLimitOk();
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/communication/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }) as any;
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('JSON');
  });

  it('returns 400 for unsupported channel', async () => {
    const res = await POST(makeRequest({ channel: 'sms', to: '+123', body: 'Hi' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Unsupported channel');
  });

  it('returns 400 when no recipient is provided', async () => {
    const res = await POST(makeRequest({ channel: 'email', subject: 'Hi', body: 'Hello' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('recipient');
  });

  it('returns 400 for empty recipients array', async () => {
    const res = await POST(makeRequest({ channel: 'email', to: [], subject: 'Hi', body: 'Hello' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('recipient');
  });

  it('allows template-based email without subject', async () => {
    mockSendMessage.mockResolvedValue(successResult());
    const res = await POST(makeRequest({
      channel: 'email',
      to: 'user@example.com',
      templateId: 'welcome-template',
      templateVariables: { name: 'Alice' },
      body: '',
    }));
    expect(res.status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      templateId: 'welcome-template',
      templateVariables: { name: 'Alice' },
    }));
  });
});
