// ═══════════════════════════════════════
// ORACLE — WhatsApp Social Client Tests
// Broadcasts, text/media messages, templates
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockFetchWithTimeout } = vi.hoisted(() => ({
  mockFetchWithTimeout: vi.fn(),
}));

vi.mock('@/lib/fetch-utils', () => ({
  fetchWithTimeout: mockFetchWithTimeout,
  TIMEOUT_MODERATE_MS: 15000,
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  isWhatsAppSocialConfigured,
  sendTemplateBroadcast,
  sendTextMessage,
  sendMediaMessage,
  listTemplates,
} from './whatsapp-social';

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) process.env[k] = v;
}

function cleanEnv() {
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_WABA_ID;
}

function mockResp(ok: boolean, body?: unknown) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(body ?? {}),
    text: () => Promise.resolve(JSON.stringify(body ?? {})),
  };
}

describe('WhatsApp Social Client', () => {
  afterEach(() => { cleanEnv(); vi.clearAllMocks(); });

  describe('isWhatsAppSocialConfigured', () => {
    it('returns true when tokens set', () => {
      setEnv({ WHATSAPP_PHONE_NUMBER_ID: 'pn_1', WHATSAPP_ACCESS_TOKEN: 'tok' });
      expect(isWhatsAppSocialConfigured()).toBe(true);
    });
    it('returns false when phone number ID missing', () => {
      setEnv({ WHATSAPP_ACCESS_TOKEN: 'tok' });
      expect(isWhatsAppSocialConfigured()).toBe(false);
    });
    it('returns false when access token missing', () => {
      setEnv({ WHATSAPP_PHONE_NUMBER_ID: 'pn_1' });
      expect(isWhatsAppSocialConfigured()).toBe(false);
    });
    it('returns false when both missing', () => {
      expect(isWhatsAppSocialConfigured()).toBe(false);
    });
  });

  describe('sendTextMessage', () => {
    beforeEach(() => setEnv({ WHATSAPP_PHONE_NUMBER_ID: 'pn_1', WHATSAPP_ACCESS_TOKEN: 'tok' }));

    it('sends text and returns success', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(true, { messages: [{ id: 'wa_msg_001' }] }));
      const result = await sendTextMessage('+919876543210', 'Hello!');
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wa_msg_001');
    });

    it('returns error when not configured', async () => {
      cleanEnv();
      const result = await sendTextMessage('+919876543210', 'Hello');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('handles API error', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(false, { error: { message: 'Invalid number' } }));
      const result = await sendTextMessage('invalid', 'Hello');
      expect(result.success).toBe(false);
    });

    it('handles network error', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Timeout'));
      const result = await sendTextMessage('+919876543210', 'Hello');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout');
    });

    it('handles non-Error throw', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce('string');
      const result = await sendTextMessage('+919876543210', 'Hello');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('sendTemplateBroadcast', () => {
    beforeEach(() => setEnv({ WHATSAPP_PHONE_NUMBER_ID: 'pn_1', WHATSAPP_ACCESS_TOKEN: 'tok' }));

    it('sends to multiple recipients', async () => {
      mockFetchWithTimeout.mockResolvedValue(mockResp(true, { messages: [{ id: 'msg_1' }] }));
      const result = await sendTemplateBroadcast('welcome', ['+911111111111', '+912222222222'], 'en_US');
      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });

    it('tracks failures separately', async () => {
      mockFetchWithTimeout
        .mockResolvedValueOnce(mockResp(true, { messages: [{ id: 'msg_1' }] }))
        .mockResolvedValueOnce(mockResp(false, { error: { message: 'Undeliverable' } }));
      const result = await sendTemplateBroadcast('welcome', ['+911111111111', 'invalid']);
      expect(result.sentCount).toBe(1);
      expect(result.failedCount).toBe(1);
    });

    it('returns error when not configured', async () => {
      cleanEnv();
      const result = await sendTemplateBroadcast('welcome', ['+911111111111']);
      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
    });

    it('sends with template variables', async () => {
      mockFetchWithTimeout.mockResolvedValue(mockResp(true, { messages: [{ id: 'msg_1' }] }));
      await sendTemplateBroadcast('order_update', ['+911111111111'], 'en_US', [{ name: 'Rahul' }]);
      const body = JSON.parse(mockFetchWithTimeout.mock.calls[0][1].body);
      expect(body.template.components).toHaveLength(1);
      expect(body.template.components[0].parameters[0].text).toBe('Rahul');
    });

    it('handles network error on individual send', async () => {
      mockFetchWithTimeout.mockRejectedValue(new Error('Timeout'));
      const result = await sendTemplateBroadcast('welcome', ['+911111111111']);
      expect(result.sentCount).toBe(0);
      expect(result.failedCount).toBe(1);
    });
  });

  describe('sendMediaMessage', () => {
    beforeEach(() => setEnv({ WHATSAPP_PHONE_NUMBER_ID: 'pn_1', WHATSAPP_ACCESS_TOKEN: 'tok' }));

    it('uploads media then sends message', async () => {
      mockFetchWithTimeout
        .mockResolvedValueOnce(mockResp(true, { id: 'media_1' }))
        .mockResolvedValueOnce(mockResp(true, { messages: [{ id: 'wa_media_001' }] }));
      const result = await sendMediaMessage('+919876543210', 'https://img.jpg', 'Check this');
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wa_media_001');
    });

    it('returns error when not configured', async () => {
      cleanEnv();
      const result = await sendMediaMessage('+919876543210', 'https://img.jpg');
      expect(result.success).toBe(false);
    });

    it('handles send failure', async () => {
      mockFetchWithTimeout
        .mockResolvedValueOnce(mockResp(true, { id: 'media_1' }))
        .mockResolvedValueOnce(mockResp(false, { error: { message: 'Send failed' } }));
      const result = await sendMediaMessage('+919876543210', 'https://img.jpg');
      expect(result.success).toBe(false);
    });

    it('handles network error', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Timeout'));
      const result = await sendMediaMessage('+919876543210', 'https://img.jpg');
      expect(result.success).toBe(false);
    });
  });

  describe('listTemplates', () => {
    beforeEach(() => setEnv({
      WHATSAPP_PHONE_NUMBER_ID: 'pn_1',
      WHATSAPP_ACCESS_TOKEN: 'tok',
      WHATSAPP_WABA_ID: 'waba_1',
    }));

    it('returns template list', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(true, {
        data: [{ name: 'welcome', language: 'en_US', status: 'APPROVED', category: 'UTILITY' }],
      }));
      const templates = await listTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('welcome');
    });

    it('returns empty when not configured', async () => {
      cleanEnv();
      expect(await listTemplates()).toHaveLength(0);
    });

    it('returns empty when wabaId is missing', async () => {
      setEnv({ WHATSAPP_PHONE_NUMBER_ID: 'pn_1', WHATSAPP_ACCESS_TOKEN: 'tok' });
      expect(await listTemplates()).toHaveLength(0);
    });

    it('returns empty on error', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('fail'));
      expect(await listTemplates()).toHaveLength(0);
    });
  });
});
