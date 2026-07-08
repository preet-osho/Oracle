// ═══════════════════════════════════════
// ORACLE — Email Service Tests
// Tests for sendTemplateEmail, sendEmail, sendBulkEmail
// with mocked Resend and SendGrid providers
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock Variables (hoisted before vi.mock) ──

const { mockResendSend, mockSgMailSend, mockSgMailSetApiKey } = vi.hoisted(() => ({
  mockResendSend: vi.fn(),
  mockSgMailSend: vi.fn(),
  mockSgMailSetApiKey: vi.fn(),
}));

// ─── Mock Resend ──────────────────────

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    this.emails = { send: mockResendSend };
  }),
}));

// ─── Mock SendGrid ────────────────────

vi.mock('@sendgrid/mail', () => ({
  send: mockSgMailSend,
  setApiKey: mockSgMailSetApiKey,
}));

// ─── Mock React Email Render ──────────

vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<p>Rendered HTML</p>'),
}));

// ─── Mock Logger ──────────────────────

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Fresh Import Helper ──────────────
// Resets module cache to clear singletons (resendClient, sendgridConfigured)

async function freshImport() {
  vi.resetModules();
  return import('@/lib/email-service');
}

// ─── Helpers ──────────────────────────

function successResendResult(messageId = 're_msg_123') {
  return { data: { id: messageId }, error: null };
}

function errorResendResult(message = 'Rate limited') {
  return { data: null, error: { message, name: 'rate_limit_exceeded', statusCode: 429 } };
}

function successSendGridResult(messageId = 'sg_msg_456') {
  return [{ headers: { 'x-message-id': messageId } }];
}

function stubEnv(overrides: Record<string, string>) {
  vi.stubEnv('RESEND_API_KEY', overrides.RESEND_API_KEY ?? 're_test_key');
  vi.stubEnv('SENDGRID_API_KEY', overrides.SENDGRID_API_KEY ?? '');
  vi.stubEnv('EMAIL_PROVIDER', overrides.EMAIL_PROVIDER ?? 'resend');
  vi.stubEnv('EMAIL_FROM', overrides.EMAIL_FROM ?? 'Oracle <noreply@oracledigital.in>');
}

// ═══════════════════════════════════════
// sendTemplateEmail Tests
// ═══════════════════════════════════════

describe('sendTemplateEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv({});
    mockResendSend.mockResolvedValue(successResendResult());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends template email via Resend (preferred provider)', async () => {
    const { sendTemplateEmail } = await freshImport();
    const result = await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: { name: 'Alice', action: 'reset' },
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('resend');
    expect(result.messageId).toBe('re_msg_123');
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ['user@example.com'],
      subject: 'Template: d-abc123',
      tags: expect.arrayContaining([
        { name: 'name', value: 'Alice' },
        { name: 'action', value: 'reset' },
      ]),
    }));
  });

  it('supports multiple recipients for template email', async () => {
    const { sendTemplateEmail } = await freshImport();
    await sendTemplateEmail({
      to: ['alice@test.com', 'bob@test.com'],
      templateId: 'd-abc123',
      dynamicData: { name: 'Alice' },
    });

    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ['alice@test.com', 'bob@test.com'],
    }));
  });

  it('uses custom from address when provided', async () => {
    const { sendTemplateEmail } = await freshImport();
    await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {},
      from: 'Custom <custom@example.com>',
    });

    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Custom <custom@example.com>',
    }));
  });

  it('passes replyTo when provided', async () => {
    const { sendTemplateEmail } = await freshImport();
    await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {},
      replyTo: 'support@example.com',
    });

    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      reply_to: 'support@example.com',
    }));
  });

  it('falls back to SendGrid when Resend fails', async () => {
    stubEnv({ SENDGRID_API_KEY: 'sg_test_key' });
    mockResendSend.mockResolvedValue(errorResendResult('Resend rate limited'));
    mockSgMailSend.mockResolvedValue(successSendGridResult('sg_msg_789'));

    const { sendTemplateEmail } = await freshImport();
    const result = await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: { name: 'Alice' },
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('sendgrid');
    expect(result.messageId).toBe('sg_msg_789');
    expect(mockResendSend).toHaveBeenCalled();
    expect(mockSgMailSend).toHaveBeenCalledWith(expect.objectContaining({
      templateId: 'd-abc123',
      dynamicTemplateData: { name: 'Alice' },
    }));
  });

  it('falls back to SendGrid when Resend throws', async () => {
    stubEnv({ SENDGRID_API_KEY: 'sg_test_key' });
    mockResendSend.mockRejectedValue(new Error('Network timeout'));
    mockSgMailSend.mockResolvedValue(successSendGridResult());

    const { sendTemplateEmail } = await freshImport();
    const result = await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {},
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('sendgrid');
  });

  it('returns failure when both Resend and SendGrid fail', async () => {
    stubEnv({ SENDGRID_API_KEY: 'sg_test_key' });
    mockResendSend.mockResolvedValue(errorResendResult('Resend error'));
    mockSgMailSend.mockRejectedValue(new Error('SendGrid error'));

    const { sendTemplateEmail } = await freshImport();
    const result = await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Both providers failed');
  });

  it('returns failure when Resend fails and SendGrid is not configured', async () => {
    mockResendSend.mockResolvedValue(errorResendResult('Resend error'));

    const { sendTemplateEmail } = await freshImport();
    const result = await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Both providers failed');
  });

  it('returns failure when Resend API key is missing', async () => {
    stubEnv({ RESEND_API_KEY: '' });

    const { sendTemplateEmail } = await freshImport();
    const result = await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {},
    });

    expect(result.success).toBe(false);
    expect(result.provider).toBe('resend');
    expect(result.error).toContain('not configured');
  });

  it('sends template via SendGrid when it is the preferred provider', async () => {
    stubEnv({ EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'sg_test_key' });
    mockSgMailSend.mockResolvedValue(successSendGridResult('sg_direct'));

    const { sendTemplateEmail } = await freshImport();
    const result = await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: { name: 'Alice' },
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('sendgrid');
    expect(result.messageId).toBe('sg_direct');
    expect(mockSgMailSend).toHaveBeenCalledWith(expect.objectContaining({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicTemplateData: { name: 'Alice' },
    }));
  });

  it('falls back to Resend when SendGrid fails and Resend is available', async () => {
    stubEnv({ EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'sg_test_key' });
    mockSgMailSend.mockRejectedValue(new Error('SendGrid down'));
    mockResendSend.mockResolvedValue(successResendResult('re_fallback'));

    const { sendTemplateEmail } = await freshImport();
    const result = await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {},
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('resend');
    expect(result.messageId).toBe('re_fallback');
  });

  it('returns failure when SendGrid fails and Resend is not configured', async () => {
    stubEnv({ EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'sg_test_key', RESEND_API_KEY: '' });
    mockSgMailSend.mockRejectedValue(new Error('SendGrid down'));

    const { sendTemplateEmail } = await freshImport();
    const result = await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Both providers failed');
  });
});

// ═══════════════════════════════════════
// sendEmail Tests
// ═══════════════════════════════════════

describe('sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv({});
    mockResendSend.mockResolvedValue(successResendResult());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends email via Resend successfully', async () => {
    const { sendEmail } = await freshImport();
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test Email',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('resend');
    expect(result.messageId).toBe('re_msg_123');
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ['user@example.com'],
      subject: 'Test Email',
      html: '<p>Hello</p>',
      text: 'Hello',
    }));
  });

  it('falls back to SendGrid when Resend fails', async () => {
    stubEnv({ SENDGRID_API_KEY: 'sg_test_key' });
    mockResendSend.mockResolvedValue(errorResendResult());
    mockSgMailSend.mockResolvedValue(successSendGridResult());

    const { sendEmail } = await freshImport();
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('sendgrid');
  });

  it('returns failure when both providers fail', async () => {
    stubEnv({ SENDGRID_API_KEY: 'sg_test_key' });
    mockResendSend.mockResolvedValue(errorResendResult());
    mockSgMailSend.mockRejectedValue(new Error('SendGrid error'));

    const { sendEmail } = await freshImport();
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Primary:');
    expect(result.error).toContain('Fallback:');
  });

  it('handles cc and bcc recipients', async () => {
    const { sendEmail } = await freshImport();
    await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      cc: 'cc@test.com',
      bcc: ['bcc1@test.com', 'bcc2@test.com'],
    });

    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      cc: ['cc@test.com'],
      bcc: ['bcc1@test.com', 'bcc2@test.com'],
    }));
  });

  it('handles attachments', async () => {
    const { sendEmail } = await freshImport();
    await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      attachments: [{
        filename: 'test.txt',
        content: 'file content',
        contentType: 'text/plain',
      }],
    });

    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      attachments: [expect.objectContaining({
        filename: 'test.txt',
        content_type: 'text/plain',
      })],
    }));
  });

  it('handles custom tags', async () => {
    const { sendEmail } = await freshImport();
    await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      tags: { campaign: 'summer', segment: 'active' },
    });

    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      tags: [
        { name: 'campaign', value: 'summer' },
        { name: 'segment', value: 'active' },
      ],
    }));
  });
});

// ═══════════════════════════════════════
// sendBulkEmail Tests
// ═══════════════════════════════════════

describe('sendBulkEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv({});
    mockResendSend.mockResolvedValue(successResendResult());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends bulk emails successfully', async () => {
    const { sendBulkEmail } = await freshImport();
    const recipients = ['a@test.com', 'b@test.com', 'c@test.com'];
    const results = await sendBulkEmail(recipients, 'Bulk Subject', '<p>Bulk content</p>');

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].provider).toBe('resend');
  });

  it('sends single batch for small lists', async () => {
    const { sendBulkEmail } = await freshImport();
    const recipients = Array.from({ length: 10 }, (_, i) => `user${i}@test.com`);
    await sendBulkEmail(recipients, 'Subject', '<p>Content</p>');

    expect(mockResendSend).toHaveBeenCalledTimes(1);
  });

  it('processes in batches of 50 for large lists', async () => {
    const { sendBulkEmail } = await freshImport();
    const recipients = Array.from({ length: 120 }, (_, i) => `user${i}@test.com`);
    await sendBulkEmail(recipients, 'Subject', '<p>Content</p>');

    // 120 recipients → 3 batches (50 + 50 + 20)
    expect(mockResendSend).toHaveBeenCalledTimes(3);
  });

  it('passes through optional text and tags', async () => {
    const { sendBulkEmail } = await freshImport();
    await sendBulkEmail(
      ['a@test.com'],
      'Subject',
      '<p>HTML</p>',
      { text: 'Plain text', tags: { type: 'bulk' } },
    );

    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Plain text',
      tags: [{ name: 'type', value: 'bulk' }],
    }));
  });
});

// ═══════════════════════════════════════
// checkEmailServiceHealth Tests
// ═══════════════════════════════════════

describe('checkEmailServiceHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns health status with Resend configured', async () => {
    stubEnv({ RESEND_API_KEY: 're_key', SENDGRID_API_KEY: '' });
    const { checkEmailServiceHealth } = await freshImport();
    const health = await checkEmailServiceHealth();

    expect(health.resend).toBe(true);
    expect(health.sendgrid).toBe(false);
    expect(health.preferred).toBe('resend');
  });

  it('returns health status with SendGrid configured', async () => {
    stubEnv({ RESEND_API_KEY: '', SENDGRID_API_KEY: 'sg_key', EMAIL_PROVIDER: 'sendgrid' });
    const { checkEmailServiceHealth } = await freshImport();
    const health = await checkEmailServiceHealth();

    expect(health.resend).toBe(false);
    expect(health.sendgrid).toBe(true);
    expect(health.preferred).toBe('sendgrid');
  });

  it('returns health status with both providers configured', async () => {
    stubEnv({ RESEND_API_KEY: 're_key', SENDGRID_API_KEY: 'sg_key' });
    const { checkEmailServiceHealth } = await freshImport();
    const health = await checkEmailServiceHealth();

    expect(health.resend).toBe(true);
    expect(health.sendgrid).toBe(true);
    expect(health.preferred).toBe('resend');
  });

  it('returns health status with no providers configured', async () => {
    stubEnv({ RESEND_API_KEY: '', SENDGRID_API_KEY: '' });
    const { checkEmailServiceHealth } = await freshImport();
    const health = await checkEmailServiceHealth();

    expect(health.resend).toBe(false);
    expect(health.sendgrid).toBe(false);
  });
});
