// ═══════════════════════════════════════
// ORACLE — WhatsApp Service Tests
// Tests for sendWhatsAppMessage, sendBulkWhatsApp, utilities
// Uses vi.resetModules() for twilioClient singleton isolation
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mock references ────────────
// Must be declared before vi.mock() so the factory can reference them.

const { mockSendMessage, mockFetchMessage, mockListMessages, mockListTemplates } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
  mockFetchMessage: vi.fn(),
  mockListMessages: vi.fn(),
  mockListTemplates: vi.fn(),
}));

// ─── Module Mocks ──────────────────────

vi.mock('twilio', () => {
  // messages needs to be both callable (for messages(sid).fetch())
  // and have .create() and .list() properties.
  const messages: any = Object.assign(
    vi.fn().mockReturnValue({ fetch: mockFetchMessage }),
    {
      create: mockSendMessage,
      list: mockListMessages,
    },
  );

  return {
    default: vi.fn().mockReturnValue({
      messages,
      content: {
        v1: {
          contents: {
            list: mockListTemplates,
          },
        },
      },
    }),
  };
});

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Fresh Import Helper ────────────────
// Resets module cache to clear the twilioClient singleton.
// vi.resetModules() clears the module registry so each import
// re-executes the module, re-creating the twilioClient = null state.
// vi.mock() registrations are preserved across resetModules() calls.

async function freshImport() {
  vi.resetModules();
  return import('./whatsapp');
}

// ─── Env Helpers ────────────────────────
// Uses vi.stubEnv() for automatic cleanup in afterEach via vi.unstubAllEnvs().

function stubEnv(overrides: Record<string, string> = {}) {
  vi.stubEnv('TWILIO_ACCOUNT_SID', overrides.TWILIO_ACCOUNT_SID ?? 'AC1234567890abcdef');
  vi.stubEnv('TWILIO_AUTH_TOKEN', overrides.TWILIO_AUTH_TOKEN ?? 'auth-token-12345');
  vi.stubEnv('TWILIO_WHATSAPP_FROM', overrides.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886');
}

// ═══════════════════════════════════════
// sendWhatsAppMessage Tests
// ═══════════════════════════════════════

describe('sendWhatsAppMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv();
    mockSendMessage.mockResolvedValue({
      sid: 'SM1234567890',
      status: 'queued',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends a text message successfully', async () => {
    const { sendWhatsAppMessage } = await freshImport();
    const result = await sendWhatsAppMessage({
      to: '+919876543210',
      body: 'Hello!',
    });

    expect(result.status).toBe('queued');
    expect(result.id).toBe('SM1234567890');
    expect(result.to).toBe('whatsapp:+919876543210');
    expect(result.from).toBe('whatsapp:+14155238886');
    expect(result.body).toBe('Hello!');
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'whatsapp:+919876543210',
        from: 'whatsapp:+14155238886',
        body: 'Hello!',
      }),
    );
  });

  it('sends a template message with contentSid', async () => {
    const { sendWhatsAppMessage } = await freshImport();
    const result = await sendWhatsAppMessage({
      to: '+919876543210',
      templateSid: 'HX1234567890abcdef',
      templateVariables: { name: 'Alice', order: '12345' },
    });

    expect(result.status).toBe('queued');
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'whatsapp:+919876543210',
        contentSid: 'HX1234567890abcdef',
        contentVariables: JSON.stringify({ name: 'Alice', order: '12345' }),
      }),
    );
  });

  it('sends a template message without variables', async () => {
    const { sendWhatsAppMessage } = await freshImport();
    const result = await sendWhatsAppMessage({
      to: '+919876543210',
      templateSid: 'HX1234567890abcdef',
    });

    expect(result.status).toBe('queued');
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        contentSid: 'HX1234567890abcdef',
      }),
    );
    // No contentVariables when templateVariables is undefined
    const callArgs = mockSendMessage.mock.calls[0][0];
    expect(callArgs.contentVariables).toBeUndefined();
  });

  it('sends a media message with mediaUrl', async () => {
    const { sendWhatsAppMessage } = await freshImport();
    const result = await sendWhatsAppMessage({
      to: '+919876543210',
      body: 'Check this out!',
      mediaUrl: ['https://example.com/image.png'],
    });

    expect(result.status).toBe('queued');
    expect(result.mediaUrl).toEqual(['https://example.com/image.png']);
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'whatsapp:+919876543210',
        body: 'Check this out!',
        mediaUrl: ['https://example.com/image.png'],
      }),
    );
  });

  it('sends a media message without body', async () => {
    const { sendWhatsAppMessage } = await freshImport();
    await sendWhatsAppMessage({
      to: '+919876543210',
      mediaUrl: ['https://example.com/doc.pdf'],
    });

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaUrl: ['https://example.com/doc.pdf'],
        body: '',
      }),
    );
  });

  it('formats number already prefixed with whatsapp:', async () => {
    const { sendWhatsAppMessage } = await freshImport();
    await sendWhatsAppMessage({
      to: 'whatsapp:+919876543210',
      body: 'Test',
    });

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'whatsapp:+919876543210',
      }),
    );
  });

  it('formats number with + prefix', async () => {
    const { sendWhatsAppMessage } = await freshImport();
    await sendWhatsAppMessage({
      to: '+14155551234',
      body: 'Test',
    });

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'whatsapp:+14155551234',
      }),
    );
  });

  it('formats 10-digit number with +91 prefix (Indian)', async () => {
    const { sendWhatsAppMessage } = await freshImport();
    await sendWhatsAppMessage({
      to: '9876543210',
      body: 'Test',
    });

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'whatsapp:+919876543210',
      }),
    );
  });

  it('formats plain number with + prefix', async () => {
    const { sendWhatsAppMessage } = await freshImport();
    await sendWhatsAppMessage({
      to: '141555512345',
      body: 'Test',
    });

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'whatsapp:+141555512345',
      }),
    );
  });

  it('returns failed status when credentials are not configured', async () => {
    stubEnv({ TWILIO_ACCOUNT_SID: '', TWILIO_AUTH_TOKEN: '' });

    const { sendWhatsAppMessage } = await freshImport();
    const result = await sendWhatsAppMessage({
      to: '+919876543210',
      body: 'Test',
    });

    expect(result.status).toBe('failed');
    expect(result.id).toBe('');
    expect(result.error).toBe('Twilio credentials not configured');
    expect(result.to).toBe('+919876543210');
    expect(result.from).toBe('whatsapp:+14155238886');
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('returns failed status when auth token is missing', async () => {
    stubEnv({ TWILIO_AUTH_TOKEN: '' });

    const { sendWhatsAppMessage } = await freshImport();
    const result = await sendWhatsAppMessage({
      to: '+919876543210',
      body: 'Test',
    });

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Twilio credentials not configured');
  });

  it('returns failed status when Twilio client throws an Error', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('Twilio rate limit exceeded'));

    const { sendWhatsAppMessage } = await freshImport();
    const result = await sendWhatsAppMessage({
      to: '+919876543210',
      body: 'Test',
    });

    expect(result.status).toBe('failed');
    expect(result.id).toBe('');
    expect(result.error).toBe('Twilio rate limit exceeded');
    expect(result.to).toBe('whatsapp:+919876543210');
  });

  it('handles non-Error throw from Twilio client', async () => {
    mockSendMessage.mockRejectedValueOnce('string error');

    const { sendWhatsAppMessage } = await freshImport();
    const result = await sendWhatsAppMessage({
      to: '+919876543210',
      body: 'Test',
    });

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Unknown error');
  });

  it('uses custom from number from env', async () => {
    stubEnv({ TWILIO_WHATSAPP_FROM: 'whatsapp:+15551234567' });

    const { sendWhatsAppMessage } = await freshImport();
    const result = await sendWhatsAppMessage({
      to: '+919876543210',
      body: 'Custom from',
    });

    expect(result.from).toBe('whatsapp:+15551234567');
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'whatsapp:+15551234567',
      }),
    );
  });
});

// ═══════════════════════════════════════
// sendWhatsAppMedia Tests
// ═══════════════════════════════════════

describe('sendWhatsAppMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv();
    mockSendMessage.mockResolvedValue({
      sid: 'SM_MEDIA_001',
      status: 'queued',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends media message with URL', async () => {
    const { sendWhatsAppMedia } = await freshImport();
    const result = await sendWhatsAppMedia(
      '+919876543210',
      'https://example.com/image.png',
    );

    expect(result.status).toBe('queued');
    expect(result.id).toBe('SM_MEDIA_001');
    expect(result.mediaUrl).toEqual(['https://example.com/image.png']);
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaUrl: ['https://example.com/image.png'],
        body: '',
      }),
    );
  });

  it('sends media message with caption', async () => {
    const { sendWhatsAppMedia } = await freshImport();
    const result = await sendWhatsAppMedia(
      '+919876543210',
      'https://example.com/doc.pdf',
      'Here is your invoice',
    );

    expect(result.status).toBe('queued');
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaUrl: ['https://example.com/doc.pdf'],
        body: 'Here is your invoice',
      }),
    );
  });
});

// ═══════════════════════════════════════
// sendWhatsAppTemplate Tests
// ═══════════════════════════════════════

describe('sendWhatsAppTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv();
    mockSendMessage.mockResolvedValue({
      sid: 'SM_TMPL_001',
      status: 'queued',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends template message with SID and variables', async () => {
    const { sendWhatsAppTemplate } = await freshImport();
    const result = await sendWhatsAppTemplate(
      '+919876543210',
      'HX_TEMPLATE_SID',
      { name: 'Bob', amount: '5000' },
    );

    expect(result.status).toBe('queued');
    expect(result.id).toBe('SM_TMPL_001');
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        contentSid: 'HX_TEMPLATE_SID',
        contentVariables: JSON.stringify({ name: 'Bob', amount: '5000' }),
      }),
    );
  });

  it('sends template message without variables', async () => {
    const { sendWhatsAppTemplate } = await freshImport();
    const result = await sendWhatsAppTemplate(
      '+919876543210',
      'HX_TEMPLATE_SID',
    );

    expect(result.status).toBe('queued');
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        contentSid: 'HX_TEMPLATE_SID',
      }),
    );
    const callArgs = mockSendMessage.mock.calls[0][0];
    expect(callArgs.contentVariables).toBeUndefined();
  });
});

// ═══════════════════════════════════════
// checkWhatsAppHealth Tests
// ═══════════════════════════════════════

describe('checkWhatsAppHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns configured=true when credentials are present', async () => {
    const { checkWhatsAppHealth } = await freshImport();
    const health = await checkWhatsAppHealth();

    expect(health.configured).toBe(true);
    expect(health.fromNumber).toBe('whatsapp:+14155238886');
    expect(health.accountSid).toBe('AC123456...');
  });

  it('returns configured=false when accountSid is missing', async () => {
    stubEnv({ TWILIO_ACCOUNT_SID: '' });
    const { checkWhatsAppHealth } = await freshImport();
    const health = await checkWhatsAppHealth();

    expect(health.configured).toBe(false);
    expect(health.accountSid).toBe('');
  });

  it('returns configured=false when authToken is missing', async () => {
    stubEnv({ TWILIO_AUTH_TOKEN: '' });
    const { checkWhatsAppHealth } = await freshImport();
    const health = await checkWhatsAppHealth();

    expect(health.configured).toBe(false);
  });

  it('masks accountSid to first 8 characters', async () => {
    stubEnv({ TWILIO_ACCOUNT_SID: 'AC1234567890abcdef' });
    const { checkWhatsAppHealth } = await freshImport();
    const health = await checkWhatsAppHealth();

    expect(health.accountSid).toBe('AC123456...');
  });

  it('uses default fromNumber when env is not set', async () => {
    stubEnv({ TWILIO_WHATSAPP_FROM: '' });
    const { checkWhatsAppHealth } = await freshImport();
    const health = await checkWhatsAppHealth();

    expect(health.fromNumber).toBe('whatsapp:+14155238886');
  });
});

// ═══════════════════════════════════════
// getMessageStatus Tests
// ═══════════════════════════════════════

describe('getMessageStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv();
    mockFetchMessage.mockResolvedValue({
      sid: 'SM1234567890',
      to: 'whatsapp:+919876543210',
      from: 'whatsapp:+14155238886',
      body: 'Hello!',
      status: 'delivered',
      dateCreated: '2026-07-08T10:00:00Z',
      errorCode: undefined,
      errorMessage: undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fetches message status by SID', async () => {
    const { getMessageStatus } = await freshImport();
    const result = await getMessageStatus('SM1234567890');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('SM1234567890');
    expect(result!.to).toBe('whatsapp:+919876543210');
    expect(result!.from).toBe('whatsapp:+14155238886');
    expect(result!.body).toBe('Hello!');
    expect(result!.status).toBe('delivered');
    expect(result!.timestamp).toBe(new Date('2026-07-08T10:00:00Z').getTime());
  });

  it('returns null when credentials are not configured', async () => {
    stubEnv({ TWILIO_ACCOUNT_SID: '', TWILIO_AUTH_TOKEN: '' });
    const { getMessageStatus } = await freshImport();
    const result = await getMessageStatus('SM1234567890');

    expect(result).toBeNull();
    expect(mockFetchMessage).not.toHaveBeenCalled();
  });

  it('returns null when fetch throws an error', async () => {
    mockFetchMessage.mockRejectedValueOnce(new Error('Message not found'));
    const { getMessageStatus } = await freshImport();
    const result = await getMessageStatus('SM_NOT_FOUND');

    expect(result).toBeNull();
  });

  it('returns null when fetch throws a non-Error value', async () => {
    mockFetchMessage.mockRejectedValueOnce('string error');
    const { getMessageStatus } = await freshImport();
    const result = await getMessageStatus('SM_NOT_FOUND');

    expect(result).toBeNull();
  });

  it('includes errorCode and errorMessage when present', async () => {
    mockFetchMessage.mockResolvedValueOnce({
      sid: 'SM_FAILED_001',
      to: 'whatsapp:+919876543210',
      from: 'whatsapp:+14155238886',
      body: undefined,
      status: 'failed',
      dateCreated: '2026-07-08T10:00:00Z',
      errorCode: 30005,
      errorMessage: 'Undeliverable',
    });

    const { getMessageStatus } = await freshImport();
    const result = await getMessageStatus('SM_FAILED_001');

    expect(result).not.toBeNull();
    expect(result!.status).toBe('failed');
    expect(result!.errorCode).toBe('30005');
    expect(result!.errorMessage).toBe('Undeliverable');
  });

  it('handles undefined body gracefully', async () => {
    mockFetchMessage.mockResolvedValueOnce({
      sid: 'SM_NO_BODY',
      to: 'whatsapp:+919876543210',
      from: 'whatsapp:+14155238886',
      body: null,
      status: 'sent',
      dateCreated: '2026-07-08T10:00:00Z',
      errorCode: undefined,
      errorMessage: undefined,
    });

    const { getMessageStatus } = await freshImport();
    const result = await getMessageStatus('SM_NO_BODY');

    expect(result).not.toBeNull();
    expect(result!.body).toBeUndefined();
  });
});

// ═══════════════════════════════════════
// getRecentMessages Tests
// ═══════════════════════════════════════

describe('getRecentMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv();
    mockListMessages.mockResolvedValue([
      {
        sid: 'SM_MSG_001',
        to: 'whatsapp:+919876543210',
        from: 'whatsapp:+14155238886',
        body: 'First message',
        status: 'delivered',
        dateCreated: '2026-07-08T10:00:00Z',
        errorCode: undefined,
        errorMessage: undefined,
      },
      {
        sid: 'SM_MSG_002',
        to: 'whatsapp:+919876543210',
        from: 'whatsapp:+14155238886',
        body: 'Second message',
        status: 'queued',
        dateCreated: '2026-07-08T10:01:00Z',
        errorCode: undefined,
        errorMessage: undefined,
      },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fetches recent messages for a number', async () => {
    const { getRecentMessages } = await freshImport();
    const results = await getRecentMessages('+919876543210');

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('SM_MSG_001');
    expect(results[0].body).toBe('First message');
    expect(results[0].status).toBe('delivered');
    expect(results[1].id).toBe('SM_MSG_002');
    expect(results[1].body).toBe('Second message');
  });

  it('passes limit parameter to Twilio list', async () => {
    const { getRecentMessages } = await freshImport();
    await getRecentMessages('+919876543210', 50);

    expect(mockListMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'whatsapp:+919876543210',
        pageSize: 50,
      }),
    );
  });

  it('uses default limit of 20', async () => {
    const { getRecentMessages } = await freshImport();
    await getRecentMessages('+919876543210');

    expect(mockListMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 20,
      }),
    );
  });

  it('returns empty array when credentials are not configured', async () => {
    stubEnv({ TWILIO_ACCOUNT_SID: '', TWILIO_AUTH_TOKEN: '' });
    const { getRecentMessages } = await freshImport();
    const results = await getRecentMessages('+919876543210');

    expect(results).toEqual([]);
    expect(mockListMessages).not.toHaveBeenCalled();
  });

  it('returns empty array when list throws an error', async () => {
    mockListMessages.mockRejectedValueOnce(new Error('API limit exceeded'));
    const { getRecentMessages } = await freshImport();
    const results = await getRecentMessages('+919876543210');

    expect(results).toEqual([]);
  });

  it('returns empty array when list throws a non-Error value', async () => {
    mockListMessages.mockRejectedValueOnce('string error');
    const { getRecentMessages } = await freshImport();
    const results = await getRecentMessages('+919876543210');

    expect(results).toEqual([]);
  });

  it('maps messages with optional fields', async () => {
    mockListMessages.mockResolvedValueOnce([
      {
        sid: 'SM_WITH_ERRORS',
        to: 'whatsapp:+919876543210',
        from: 'whatsapp:+14155238886',
        body: null,
        status: 'failed',
        dateCreated: '2026-07-08T10:00:00Z',
        errorCode: 30003,
        errorMessage: 'Destination unreachable',
      },
    ]);

    const { getRecentMessages } = await freshImport();
    const results = await getRecentMessages('+919876543210');

    expect(results).toHaveLength(1);
    expect(results[0].body).toBeUndefined();
    expect(results[0].errorCode).toBe('30003');
    expect(results[0].errorMessage).toBe('Destination unreachable');
  });
});

// ═══════════════════════════════════════
// listTemplates Tests
// ═══════════════════════════════════════

describe('listTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv();
    mockListTemplates.mockResolvedValue([
      {
        sid: 'HX_TMPL_001',
        friendlyName: 'Welcome Message',
        language: 'en',
      },
      {
        sid: 'HX_TMPL_002',
        friendlyName: undefined,
        language: undefined,
      },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fetches available templates', async () => {
    const { listTemplates } = await freshImport();
    const templates = await listTemplates();

    expect(templates).toHaveLength(2);
    expect(templates[0].sid).toBe('HX_TMPL_001');
    expect(templates[0].name).toBe('Welcome Message');
    expect(templates[0].language).toBe('en');
    expect(templates[0].category).toBe('dynamic');
    expect(templates[0].status).toBe('approved');
  });

  it('falls back to SID when friendlyName is missing', async () => {
    const { listTemplates } = await freshImport();
    const templates = await listTemplates();

    expect(templates[1].name).toBe('HX_TMPL_002');
    expect(templates[1].language).toBe('en');
  });

  it('returns empty array when credentials are not configured', async () => {
    stubEnv({ TWILIO_ACCOUNT_SID: '', TWILIO_AUTH_TOKEN: '' });
    const { listTemplates } = await freshImport();
    const templates = await listTemplates();

    expect(templates).toEqual([]);
    expect(mockListTemplates).not.toHaveBeenCalled();
  });

  it('returns empty array when list throws an error', async () => {
    mockListTemplates.mockRejectedValueOnce(new Error('Content API error'));
    const { listTemplates } = await freshImport();
    const templates = await listTemplates();

    expect(templates).toEqual([]);
  });

  it('returns empty array when list throws a non-Error value', async () => {
    mockListTemplates.mockRejectedValueOnce('string error');
    const { listTemplates } = await freshImport();
    const templates = await listTemplates();

    expect(templates).toEqual([]);
  });
});

// ═══════════════════════════════════════
// sendBulkWhatsApp Tests
// ═══════════════════════════════════════

describe('sendBulkWhatsApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    stubEnv();
    mockSendMessage.mockResolvedValue({
      sid: 'SM1234567890',
      status: 'queued',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('sends messages to all recipients', async () => {
    const { sendBulkWhatsApp } = await freshImport();
    const recipients = ['+919876543210', '+919876543211', '+919876543212'];
    const body = 'Hello from Oracle!';

    const promise = sendBulkWhatsApp(recipients, body);
    await vi.advanceTimersByTimeAsync(500);
    const results = await promise;

    expect(results).toHaveLength(3);
    expect(mockSendMessage).toHaveBeenCalledTimes(3);
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'whatsapp:+919876543210',
        body: body,
      }),
    );
  });

  it('applies 100ms delay between consecutive messages', async () => {
    const { sendBulkWhatsApp } = await freshImport();
    const recipients = ['+919876543210', '+919876543211', '+919876543212'];
    const body = 'Bulk test';

    const promise = sendBulkWhatsApp(recipients, body);

    // After 0ms: only first message sent
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    // After 99ms: still only first message (delay not complete)
    await vi.advanceTimersByTimeAsync(99);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    // After 100ms: second message sent
    await vi.advanceTimersByTimeAsync(1);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);

    // After 199ms: still only two messages
    await vi.advanceTimersByTimeAsync(99);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);

    // After 200ms: third message sent
    await vi.advanceTimersByTimeAsync(1);
    expect(mockSendMessage).toHaveBeenCalledTimes(3);

    await promise;
  });

  it('does NOT delay after the last message', async () => {
    const { sendBulkWhatsApp } = await freshImport();
    const recipients = ['+919876543210', '+919876543211'];
    const body = 'No delay after last';

    const promise = sendBulkWhatsApp(recipients, body);

    // First message sent immediately
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    // Advance past first delay (100ms)
    await vi.advanceTimersByTimeAsync(100);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);

    // Advance another 200ms — no more messages should be sent
    await vi.advanceTimersByTimeAsync(200);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);

    await promise;
  });

  it('handles single recipient with no delay', async () => {
    const { sendBulkWhatsApp } = await freshImport();
    const recipients = ['+919876543210'];
    const body = 'Single recipient';

    const promise = sendBulkWhatsApp(recipients, body);

    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    // Even after waiting, no more messages should be sent
    await vi.advanceTimersByTimeAsync(200);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    await promise;
  });

  it('handles empty recipients array', async () => {
    const { sendBulkWhatsApp } = await freshImport();

    const results = await sendBulkWhatsApp([], 'Empty array test');

    expect(results).toHaveLength(0);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('delays are sequential (total time ≈ (n-1) × 100ms)', async () => {
    const { sendBulkWhatsApp } = await freshImport();
    const recipients = ['+919876543210', '+919876543211', '+919876543212', '+919876543213'];
    const body = 'Sequential timing test';

    const startTime = Date.now();
    const promise = sendBulkWhatsApp(recipients, body);

    // 4 recipients = 3 delays × 100ms = 300ms total delay
    await vi.advanceTimersByTimeAsync(300);
    const results = await promise;

    expect(results).toHaveLength(4);
    expect(mockSendMessage).toHaveBeenCalledTimes(4);

    // Total time should be approximately 300ms (3 delays)
    expect(Date.now() - startTime).toBeGreaterThanOrEqual(300);
    expect(Date.now() - startTime).toBeLessThan(350);
  });

  it('returns failed status when sendWhatsAppMessage fails', async () => {
    const { sendBulkWhatsApp } = await freshImport();
    mockSendMessage.mockRejectedValueOnce(new Error('Twilio API error'));

    const recipients = ['+919876543210', '+919876543211'];
    const body = 'Failure test';

    const promise = sendBulkWhatsApp(recipients, body);
    await vi.advanceTimersByTimeAsync(200);

    const results = await promise;

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('failed');
    expect(results[0].error).toBe('Twilio API error');
    // Second message still sent despite first failure
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it('continues sending after individual message failure', async () => {
    const { sendBulkWhatsApp } = await freshImport();

    // Mock to fail first, succeed second
    mockSendMessage
      .mockRejectedValueOnce(new Error('First failed'))
      .mockResolvedValueOnce({ sid: 'SM_SUCCESS', status: 'queued' });

    const recipients = ['+919876543210', '+919876543211'];
    const body = 'Continue after failure';

    const promise = sendBulkWhatsApp(recipients, body);
    await vi.advanceTimersByTimeAsync(200);

    const results = await promise;

    expect(results[0].status).toBe('failed');
    expect(results[1].status).toBe('queued');
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });
});
