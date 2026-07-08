// ═══════════════════════════════════════
// ORACLE — WhatsApp Client Tests
// Webhook parsing + Send functions + Mark as Read
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
  parseWebhook,
  isWhatsAppConfigured,
  sendWhatsAppText,
  sendWhatsAppTemplate,
  sendWhatsAppInteractive,
  markAsRead,
} from './whatsapp';

// ─── Helpers ──────────────────────────

const ENV_KEYS = [
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_WABA_ID',
  'WHATSAPP_API_URL',
];

function setEnv(overrides: Record<string, string>) {
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
}

function cleanEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

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

// ─── isWhatsAppConfigured ──────────────

describe('isWhatsAppConfigured', () => {
  afterEach(() => cleanEnv());

  it('returns true when both credentials are set', () => {
    setEnv({ WHATSAPP_PHONE_NUMBER_ID: 'pn_123', WHATSAPP_ACCESS_TOKEN: 'tok_abc' });
    expect(isWhatsAppConfigured()).toBe(true);
  });

  it('returns false when phone number ID is missing', () => {
    setEnv({ WHATSAPP_ACCESS_TOKEN: 'tok_abc' });
    expect(isWhatsAppConfigured()).toBe(false);
  });

  it('returns false when access token is missing', () => {
    setEnv({ WHATSAPP_PHONE_NUMBER_ID: 'pn_123' });
    expect(isWhatsAppConfigured()).toBe(false);
  });

  it('returns false when both are missing', () => {
    cleanEnv();
    expect(isWhatsAppConfigured()).toBe(false);
  });
});

// ─── sendWhatsAppText ──────────────────

describe('sendWhatsAppText', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    setEnv({ WHATSAPP_PHONE_NUMBER_ID: 'pn_123', WHATSAPP_ACCESS_TOKEN: 'tok_abc' });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    cleanEnv();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sends text message and returns success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wa_msg_001' }] }),
    });

    const result = await sendWhatsAppText('+919876543210', 'Hello!');

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('wa_msg_001');
    expect(result.status).toBe('sent');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v21.0/pn_123/messages',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns error when not configured', async () => {
    cleanEnv();
    const result = await sendWhatsAppText('+919876543210', 'Hello!');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles API error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ error: { message: 'Invalid parameter', code: 100 } }),
    });

    const result = await sendWhatsAppText('+919876543210', 'Hello!');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid parameter');
    expect(result.errorCode).toBe(100);
  });

  it('handles network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));
    const result = await sendWhatsAppText('+919876543210', 'Hello!');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network timeout');
  });

  it('handles non-Error throw', async () => {
    mockFetch.mockRejectedValueOnce('string error');
    const result = await sendWhatsAppText('+919876543210', 'Hello!');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('normalizes 10-digit Indian phone numbers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wa_msg_002' }] }),
    });

    await sendWhatsAppText('9876543210', 'Hello!');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.to).toBe('919876543210');
  });

  it('normalizes phone with spaces and dashes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wa_msg_003' }] }),
    });

    await sendWhatsAppText('+91 987-654-3210', 'Hello!');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.to).toBe('919876543210');
  });

  it('passes correct message structure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wa_msg_004' }] }),
    });

    await sendWhatsAppText('+919876543210', 'Test message');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messaging_product).toBe('whatsapp');
    expect(body.type).toBe('text');
    expect(body.text.body).toBe('Test message');
  });

  it('uses custom API URL when set', async () => {
    setEnv({ WHATSAPP_API_URL: 'https://custom.api/v20.0' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wa_msg_005' }] }),
    });

    await sendWhatsAppText('+919876543210', 'Hello!');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://custom.api/v20.0/pn_123/messages',
      expect.anything(),
    );
  });
});

// ─── sendWhatsAppTemplate ──────────────

describe('sendWhatsAppTemplate', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    setEnv({ WHATSAPP_PHONE_NUMBER_ID: 'pn_123', WHATSAPP_ACCESS_TOKEN: 'tok_abc' });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    cleanEnv();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sends template message without parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wa_tpl_001' }] }),
    });

    const result = await sendWhatsAppTemplate('+919876543210', 'welcome', 'en_US');

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('wa_tpl_001');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe('template');
    expect(body.template.name).toBe('welcome');
    expect(body.template.language.code).toBe('en_US');
    expect(body.template.components).toBeUndefined();
  });

  it('sends template message with parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wa_tpl_002' }] }),
    });

    const result = await sendWhatsAppTemplate('+919876543210', 'order_update', 'en_US', [
      { type: 'text', text: 'Order #123' },
      { type: 'text', text: 'Shipped' },
    ]);

    expect(result.success).toBe(true);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.template.components).toHaveLength(1);
    expect(body.template.components[0].type).toBe('body');
    expect(body.template.components[0].parameters).toHaveLength(2);
    expect(body.template.components[0].parameters[0].text).toBe('Order #123');
  });

  it('uses default language code en_US', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wa_tpl_003' }] }),
    });

    await sendWhatsAppTemplate('+919876543210', 'welcome');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.template.language.code).toBe('en_US');
  });

  it('returns error when not configured', async () => {
    cleanEnv();
    const result = await sendWhatsAppTemplate('+919876543210', 'welcome');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('handles API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Forbidden',
      json: () => Promise.resolve({ error: { message: 'Template not found', code: 300 } }),
    });

    const result = await sendWhatsAppTemplate('+919876543210', 'nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Template not found');
    expect(result.errorCode).toBe(300);
  });

  it('handles network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
    const result = await sendWhatsAppTemplate('+919876543210', 'welcome');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
  });
});

// ─── sendWhatsAppInteractive ──────────

describe('sendWhatsAppInteractive', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    setEnv({ WHATSAPP_PHONE_NUMBER_ID: 'pn_123', WHATSAPP_ACCESS_TOKEN: 'tok_abc' });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    cleanEnv();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sends interactive message with buttons', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wa_int_001' }] }),
    });

    const result = await sendWhatsAppInteractive(
      '+919876543210',
      'Quick Question',
      'Are you interested in our services?',
      'Tap to reply',
      [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }],
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('wa_int_001');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe('interactive');
    expect(body.interactive.type).toBe('button');
    expect(body.interactive.header.text).toBe('Quick Question');
    expect(body.interactive.body.text).toBe('Are you interested in our services?');
    expect(body.interactive.footer.text).toBe('Tap to reply');
    expect(body.interactive.action.buttons).toHaveLength(2);
    expect(body.interactive.action.buttons[0].reply.id).toBe('yes');
    expect(body.interactive.action.buttons[0].reply.title).toBe('Yes');
    expect(body.interactive.action.buttons[1].reply.id).toBe('no');
  });

  it('returns error when not configured', async () => {
    cleanEnv();
    const result = await sendWhatsAppInteractive(
      '+919876543210', 'H', 'B', 'F', [{ id: 'ok', title: 'OK' }],
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('handles API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ error: { message: 'Invalid interactive format', code: 200 } }),
    });

    const result = await sendWhatsAppInteractive(
      '+919876543210', 'H', 'B', 'F', [{ id: 'ok', title: 'OK' }],
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid interactive format');
  });

  it('handles network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Timeout'));
    const result = await sendWhatsAppInteractive(
      '+919876543210', 'H', 'B', 'F', [{ id: 'ok', title: 'OK' }],
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('Timeout');
  });
});

// ─── markAsRead ────────────────────────

describe('markAsRead', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    setEnv({ WHATSAPP_PHONE_NUMBER_ID: 'pn_123', WHATSAPP_ACCESS_TOKEN: 'tok_abc' });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    cleanEnv();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('marks message as read successfully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await markAsRead('wa_msg_001');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v21.0/pn_123/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: 'wa_msg_001',
        }),
      }),
    );
  });

  it('returns false when not configured', async () => {
    cleanEnv();
    const result = await markAsRead('wa_msg_001');
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns false on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await markAsRead('wa_msg_001');
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await markAsRead('wa_msg_001');
    expect(result).toBe(false);
  });
});
