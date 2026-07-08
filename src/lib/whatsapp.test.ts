// ═══════════════════════════════════════
// ORACLE — WhatsApp Service Tests
// Tests for sendWhatsAppMessage, sendBulkWhatsApp, utilities
// Uses vi.resetModules() for twilioClient singleton isolation
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mock references ────────────
// Must be declared before vi.mock() so the factory can reference them.

const { mockSendMessage } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
}));

// ─── Module Mocks ──────────────────────

vi.mock('twilio', () => ({
  default: vi.fn().mockReturnValue({
    messages: {
      create: mockSendMessage,
      list: vi.fn(),
      fetch: vi.fn(),
    },
  }),
}));

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
