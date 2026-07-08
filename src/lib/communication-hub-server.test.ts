// ═══════════════════════════════════════
// ORACLE — Communication Hub Server Tests
// Tests for sendMessage, sendBulkMessages, checkCommunicationHealth
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mock references ────────────

const {
  mockSendEmail,
  mockSendTemplateEmail,
  mockSendBulkEmail,
  mockCheckEmailHealth,
  mockSendWhatsAppMessage,
  mockSendBulkWhatsApp,
  mockSendWhatsAppTemplate,
  mockCheckWhatsAppHealth,
} = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
  mockSendTemplateEmail: vi.fn(),
  mockSendBulkEmail: vi.fn(),
  mockCheckEmailHealth: vi.fn(),
  mockSendWhatsAppMessage: vi.fn(),
  mockSendBulkWhatsApp: vi.fn(),
  mockSendWhatsAppTemplate: vi.fn(),
  mockCheckWhatsAppHealth: vi.fn(),
}));

// ─── Module Mocks ──────────────────────

vi.mock('@/lib/email-service', () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
  sendTemplateEmail: (...args: any[]) => mockSendTemplateEmail(...args),
  sendBulkEmail: (...args: any[]) => mockSendBulkEmail(...args),
  checkEmailServiceHealth: (...args: any[]) => mockCheckEmailHealth(...args),
}));

vi.mock('@/lib/whatsapp', () => ({
  sendWhatsAppMessage: (...args: any[]) => mockSendWhatsAppMessage(...args),
  sendBulkWhatsApp: (...args: any[]) => mockSendBulkWhatsApp(...args),
  sendWhatsAppTemplate: (...args: any[]) => mockSendWhatsAppTemplate(...args),
  checkWhatsAppHealth: (...args: any[]) => mockCheckWhatsAppHealth(...args),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Helpers ────────────────────────────

function emailSuccessResult(messageId = 're_msg_123') {
  return { success: true, messageId, provider: 'resend' as const };
}

function emailErrorResult(error = 'Provider failed') {
  return { success: false, provider: 'resend' as const, error };
}

function whatsappSuccessResult(id = 'SM123456') {
  return { id, to: 'whatsapp:+919876543210', from: 'whatsapp:+14155238886', status: 'queued' as const, timestamp: Date.now() };
}

function whatsappFailResult(error = 'Twilio error') {
  return { id: '', to: 'whatsapp:+919876543210', from: 'whatsapp:+14155238886', status: 'failed' as const, timestamp: Date.now(), error };
}

// ═══════════════════════════════════════
// sendMessage Tests
// ═══════════════════════════════════════

describe('sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('EMAIL_REPLY_TO', '');
    mockSendEmail.mockResolvedValue(emailSuccessResult());
    mockSendWhatsAppMessage.mockResolvedValue(whatsappSuccessResult());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── Email channel ──

  it('sends email via sendEmail when no templateId', async () => {
    const { sendMessage } = await import('./communication-hub-server');
    const result = await sendMessage({
      channel: 'email',
      to: 'user@example.com',
      subject: 'Test Subject',
      body: 'Hello world',
    });

    expect(result.success).toBe(true);
    expect(result.channel).toBe('email');
    expect(result.provider).toBe('resend');
    expect(result.messageId).toBe('re_msg_123');
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: ['user@example.com'],
      subject: 'Test Subject',
      html: '<p>Hello world</p>',
      text: 'Hello world',
    }));
  });

  it('sends email with template via sendTemplateEmail', async () => {
    mockSendTemplateEmail.mockResolvedValue({ success: true, messageId: 'tmpl_001', provider: 'resend' });

    const { sendMessage } = await import('./communication-hub-server');
    const result = await sendMessage({
      channel: 'email',
      to: 'user@example.com',
      body: '',
      templateId: 'd-abc123',
      templateVariables: { name: 'Alice' },
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('tmpl_001');
    expect(mockSendTemplateEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: ['user@example.com'],
      templateId: 'd-abc123',
      dynamicData: { name: 'Alice' },
    }));
  });

  it('sends email with custom HTML', async () => {
    const { sendMessage } = await import('./communication-hub-server');
    await sendMessage({
      channel: 'email',
      to: 'user@example.com',
      subject: 'Custom',
      body: 'Plain text',
      html: '<h1>Custom HTML</h1>',
      tags: { campaign: 'summer' },
    });

    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      html: '<h1>Custom HTML</h1>',
      tags: { campaign: 'summer' },
    }));
  });

  it('forwards EMAIL_REPLY_TO env var', async () => {
    vi.stubEnv('EMAIL_REPLY_TO', 'reply@example.com');

    const { sendMessage } = await import('./communication-hub-server');
    await sendMessage({
      channel: 'email',
      to: 'user@example.com',
      subject: 'Test',
      body: 'Hello',
    });

    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      replyTo: 'reply@example.com',
    }));
  });

  it('handles email failure', async () => {
    mockSendEmail.mockResolvedValue(emailErrorResult('Rate limited'));

    const { sendMessage } = await import('./communication-hub-server');
    const result = await sendMessage({
      channel: 'email',
      to: 'user@example.com',
      subject: 'Test',
      body: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Rate limited');
  });

  it('supports multiple email recipients', async () => {
    const { sendMessage } = await import('./communication-hub-server');
    await sendMessage({
      channel: 'email',
      to: ['a@test.com', 'b@test.com'],
      subject: 'Multi',
      body: 'Hello',
    });

    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: ['a@test.com', 'b@test.com'],
    }));
  });

  // ── WhatsApp channel ──

  it('sends single WhatsApp message', async () => {
    const { sendMessage } = await import('./communication-hub-server');
    const result = await sendMessage({
      channel: 'whatsapp',
      to: '+919876543210',
      body: 'Hello!',
    });

    expect(result.success).toBe(true);
    expect(result.channel).toBe('whatsapp');
    expect(result.provider).toBe('twilio');
    expect(result.messageId).toBe('SM123456');
    expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(expect.objectContaining({
      to: '+919876543210',
      body: 'Hello!',
    }));
  });

  it('sends bulk WhatsApp messages via sendBulkWhatsApp', async () => {
    mockSendBulkWhatsApp.mockResolvedValue([
      whatsappSuccessResult('SM_001'),
      whatsappSuccessResult('SM_002'),
    ]);

    const { sendMessage } = await import('./communication-hub-server');
    const result = await sendMessage({
      channel: 'whatsapp',
      to: ['+919876543210', '+919876543211'],
      body: 'Bulk message',
    });

    expect(result.success).toBe(true);
    expect(mockSendBulkWhatsApp).toHaveBeenCalledWith(
      ['+919876543210', '+919876543211'],
      'Bulk message',
    );
  });

  it('sends WhatsApp template messages', async () => {
    mockSendWhatsAppTemplate.mockResolvedValue(whatsappSuccessResult('SM_TMPL'));

    const { sendMessage } = await import('./communication-hub-server');
    const result = await sendMessage({
      channel: 'whatsapp',
      to: ['+919876543210', '+919876543211'],
      body: '',
      templateId: 'HX_TEMPLATE',
      templateVariables: { name: 'Bob' },
    });

    expect(result.success).toBe(true);
    expect(mockSendWhatsAppTemplate).toHaveBeenCalledTimes(2);
    expect(mockSendWhatsAppTemplate).toHaveBeenCalledWith(
      '+919876543210',
      'HX_TEMPLATE',
      { name: 'Bob' },
    );
  });

  it('returns success=false when all WhatsApp messages fail', async () => {
    mockSendWhatsAppMessage.mockResolvedValue(whatsappFailResult('Twilio error'));

    const { sendMessage } = await import('./communication-hub-server');
    const result = await sendMessage({
      channel: 'whatsapp',
      to: '+919876543210',
      body: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Twilio error');
  });

  it('returns success=true when some bulk WhatsApp messages succeed', async () => {
    mockSendBulkWhatsApp.mockResolvedValue([
      whatsappSuccessResult('SM_OK'),
      whatsappFailResult('One failed'),
    ]);

    const { sendMessage } = await import('./communication-hub-server');
    const result = await sendMessage({
      channel: 'whatsapp',
      to: ['+919876543210', '+919876543211'],
      body: 'Partial',
    });

    expect(result.success).toBe(true);
  });

  it('sends WhatsApp message with mediaUrl', async () => {
    const { sendMessage } = await import('./communication-hub-server');
    await sendMessage({
      channel: 'whatsapp',
      to: '+919876543210',
      body: 'Check this',
      mediaUrl: ['https://example.com/image.png'],
    });

    expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(expect.objectContaining({
      mediaUrl: ['https://example.com/image.png'],
    }));
  });

  // ── Unsupported channel ──

  it('returns error for unsupported channel', async () => {
    const { sendMessage } = await import('./communication-hub-server');
    const result = await sendMessage({
      channel: 'sms' as any,
      to: '+919876543210',
      body: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported channel');
  });

  // ── Error handling ──

  it('catches thrown errors and returns failure', async () => {
    mockSendEmail.mockRejectedValue(new Error('Network timeout'));

    const { sendMessage } = await import('./communication-hub-server');
    const result = await sendMessage({
      channel: 'email',
      to: 'user@example.com',
      subject: 'Test',
      body: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network timeout');
  });

  it('catches non-Error throws', async () => {
    mockSendEmail.mockRejectedValue('string error');

    const { sendMessage } = await import('./communication-hub-server');
    const result = await sendMessage({
      channel: 'email',
      to: 'user@example.com',
      subject: 'Test',
      body: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
  });
});

// ═══════════════════════════════════════
// sendBulkMessages Tests
// ═══════════════════════════════════════

describe('sendBulkMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendBulkEmail.mockResolvedValue([
      { success: true, messageId: 're_bulk_001', provider: 'resend' },
      { success: true, messageId: 're_bulk_002', provider: 'resend' },
    ]);
    mockSendBulkWhatsApp.mockResolvedValue([
      whatsappSuccessResult('SM_BULK_001'),
      whatsappSuccessResult('SM_BULK_002'),
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends bulk emails via sendBulkEmail', async () => {
    const { sendBulkMessages } = await import('./communication-hub-server');
    const results = await sendBulkMessages(
      'email',
      ['a@test.com', 'b@test.com'],
      'Subject',
      'Body',
    );

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[0].channel).toBe('email');
    expect(results[0].messageId).toBe('re_bulk_001');
    expect(mockSendBulkEmail).toHaveBeenCalledWith(
      ['a@test.com', 'b@test.com'],
      'Subject',
      expect.any(String),
      { tags: undefined },
    );
  });

  it('passes custom HTML and tags for email', async () => {
    const { sendBulkMessages } = await import('./communication-hub-server');
    await sendBulkMessages(
      'email',
      ['a@test.com'],
      'Subject',
      'Body',
      { html: '<h1>Custom</h1>', tags: { type: 'newsletter' } },
    );

    expect(mockSendBulkEmail).toHaveBeenCalledWith(
      ['a@test.com'],
      'Subject',
      '<h1>Custom</h1>',
      { tags: { type: 'newsletter' } },
    );
  });

  it('sends bulk WhatsApp messages via sendBulkWhatsApp', async () => {
    const { sendBulkMessages } = await import('./communication-hub-server');
    const results = await sendBulkMessages(
      'whatsapp',
      ['+919876543210', '+919876543211'],
      '',
      'Bulk message',
    );

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[0].channel).toBe('whatsapp');
    expect(results[0].provider).toBe('twilio');
    expect(results[0].messageId).toBe('SM_BULK_001');
    expect(mockSendBulkWhatsApp).toHaveBeenCalledWith(
      ['+919876543210', '+919876543211'],
      'Bulk message',
    );
  });

  it('returns empty array for unsupported channel', async () => {
    const { sendBulkMessages } = await import('./communication-hub-server');
    const results = await sendBulkMessages(
      'sms' as any,
      ['+919876543210'],
      'Subject',
      'Body',
    );

    expect(results).toEqual([]);
  });

  it('wraps email results with timestamp', async () => {
    const { sendBulkMessages } = await import('./communication-hub-server');
    const results = await sendBulkMessages('email', ['a@test.com'], 'S', 'B');

    expect(results[0].timestamp).toBeTypeOf('number');
    expect(results[0].timestamp).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════
// checkCommunicationHealth Tests
// ═══════════════════════════════════════

describe('checkCommunicationHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns health status for both providers', async () => {
    mockCheckEmailHealth.mockResolvedValue({
      resend: true,
      sendgrid: false,
      preferred: 'resend',
    });
    mockCheckWhatsAppHealth.mockResolvedValue({
      configured: true,
      fromNumber: 'whatsapp:+14155238886',
      accountSid: 'AC123456...',
    });

    const { checkCommunicationHealth } = await import('./communication-hub-server');
    const health = await checkCommunicationHealth();

    expect(health.email.resend).toBe(true);
    expect(health.email.sendgrid).toBe(false);
    expect(health.email.preferred).toBe('resend');
    expect(health.whatsapp.configured).toBe(true);
    expect(health.whatsapp.fromNumber).toBe('whatsapp:+14155238886');
  });

  it('returns health when both providers are down', async () => {
    mockCheckEmailHealth.mockResolvedValue({
      resend: false,
      sendgrid: false,
      preferred: 'resend',
    });
    mockCheckWhatsAppHealth.mockResolvedValue({
      configured: false,
      fromNumber: '',
      accountSid: '',
    });

    const { checkCommunicationHealth } = await import('./communication-hub-server');
    const health = await checkCommunicationHealth();

    expect(health.email.resend).toBe(false);
    expect(health.whatsapp.configured).toBe(false);
  });

  it('calls both health checks in parallel', async () => {
    mockCheckEmailHealth.mockResolvedValue({ resend: true, sendgrid: true, preferred: 'resend' });
    mockCheckWhatsAppHealth.mockResolvedValue({ configured: true, fromNumber: '', accountSid: '' });

    const { checkCommunicationHealth } = await import('./communication-hub-server');
    await checkCommunicationHealth();

    expect(mockCheckEmailHealth).toHaveBeenCalledTimes(1);
    expect(mockCheckWhatsAppHealth).toHaveBeenCalledTimes(1);
  });
});
