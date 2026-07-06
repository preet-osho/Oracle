// ═══════════════════════════════════════
// ORACLE — WhatsApp Client Tests
// ═══════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { parseWebhook } from './whatsapp';

// ─── Webhook Parsing ───────────────────

describe('parseWebhook', () => {
  it('parses incoming text message', () => {
    const body = {
      entry: [{
        id: '123',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '911234567890',
              phone_number_id: 'pn_123',
            },
            contacts: [{
              wa_id: '919876543210',
              profile: { name: 'Rahul Sharma' },
            }],
            messages: [{
              from: '919876543210',
              id: 'msg_001',
              timestamp: '1700000000',
              type: 'text',
              text: { body: 'Hello!' },
            }],
          },
          field: 'messages',
        }],
      }],
    };

    const result = parseWebhook(body);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].from).toBe('919876543210');
    expect(result.messages[0].text).toBe('Hello!');
    expect(result.messages[0].contactName).toBe('Rahul Sharma');
  });

  it('parses status updates', () => {
    const body = {
      entry: [{
        id: '123',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '911234567890',
              phone_number_id: 'pn_123',
            },
            statuses: [{
              id: 'msg_001',
              status: 'delivered',
              timestamp: '1700000001',
            }],
          },
          field: 'messages',
        }],
      }],
    };

    const result = parseWebhook(body);
    expect(result.statuses).toHaveLength(1);
    expect(result.statuses[0].status).toBe('delivered');
    expect(result.statuses[0].messageId).toBe('msg_001');
  });

  it('handles failed status with error', () => {
    const body = {
      entry: [{
        id: '123',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '911234567890',
              phone_number_id: 'pn_123',
            },
            statuses: [{
              id: 'msg_002',
              status: 'failed',
              timestamp: '1700000002',
              errors: [{ code: 131026, message: 'Message undeliverable' }],
            }],
          },
          field: 'messages',
        }],
      }],
    };

    const result = parseWebhook(body);
    expect(result.statuses).toHaveLength(1);
    expect(result.statuses[0].status).toBe('failed');
    expect(result.statuses[0].errorCode).toBe(131026);
    expect(result.statuses[0].errorMessage).toBe('Message undeliverable');
  });

  it('handles empty/invalid payload gracefully', () => {
    expect(parseWebhook({})).toEqual({ messages: [], statuses: [] });
    expect(parseWebhook(null)).toEqual({ messages: [], statuses: [] });
    expect(parseWebhook(undefined)).toEqual({ messages: [], statuses: [] });
  });

  it('handles multiple messages in one webhook', () => {
    const body = {
      entry: [{
        id: '123',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '911234567890',
              phone_number_id: 'pn_123',
            },
            contacts: [
              { wa_id: '911111111111', profile: { name: 'User A' } },
              { wa_id: '912222222222', profile: { name: 'User B' } },
            ],
            messages: [
              { from: '911111111111', id: 'msg_a', timestamp: '1700000000', type: 'text', text: { body: 'Hi' } },
              { from: '912222222222', id: 'msg_b', timestamp: '1700000001', type: 'text', text: { body: 'Hello' } },
            ],
          },
          field: 'messages',
        }],
      }],
    };

    const result = parseWebhook(body);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].contactName).toBe('User A');
    expect(result.messages[1].contactName).toBe('User B');
  });

  it('handles message without text body', () => {
    const body = {
      entry: [{
        id: '123',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '911234567890',
              phone_number_id: 'pn_123',
            },
            messages: [{
              from: '919876543210',
              id: 'msg_img',
              timestamp: '1700000000',
              type: 'image',
            }],
          },
          field: 'messages',
        }],
      }],
    };

    const result = parseWebhook(body);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].text).toBe('');
  });
});

// ─── Phone Normalization (via sendWhatsAppText) ──
// Note: Phone normalization is internal to the module.
// We test it indirectly via the webhook parsing.

describe('Webhook timestamp handling', () => {
  it('converts string timestamps to numbers', () => {
    const body = {
      entry: [{
        id: '123',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '911234567890', phone_number_id: 'pn_123' },
            messages: [{
              from: '919876543210',
              id: 'msg_ts',
              timestamp: '1700000000',
              type: 'text',
              text: { body: 'test' },
            }],
          },
          field: 'messages',
        }],
      }],
    };

    const result = parseWebhook(body);
    expect(typeof result.messages[0].timestamp).toBe('number');
    expect(result.messages[0].timestamp).toBe(1700000000);
  });
});
