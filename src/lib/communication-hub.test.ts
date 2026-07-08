// ═══════════════════════════════════════
// ORACLE — Communication Hub Tests
// Tests for email-service.ts, whatsapp.ts, and communication-hub.ts
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isValidEmail,
  isValidWhatsAppNumber,
  getCommunicationStats,
} from '@/lib/communication-hub';
import { getChannelIcon } from '@/lib/communication-log';
import {
  isValidIndianPhone,
  getCountryCode,
  maskPhoneNumber,
} from '@/lib/whatsapp';

// ─── Email Validation Tests ─────────────

describe('Email Validation', () => {
  it('validates correct email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('test.user@domain.co.in')).toBe(true);
    expect(isValidEmail('oracle@oracledigital.in')).toBe(true);
  });

  it('rejects invalid email addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user@.com')).toBe(false);
    expect(isValidEmail('user@domain')).toBe(false);
    expect(isValidEmail('user domain@test.com')).toBe(false);
  });

  it('handles edge cases', () => {
    expect(isValidEmail('user+tag@example.com')).toBe(true);
    expect(isValidEmail('user-name@domain.com')).toBe(true);
    expect(isValidEmail('user_name@domain.com')).toBe(true);
  });
});

// ─── WhatsApp Number Validation Tests ───

describe('WhatsApp Number Validation', () => {
  it('validates E.164 format numbers', () => {
    expect(isValidWhatsAppNumber('+1234567890')).toBe(true);
    expect(isValidWhatsAppNumber('+919876543210')).toBe(true);
    expect(isValidWhatsAppNumber('+447911123456')).toBe(true);
  });

  it('validates whatsapp: prefixed numbers', () => {
    expect(isValidWhatsAppNumber('whatsapp:+1234567890')).toBe(true);
    expect(isValidWhatsAppNumber('whatsapp:+919876543210')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidWhatsAppNumber('1234567890')).toBe(false);
    expect(isValidWhatsAppNumber('+0123456789')).toBe(false);
    expect(isValidWhatsAppNumber('abc')).toBe(false);
    expect(isValidWhatsAppNumber('')).toBe(false);
  });
});

// ─── Indian Phone Validation Tests ──────

describe('Indian Phone Validation', () => {
  it('validates 10-digit Indian mobile numbers', () => {
    expect(isValidIndianPhone('9876543210')).toBe(true);
    expect(isValidIndianPhone('8765432109')).toBe(true);
    expect(isValidIndianPhone('7654321098')).toBe(true);
    expect(isValidIndianPhone('6543210987')).toBe(true);
  });

  it('validates with country code', () => {
    expect(isValidIndianPhone('+919876543210')).toBe(true);
    expect(isValidIndianPhone('919876543210')).toBe(true);
  });

  it('rejects invalid numbers', () => {
    expect(isValidIndianPhone('1234567890')).toBe(false); // Starts with 1
    expect(isValidIndianPhone('5678901234')).toBe(false); // Starts with 5
    expect(isValidIndianPhone('12345')).toBe(false); // Too short
  });
});

// ─── Country Code Extraction Tests ──────

describe('Country Code Extraction', () => {
  it('extracts country code from phone numbers', () => {
    expect(getCountryCode('+919876543210')).toBe('+91');
    expect(getCountryCode('+1234567890')).toBe('+1');
    expect(getCountryCode('919876543210')).toBe('+91');
  });

  it('defaults to India for ambiguous numbers', () => {
    expect(getCountryCode('1234567890')).toBe('+91');
  });
});

// ─── Phone Number Masking Tests ─────────

describe('Phone Number Masking', () => {
  it('masks phone numbers correctly', () => {
    expect(maskPhoneNumber('+919876543210')).toBe('919*******10');
    expect(maskPhoneNumber('9876543210')).toBe('987*****10');
    expect(maskPhoneNumber('12345')).toBe('12345'); // Too short to mask
  });
});

// ─── Channel Icon Tests ─────────────────

describe('Channel Icons', () => {
  it('returns correct icons for channels', () => {
    expect(getChannelIcon('email')).toBe('📧');
    expect(getChannelIcon('whatsapp')).toBe('💬');
  });
});

// ─── Communication Stats Tests ─────────

describe('Communication Stats', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default stats when empty', () => {
    const stats = getCommunicationStats();
    expect(stats.totalSent).toBe(0);
    expect(stats.emailsSent).toBe(0);
    expect(stats.whatsappSent).toBe(0);
    expect(stats.failed).toBe(0);
    expect(stats.lastSentAt).toBeNull();
  });

  it('handles storage errors gracefully', () => {
    // Mock localStorage to throw
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = vi.fn(() => {
      throw new Error('Storage error');
    });

    const stats = getCommunicationStats();
    expect(stats.totalSent).toBe(0);

    localStorage.getItem = originalGetItem;
  });
});

// ─── Email Service Tests ────────────────

describe('Email Service', () => {
  it('exports expected functions', async () => {
    const emailService = await import('@/lib/email-service');
    expect(typeof emailService.sendEmail).toBe('function');
    expect(typeof emailService.sendTemplateEmail).toBe('function');
    expect(typeof emailService.sendBulkEmail).toBe('function');
    expect(typeof emailService.sendPasswordResetEmail).toBe('function');
    expect(typeof emailService.sendInvitationEmail).toBe('function');
    expect(typeof emailService.checkEmailServiceHealth).toBe('function');
  });

  it('checkEmailServiceHealth returns health status', async () => {
    const { checkEmailServiceHealth } = await import('@/lib/email-service');
    const health = await checkEmailServiceHealth();

    expect(health).toHaveProperty('resend');
    expect(health).toHaveProperty('sendgrid');
    expect(health).toHaveProperty('preferred');
    expect(typeof health.resend).toBe('boolean');
    expect(typeof health.sendgrid).toBe('boolean');
    expect(['resend', 'sendgrid']).toContain(health.preferred);
  });
});

// ─── WhatsApp Service Tests ─────────────

describe('WhatsApp Service', () => {
  it('exports expected functions', async () => {
    const whatsappService = await import('@/lib/whatsapp');
    expect(typeof whatsappService.sendWhatsAppMessage).toBe('function');
    expect(typeof whatsappService.sendWhatsAppMedia).toBe('function');
    expect(typeof whatsappService.sendWhatsAppTemplate).toBe('function');
    expect(typeof whatsappService.sendBulkWhatsApp).toBe('function');
    expect(typeof whatsappService.getMessageStatus).toBe('function');
    expect(typeof whatsappService.getRecentMessages).toBe('function');
    expect(typeof whatsappService.listTemplates).toBe('function');
    expect(typeof whatsappService.checkWhatsAppHealth).toBe('function');
  });

  it('checkWhatsAppHealth returns health status', async () => {
    const { checkWhatsAppHealth } = await import('@/lib/whatsapp');
    const health = await checkWhatsAppHealth();

    expect(health).toHaveProperty('configured');
    expect(health).toHaveProperty('fromNumber');
    expect(health).toHaveProperty('accountSid');
    expect(typeof health.configured).toBe('boolean');
    expect(typeof health.fromNumber).toBe('string');
  });
});
