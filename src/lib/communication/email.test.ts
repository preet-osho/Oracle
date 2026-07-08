// ═══════════════════════════════════════
// ORACLE — Email Service Tests
// HTML generators + sendEmail + sendBulkEmails
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  generateOutreachHtml,
  generateProposalHtml,
  generateFollowUpHtml,
  isEmailConfigured,
  sendEmail,
  sendBulkEmails,
} from './email';

// ─── Helpers ──────────────────────────

function setEnv(overrides: Record<string, string>) {
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
}

function cleanEnv() {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM_ADDRESS;
  delete process.env.EMAIL_FROM_NAME;
}

// ─── Configuration ─────────────────────

describe('Email Service', () => {
  describe('isEmailConfigured', () => {
    afterEach(() => cleanEnv());

    it('returns true when API key is set', () => {
      setEnv({ RESEND_API_KEY: 're_abc123' });
      expect(isEmailConfigured()).toBe(true);
    });

    it('returns false when API key is missing', () => {
      cleanEnv();
      expect(isEmailConfigured()).toBe(false);
    });
  });
});

// ─── HTML Templates ────────────────────

describe('generateOutreachHtml', () => {
  it('generates valid HTML with all parameters', () => {
    const html = generateOutreachHtml({
      recipientName: 'Rahul',
      agencyName: 'Oracle Digital',
      headline: 'Grow your business online',
      body: '<p>We can help you get more customers.</p>',
      cta: 'Book a Call',
      ctaUrl: 'https://calendly.com/oracle',
      signature: 'Preet Osho\nOracle Digital',
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Rahul');
    expect(html).toContain('Oracle Digital');
    expect(html).toContain('Grow your business online');
    expect(html).toContain('Book a Call');
    expect(html).toContain('https://calendly.com/oracle');
    expect(html).toContain('Preet Osho');
  });

  it('handles missing CTA URL gracefully', () => {
    const html = generateOutreachHtml({
      recipientName: 'Test',
      agencyName: 'Test Agency',
      headline: 'Test',
      body: '<p>Test</p>',
      cta: 'Contact us',
      signature: 'Test',
    });

    expect(html).toContain('Contact us');
    expect(html).not.toContain('href=');
  });
});

describe('generateProposalHtml', () => {
  it('generates proposal HTML with pricing', () => {
    const html = generateProposalHtml({
      clientName: 'Rahul',
      agencyName: 'Oracle Digital',
      serviceSummary: 'SEO + Google Ads',
      priceRange: '₹25,000 - ₹40,000/month',
      timeline: '3 months',
      ctaUrl: 'https://oracle.app/proposal/123',
    });

    expect(html).toContain('Rahul');
    expect(html).toContain('SEO + Google Ads');
    expect(html).toContain('₹25,000 - ₹40,000/month');
    expect(html).toContain('3 months');
    expect(html).toContain('View Full Proposal');
    expect(html).toContain('valid for 15 days');
  });
});

describe('generateFollowUpHtml', () => {
  it('generates follow-up HTML', () => {
    const html = generateFollowUpHtml({
      recipientName: 'Priya',
      context: '<p>Just checking in on our last conversation.</p>',
      cta: 'Reply Now',
      ctaUrl: 'https://oracle.app/reply',
    });

    expect(html).toContain('Priya');
    expect(html).toContain('Just checking in');
    expect(html).toContain('Reply Now');
    expect(html).toContain('https://oracle.app/reply');
  });
});

// ─── HTML Quality Checks ───────────────

describe('Email HTML Quality', () => {
  it('all templates include responsive meta tag', () => {
    const outreach = generateOutreachHtml({ recipientName: 'T', agencyName: 'A', headline: 'H', body: 'B', cta: 'C', signature: 'S' });
    const proposal = generateProposalHtml({ clientName: 'T', agencyName: 'A', serviceSummary: 'S', priceRange: 'P', timeline: 'T', ctaUrl: 'U' });
    const followUp = generateFollowUpHtml({ recipientName: 'T', context: 'C', cta: 'C', ctaUrl: 'U' });

    expect(outreach).toContain('viewport');
    expect(proposal).toContain('viewport');
    expect(followUp).toContain('viewport');
  });

  it('all templates use inline CSS (email client compatibility)', () => {
    const html = generateOutreachHtml({ recipientName: 'T', agencyName: 'A', headline: 'H', body: 'B', cta: 'C', ctaUrl: 'U', signature: 'S' });
    expect(html).toContain('style="');
  });

  it('all templates include ORACLE branding', () => {
    const outreach = generateOutreachHtml({ recipientName: 'T', agencyName: 'A', headline: 'H', body: 'B', cta: 'C', signature: 'S' });
    expect(outreach).toContain('ORACLE');
  });
});

// ─── sendEmail ────────────────────────

describe('sendEmail', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    setEnv({ RESEND_API_KEY: 're_abc123' });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    cleanEnv();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sends email with HTML body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'email_001' }),
    });

    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('email_001');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.to).toEqual(['test@example.com']);
    expect(body.subject).toBe('Test');
    expect(body.html).toBe('<p>Hello</p>');
    expect(body.from).toContain('ORACLE');
  });

  it('sends email with text body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'email_002' }),
    });

    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Hello plain text',
    });

    expect(result.success).toBe(true);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toBe('Hello plain text');
    expect(body.html).toBeUndefined();
  });

  it('sends email with all optional fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'email_003' }),
    });

    const result = await sendEmail({
      to: ['a@example.com', 'b@example.com'],
      cc: 'cc@example.com',
      bcc: 'bcc@example.com',
      subject: 'Full Test',
      html: '<p>Full</p>',
      replyTo: 'reply@example.com',
      headers: { 'X-Custom': 'value' },
      tags: [{ name: 'campaign', value: 'winter' }],
    });

    expect(result.success).toBe(true);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.to).toEqual(['a@example.com', 'b@example.com']);
    expect(body.cc).toEqual(['cc@example.com']);
    expect(body.bcc).toEqual(['bcc@example.com']);
    expect(body.reply_to).toBe('reply@example.com');
    expect(body.headers).toEqual({ 'X-Custom': 'value' });
    expect(body.tags).toEqual([{ name: 'campaign', value: 'winter' }]);
  });

  it('returns error when not configured', async () => {
    cleanEnv();
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles API error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ message: 'Invalid email address' }),
    });

    const result = await sendEmail({
      to: 'invalid',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid email address');
  });

  it('handles network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
  });

  it('handles non-Error throw', async () => {
    mockFetch.mockRejectedValueOnce('string error');
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('uses default from address when not configured', async () => {
    delete process.env.EMAIL_FROM_ADDRESS;
    delete process.env.EMAIL_FROM_NAME;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'email_004' }),
    });

    await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.from).toBe('ORACLE <oracle@oracle.app>');
  });

  it('uses custom from address when configured', async () => {
    setEnv({ EMAIL_FROM_ADDRESS: 'hi@agency.com', EMAIL_FROM_NAME: 'My Agency' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'email_005' }),
    });

    await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.from).toBe('My Agency <hi@agency.com>');
  });
});

// ─── sendBulkEmails ────────────────────

describe('sendBulkEmails', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    setEnv({ RESEND_API_KEY: 're_abc123' });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    cleanEnv();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sends to multiple recipients', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'email_bulk' }),
    });

    const results = await sendBulkEmails([
      { to: 'a@example.com', subject: 'A', html: '<p>A</p>' },
      { to: 'b@example.com', subject: 'B', html: '<p>B</p>' },
    ], 0);

    expect(results).toHaveLength(2);
    expect(results[0].to).toBe('a@example.com');
    expect(results[0].result.success).toBe(true);
    expect(results[1].to).toBe('b@example.com');
    expect(results[1].result.success).toBe(true);
  });

  it('handles empty messages list', async () => {
    const results = await sendBulkEmails([], 0);
    expect(results).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles mixed success and failure', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'e1' }) })
      .mockResolvedValueOnce({ ok: false, statusText: 'Error', json: () => Promise.resolve({ message: 'Failed' }) });

    const results = await sendBulkEmails([
      { to: 'a@example.com', subject: 'A', html: '<p>A</p>' },
      { to: 'b@example.com', subject: 'B', html: '<p>B</p>' },
    ], 0);

    expect(results).toHaveLength(2);
    expect(results[0].result.success).toBe(true);
    expect(results[1].result.success).toBe(false);
  });

  it('expands multiple recipients per message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'email_multi' }),
    });

    const results = await sendBulkEmails([
      { to: ['a@example.com', 'b@example.com'], subject: 'Multi', html: '<p>Multi</p>' },
    ], 0);

    expect(results).toHaveLength(2);
    expect(results[0].to).toBe('a@example.com');
    expect(results[1].to).toBe('b@example.com');
    expect(results[0].result.id).toBe('email_multi');
    expect(results[1].result.id).toBe('email_multi');
  });
});
