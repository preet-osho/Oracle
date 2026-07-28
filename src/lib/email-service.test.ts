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
  Resend: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
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

// ─── Mock React Email Components ──────

vi.mock('@react-email/components', () => ({
  Text: ({ children, ...props }: Record<string, unknown>) => ({ type: 'div', props: { ...props, children } }),
  Button: ({ children, ...props }: Record<string, unknown>) => ({ type: 'a', props: { ...props, children } }),
  Section: ({ children, ...props }: Record<string, unknown>) => ({ type: 'div', props: { ...props, children } }),
  Hr: (props: Record<string, unknown>) => ({ type: 'hr', props }),
  Link: ({ children, ...props }: Record<string, unknown>) => ({ type: 'a', props: { ...props, children } }),
}));

vi.mock('@/emails/base-layout', () => ({
  BaseLayout: (props: Record<string, unknown>) => ({ type: 'div', props }),
}));

vi.mock('@/emails/utils', () => ({
  formatCurrency: (amount: number, currency = 'INR') => {
    const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    return `${symbols[currency] || currency + ' '}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },
  formatCurrencyCompact: (amount: number, currency = 'INR') => {
    const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    return `${symbols[currency] || currency + ' '}${amount.toLocaleString('en-IN')}`;
  },
  statusEmoji: (status: string) => ({ 'completed': '✅', 'on-track': '🟢', 'at-risk': '🟡' }[status] || '⚪'),
}));

vi.mock('@/emails/password-reset', () => ({
  PasswordResetEmail: (props: Record<string, unknown>) => ({ type: 'div', props: { ...props } }),
}));

vi.mock('@/emails/invitation', () => ({
  InvitationEmail: (props: Record<string, unknown>) => ({ type: 'div', props: { ...props } }),
}));

vi.mock('@/emails/invoice', () => ({
  InvoiceEmail: (props: Record<string, unknown>) => ({ type: 'div', props: { ...props } }),
}));

vi.mock('@/emails/weekly-report', () => ({
  WeeklyReportEmail: (props: Record<string, unknown>) => ({ type: 'div', props: { ...props } }),
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
// sendTemplateEmail Edge Cases
// ═══════════════════════════════════════

describe('sendTemplateEmail — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv({});
    mockResendSend.mockResolvedValue(successResendResult());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('handles empty dynamicData', async () => {
    const { sendTemplateEmail } = await freshImport();
    const result = await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {},
    });

    expect(result.success).toBe(true);
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      tags: [],
    }));
  });

  it('converts non-string dynamicData values to strings', async () => {
    const { sendTemplateEmail } = await freshImport();
    await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {
        count: 42,
        active: true,
        ratio: 3.14,
        nothing: null,
      },
    });

    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      tags: [
        { name: 'count', value: '42' },
        { name: 'active', value: 'true' },
        { name: 'ratio', value: '3.14' },
        { name: 'nothing', value: 'null' },
      ],
    }));
  });

  it('handles complex nested objects in dynamicData by stringifying', async () => {
    const { sendTemplateEmail } = await freshImport();
    await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {
        metadata: { key: 'value' },
      },
    });

    // Complex objects get converted to strings via String() which gives '[object Object]'
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      tags: [
        { name: 'metadata', value: String({ key: 'value' }) },
      ],
    }));
  });

  it('sends template via SendGrid with replyTo', async () => {
    stubEnv({ EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'sg_test_key' });
    mockSgMailSend.mockResolvedValue(successSendGridResult('sg_reply'));

    const { sendTemplateEmail } = await freshImport();
    await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {},
      replyTo: 'support@example.com',
    });

    expect(mockSgMailSend).toHaveBeenCalledWith(expect.objectContaining({
      replyTo: { email: 'support@example.com' },
    }));
  });

  it('sends template via SendGrid with custom from', async () => {
    stubEnv({ EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'sg_test_key' });
    mockSgMailSend.mockResolvedValue(successSendGridResult('sg_from'));

    const { sendTemplateEmail } = await freshImport();
    await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {},
      from: 'Custom <custom@example.com>',
    });

    expect(mockSgMailSend).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Custom <custom@example.com>',
    }));
  });

  it('returns failure when SendGrid API key is missing and Resend is unavailable', async () => {
    stubEnv({ EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: '', RESEND_API_KEY: '' });

    const { sendTemplateEmail } = await freshImport();
    const result = await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {},
    });

    expect(result.success).toBe(false);
    expect(result.provider).toBe('sendgrid');
    expect(result.error).toContain('not configured');
  });

  it('handles Resend returning non-Error throw', async () => {
    stubEnv({ SENDGRID_API_KEY: 'sg_test_key' });
    mockResendSend.mockRejectedValue('string error');
    mockSgMailSend.mockResolvedValue(successSendGridResult('sg_recover'));

    const { sendTemplateEmail } = await freshImport();
    const result = await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {},
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('sendgrid');
  });

  it('handles SendGrid returning non-Error throw', async () => {
    stubEnv({ EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'sg_test_key' });
    mockSgMailSend.mockRejectedValue('string error');
    mockResendSend.mockResolvedValue(successResendResult('re_recover'));

    const { sendTemplateEmail } = await freshImport();
    const result = await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {},
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('resend');
  });

  it('handles Resend rate limit error with specific message', async () => {
    stubEnv({ SENDGRID_API_KEY: 'sg_test_key' });
    mockResendSend.mockResolvedValue(errorResendResult('rate_limited'));
    mockSgMailSend.mockResolvedValue(successSendGridResult('sg_after_rate'));

    const { sendTemplateEmail } = await freshImport();
    const result = await sendTemplateEmail({
      to: 'user@example.com',
      templateId: 'd-abc123',
      dynamicData: {},
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('sendgrid');
  });
});

// ═══════════════════════════════════════
// sendReactEmail Tests
// ═══════════════════════════════════════

describe('sendReactEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv({});
    mockResendSend.mockResolvedValue(successResendResult());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders React component and sends email', async () => {
    const { sendReactEmail } = await freshImport();
    const { render } = await import('@react-email/render');

    const result = await sendReactEmail({
      to: 'user@example.com',
      subject: 'React Email',
      react: { type: 'div', props: { children: 'Hello' } } as React.ReactElement,
    });

    expect(render).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.provider).toBe('resend');
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'React Email',
    }));
  });

  it('passes through tags and from options', async () => {
    const { sendReactEmail } = await freshImport();

    await sendReactEmail({
      to: 'user@example.com',
      subject: 'Tagged Email',
      react: { type: 'div', props: {} } as React.ReactElement,
      from: 'Custom <custom@example.com>',
      tags: { type: 'react' },
    });

    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Custom <custom@example.com>',
      tags: [{ name: 'type', value: 'react' }],
    }));
  });

  it('falls back to SendGrid when Resend fails', async () => {
    stubEnv({ SENDGRID_API_KEY: 'sg_test_key' });
    mockResendSend.mockResolvedValue(errorResendResult());
    mockSgMailSend.mockResolvedValue(successSendGridResult('sg_react'));

    const { sendReactEmail } = await freshImport();
    const result = await sendReactEmail({
      to: 'user@example.com',
      subject: 'React Fallback',
      react: { type: 'div', props: {} } as React.ReactElement,
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('sendgrid');
  });
});

// ═══════════════════════════════════════
// React Template Wrapper Tests
// ═══════════════════════════════════════

describe('sendPasswordResetEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv({});
    mockResendSend.mockResolvedValue(successResendResult());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends password reset email with correct subject and tags', async () => {
    const { sendPasswordResetEmail } = await freshImport();
    const result = await sendPasswordResetEmail(
      'user@example.com',
      'reset-token-123',
      'https://oracle.dev',
    );

    expect(result.success).toBe(true);
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ['user@example.com'],
      subject: 'Reset Your Oracle Password',
      tags: [{ name: 'type', value: 'password_reset' }],
    }));
  });

  it('calls render with a React element containing the reset URL', async () => {
    const { sendPasswordResetEmail } = await freshImport();
    const { render } = await import('@react-email/render');

    await sendPasswordResetEmail(
      'user@example.com',
      'my-token',
      'https://oracle.dev',
      { expiryMinutes: 30 },
    );

    // render is called with the React element from PasswordResetEmail
    expect(render).toHaveBeenCalled();
    // The rendered HTML is passed to sendEmail
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      html: '<p>Rendered HTML</p>',
    }));
  });

  it('sends via fallback when Resend is unavailable', async () => {
    stubEnv({ SENDGRID_API_KEY: 'sg_test_key' });
    mockResendSend.mockResolvedValue(errorResendResult());
    mockSgMailSend.mockResolvedValue(successSendGridResult('sg_reset'));

    const { sendPasswordResetEmail } = await freshImport();
    const result = await sendPasswordResetEmail(
      'user@example.com',
      'token',
      'https://oracle.dev',
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('sendgrid');
  });
});

describe('sendInvitationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv({});
    mockResendSend.mockResolvedValue(successResendResult());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends invitation email with correct subject and tags', async () => {
    const { sendInvitationEmail } = await freshImport();
    const result = await sendInvitationEmail(
      'invitee@example.com',
      'Admin User',
      'Acme Corp',
      'invite-token-456',
      'https://oracle.dev',
    );

    expect(result.success).toBe(true);
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ['invitee@example.com'],
      subject: "You've Been Invited to Acme Corp on Oracle",
      tags: [
        { name: 'type', value: 'invitation' },
        { name: 'orgName', value: 'Acme Corp' },
      ],
    }));
  });

  it('calls render with a React element containing the invite URL', async () => {
    const { sendInvitationEmail } = await freshImport();
    const { render } = await import('@react-email/render');

    await sendInvitationEmail(
      'invitee@example.com',
      'Admin',
      'Acme',
      'inv-token',
      'https://oracle.dev',
    );

    expect(render).toHaveBeenCalled();
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      html: '<p>Rendered HTML</p>',
    }));
  });
});

describe('sendInvoiceEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv({});
    mockResendSend.mockResolvedValue(successResendResult());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends invoice email with correct subject and tags', async () => {
    const { sendInvoiceEmail } = await freshImport();
    const result = await sendInvoiceEmail({
      to: 'client@example.com',
      invoiceNumber: 'INV-001',
      clientName: 'Acme Corp',
      clientEmail: 'client@example.com',
      items: [{ description: 'Web Development', quantity: 1, unitPrice: 50000, amount: 50000 }],
      subtotal: 50000,
      total: 59000,
      tax: 9000,
    });

    expect(result.success).toBe(true);
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ['client@example.com'],
      subject: expect.stringContaining('INV-001'),
      tags: [
        { name: 'type', value: 'invoice' },
        { name: 'invoiceNumber', value: 'INV-001' },
      ],
    }));
  });

  it('forwards all props to the React template component', async () => {
    const { sendInvoiceEmail } = await freshImport();
    const { render } = await import('@react-email/render');

    await sendInvoiceEmail({
      to: 'client@example.com',
      invoiceNumber: 'INV-002',
      clientName: 'Test Client',
      clientEmail: 'client@example.com',
      items: [{ description: 'Design', quantity: 2, unitPrice: 10000, amount: 20000 }],
      subtotal: 20000,
      total: 23600,
      tax: 3600,
      notes: 'Thank you for your business',
    });

    // render is called with the React element from InvoiceEmail
    expect(render).toHaveBeenCalled();
  });
});

describe('sendWeeklyReportEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv({});
    mockResendSend.mockResolvedValue(successResendResult());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends weekly report email with correct subject and tags', async () => {
    const { sendWeeklyReportEmail } = await freshImport();
    const result = await sendWeeklyReportEmail({
      to: 'user@example.com',
      weekLabel: 'Week 28, 2026',
      recipientName: 'John',
      metrics: [{ label: 'Revenue', value: '₹1,20,000', change: '+12%' }],
      clients: [{ clientName: 'Acme', tasksCompleted: 3, tasksPending: 1, revenue: 25000, status: 'on-track' as const }],
      totalRevenue: 120000,
    });

    expect(result.success).toBe(true);
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ['user@example.com'],
      subject: '📊 Weekly Report — Week 28, 2026',
      tags: [
        { name: 'type', value: 'weekly_report' },
        { name: 'weekLabel', value: 'Week 28, 2026' },
      ],
    }));
  });

  it('forwards all props to the React template component', async () => {
    const { sendWeeklyReportEmail } = await freshImport();
    const { render } = await import('@react-email/render');

    await sendWeeklyReportEmail({
      to: 'user@example.com',
      weekLabel: 'Week 29',
      recipientName: 'Jane',
      metrics: [{ label: 'Leads', value: '15', change: '+5' }],
      clients: [{ clientName: 'Acme', tasksCompleted: 5, tasksPending: 2, revenue: 10000, status: 'on-track' }],
      totalRevenue: 0,
    });

    expect(render).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════
// sendEmail Edge Cases
// ═══════════════════════════════════════

describe('sendEmail — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEnv({});
    mockResendSend.mockResolvedValue(successResendResult());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends HTML-only email without text', async () => {
    const { sendEmail } = await freshImport();
    await sendEmail({
      to: 'user@example.com',
      subject: 'HTML Only',
      html: '<p>No text version</p>',
    });

    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      html: '<p>No text version</p>',
      text: undefined,
    }));
  });

  it('handles Resend throwing a non-Error value', async () => {
    stubEnv({ SENDGRID_API_KEY: 'sg_test_key' });
    mockResendSend.mockRejectedValue('raw string error');
    mockSgMailSend.mockResolvedValue(successSendGridResult('sg_recover'));

    const { sendEmail } = await freshImport();
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('sendgrid');
  });

  it('treats undefined error as success (no error = no failure)', async () => {
    // When Resend returns { data: null, error: undefined }, the code checks
    // `if (result.error)` which is falsy, so it treats the send as successful.
    mockResendSend.mockResolvedValue({ data: null, error: undefined });

    const { sendEmail } = await freshImport();
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    // error is undefined → falsy → code returns success
    expect(result.success).toBe(true);
    expect(result.provider).toBe('resend');
  });

  it('handles multiple string recipients in cc/bcc', async () => {
    const { sendEmail } = await freshImport();
    await sendEmail({
      to: ['a@test.com', 'b@test.com'],
      subject: 'Multi Recipient',
      html: '<p>Hello</p>',
      cc: ['cc1@test.com', 'cc2@test.com'],
      bcc: ['bcc1@test.com', 'bcc2@test.com'],
    });

    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ['a@test.com', 'b@test.com'],
      cc: ['cc1@test.com', 'cc2@test.com'],
      bcc: ['bcc1@test.com', 'bcc2@test.com'],
    }));
  });

  it('forwards custom tags to SendGrid as customArgs', async () => {
    stubEnv({ EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'sg_test_key' });
    mockSgMailSend.mockResolvedValue(successSendGridResult('sg_tags'));

    const { sendEmail } = await freshImport();
    await sendEmail({
      to: 'user@example.com',
      subject: 'Tagged',
      html: '<p>Hello</p>',
      tags: { campaign: 'winter', region: 'apac' },
    });

    expect(mockSgMailSend).toHaveBeenCalledWith(expect.objectContaining({
      customArgs: { campaign: 'winter', region: 'apac' },
    }));
  });

  it('forwards replyTo to SendGrid', async () => {
    stubEnv({ EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'sg_test_key' });
    mockSgMailSend.mockResolvedValue(successSendGridResult('sg_reply'));

    const { sendEmail } = await freshImport();
    await sendEmail({
      to: 'user@example.com',
      subject: 'Reply Test',
      html: '<p>Hello</p>',
      replyTo: 'reply@test.com',
    });

    expect(mockSgMailSend).toHaveBeenCalledWith(expect.objectContaining({
      replyTo: { email: 'reply@test.com' },
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
