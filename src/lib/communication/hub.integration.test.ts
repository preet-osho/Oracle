// ═══════════════════════════════════════
// ORACLE — Communication Hub Integration Tests
// Full send flow · Templates · Bulk · Inbound · Error handling
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted Mocks (must be declared before vi.mock) ──

const { mockLogMessage, mockUpdateMessageStatus } = vi.hoisted(() => ({
  mockLogMessage: vi.fn(() => Promise.resolve('log_id_001')),
  mockUpdateMessageStatus: vi.fn(() => Promise.resolve(true)),
}));

// ─── Mocks ─────────────────────────────

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('./whatsapp', () => ({
  isWhatsAppConfigured: vi.fn(() => false),
  sendWhatsAppText: vi.fn(() => Promise.resolve({ success: true, messageId: 'wa_msg_001' })),
  sendWhatsAppTemplate: vi.fn(() => Promise.resolve({ success: true, messageId: 'wa_tpl_001' })),
}));

vi.mock('./email', () => ({
  isEmailConfigured: vi.fn(() => false),
  sendEmail: vi.fn(() => Promise.resolve({ success: true, id: 'email_001' })),
}));

vi.mock('./message-logger', () => ({
  logMessage: mockLogMessage,
  updateMessageStatus: mockUpdateMessageStatus,
  getMessageHistory: vi.fn(() => Promise.resolve([])),
  getMessageStats: vi.fn(() => Promise.resolve({ total: 0, byChannel: {}, byStatus: {}, byDirection: {} })),
}));

// ─── Import after mocks ────────────────

import {
  sendMessage,
  sendFromTemplate,
  bulkSend,
  handleInboundMessage,
  handleStatusUpdate,
  getChannelStatus,
} from './hub';
import { isWhatsAppConfigured, sendWhatsAppText, sendWhatsAppTemplate } from './whatsapp';
import { isEmailConfigured, sendEmail } from './email';
import type { SendMessageOptions } from './types';

// ─── Helpers ──────────────────────────

function makeWhatsAppSendOpts(overrides: Partial<SendMessageOptions> = {}): SendMessageOptions {
  return {
    channel: 'whatsapp',
    to: '+919876543210',
    body: 'Hello from ORACLE!',
    ...overrides,
  };
}

function makeEmailSendOpts(overrides: Partial<SendMessageOptions> = {}): SendMessageOptions {
  return {
    channel: 'email',
    to: 'test@example.com',
    subject: 'Test Subject',
    body: '<p>Hello from ORACLE!</p>',
    ...overrides,
  };
}

// ═══════════════════════════════════════
// Channel Status
// ═══════════════════════════════════════

describe('Communication Hub Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getChannelStatus', () => {
    it('reports both channels as unavailable when not configured', () => {
      vi.mocked(isWhatsAppConfigured).mockReturnValue(false);
      vi.mocked(isEmailConfigured).mockReturnValue(false);
      const status = getChannelStatus();
      expect(status.whatsapp).toBe(false);
      expect(status.email).toBe(false);
    });

    it('reports WhatsApp as available when configured', () => {
      vi.mocked(isWhatsAppConfigured).mockReturnValue(true);
      vi.mocked(isEmailConfigured).mockReturnValue(false);
      const status = getChannelStatus();
      expect(status.whatsapp).toBe(true);
      expect(status.email).toBe(false);
    });

    it('reports both channels as available when configured', () => {
      vi.mocked(isWhatsAppConfigured).mockReturnValue(true);
      vi.mocked(isEmailConfigured).mockReturnValue(true);
      const status = getChannelStatus();
      expect(status.whatsapp).toBe(true);
      expect(status.email).toBe(true);
    });
  });

  // ═══════════════════════════════════════
  // WhatsApp Send Flow
  // ═══════════════════════════════════════

  describe('WhatsApp Send Flow', () => {
    beforeEach(() => {
      vi.mocked(isWhatsAppConfigured).mockReturnValue(true);
    });

    it('sends a plain text WhatsApp message and logs it', async () => {
      const result = await sendMessage('user_1', makeWhatsAppSendOpts());

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wa_msg_001');
      expect(sendWhatsAppText).toHaveBeenCalledWith('+919876543210', 'Hello from ORACLE!');
      expect(mockLogMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_1',
          channel: 'whatsapp',
          direction: 'outbound',
          to: '+919876543210',
          body: 'Hello from ORACLE!',
          status: 'sent',
          providerMessageId: 'wa_msg_001',
        }),
      );
    });

    it('sends a template WhatsApp message when templateName is provided', async () => {
      const result = await sendMessage('user_1', makeWhatsAppSendOpts({
        templateName: 'welcome_template',
        templateLanguage: 'en_US',
      }));

      expect(result.success).toBe(true);
      expect(sendWhatsAppTemplate).toHaveBeenCalledWith('+919876543210', 'welcome_template', 'en_US');
      expect(result.messageId).toBe('wa_tpl_001');
    });

    it('uses default language en_US when templateLanguage is omitted', async () => {
      await sendMessage('user_1', makeWhatsAppSendOpts({
        templateName: 'welcome_template',
      }));

      expect(sendWhatsAppTemplate).toHaveBeenCalledWith('+919876543210', 'welcome_template', 'en_US');
    });

    it('returns error when WhatsApp is not configured', async () => {
      vi.mocked(isWhatsAppConfigured).mockReturnValue(false);

      const result = await sendMessage('user_1', makeWhatsAppSendOpts());

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
      expect(sendWhatsAppText).not.toHaveBeenCalled();
    });

    it('handles WhatsApp send failure gracefully', async () => {
      vi.mocked(sendWhatsAppText).mockResolvedValueOnce({
        success: false,
        error: 'Rate limit exceeded',
      });

      const result = await sendMessage('user_1', makeWhatsAppSendOpts());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
      expect(mockLogMessage).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', errorCode: 'Rate limit exceeded' }),
      );
    });

    it('includes clientId and leadId in the log entry', async () => {
      await sendMessage('user_1', makeWhatsAppSendOpts({
        clientId: 'client_abc',
        leadId: 'lead_xyz',
        metadata: { campaign: 'winter-sale' },
      }));

      expect(mockLogMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client_abc',
          leadId: 'lead_xyz',
          metadata: { campaign: 'winter-sale' },
        }),
      );
    });
  });

  // ═══════════════════════════════════════
  // Email Send Flow
  // ═══════════════════════════════════════

  describe('Email Send Flow', () => {
    beforeEach(() => {
      vi.mocked(isEmailConfigured).mockReturnValue(true);
    });

    it('sends an HTML email and logs it', async () => {
      const result = await sendMessage('user_1', makeEmailSendOpts());

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('email_001');
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Test Subject',
          html: '<p>Hello from ORACLE!</p>',
          text: undefined,
        }),
      );
      expect(mockLogMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_1',
          channel: 'email',
          direction: 'outbound',
          to: 'test@example.com',
          subject: 'Test Subject',
          status: 'sent',
          providerMessageId: 'email_001',
        }),
      );
    });

    it('sends plain text email when body has no HTML tags', async () => {
      const result = await sendMessage('user_1', makeEmailSendOpts({
        body: 'Hello, this is plain text.',
      }));

      expect(result.success).toBe(true);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Hello, this is plain text.',
          html: undefined,
        }),
      );
    });

    it('uses default subject when not provided', async () => {
      await sendMessage('user_1', makeEmailSendOpts({ subject: undefined }));

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Message from ORACLE' }),
      );
    });

    it('returns error when Email is not configured', async () => {
      vi.mocked(isEmailConfigured).mockReturnValue(false);

      const result = await sendMessage('user_1', makeEmailSendOpts());

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('handles email send failure gracefully', async () => {
      vi.mocked(sendEmail).mockResolvedValueOnce({
        success: false,
        error: 'Invalid email address',
      });

      const result = await sendMessage('user_1', makeEmailSendOpts());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email address');
      expect(mockLogMessage).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', errorCode: 'Invalid email address' }),
      );
    });

    it('includes tags in email options', async () => {
      await sendMessage('user_1', makeEmailSendOpts({
        clientId: 'client_xyz',
      }));

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: [{ name: 'client_id', value: 'client_xyz' }],
        }),
      );
    });
  });

  // ═══════════════════════════════════════
  // Unknown Channel
  // ═══════════════════════════════════════

  describe('Unknown Channel', () => {
    it('returns error for unknown channel type', async () => {
      const result = await sendMessage('user_1', {
        channel: 'sms' as 'whatsapp',
        to: '+919876543210',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown channel');
    });
  });

  // ═══════════════════════════════════════
  // Template-Based Sending
  // ═══════════════════════════════════════

  describe('sendFromTemplate', () => {
    beforeEach(() => {
      vi.mocked(isWhatsAppConfigured).mockReturnValue(true);
      vi.mocked(isEmailConfigured).mockReturnValue(true);
    });

    it('sends a WhatsApp template message with variable substitution', async () => {
      const result = await sendFromTemplate(
        'user_1',
        'wa-cold-outreach-local',
        {
          client_name: 'Rahul',
          business_name: 'TechCorp',
          sender_name: 'Preet',
          agency_name: 'ORACLE Digital',
          pain_points: '• No Google Business Profile',
          city: 'Mumbai',
        },
        '+919876543210',
      );

      expect(result.success).toBe(true);
      expect(sendWhatsAppText).toHaveBeenCalledWith(
        '+919876543210',
        expect.stringContaining('Rahul'),
      );
      expect(sendWhatsAppText).toHaveBeenCalledWith(
        '+919876543210',
        expect.stringContaining('TechCorp'),
      );
    });

    it('sends an email template with subject substitution', async () => {
      const result = await sendFromTemplate(
        'user_1',
        'email-cold-outreach',
        {
          client_name: 'Priya',
          business_name: 'StyleStudio',
          sender_name: 'Preet',
          agency_name: 'ORACLE Digital',
          industry: 'fashion',
          pain_points: '• Weak social media presence',
          result_1: '3x more leads',
          result_2: '40% lower cost per lead',
          phone: '+919876543210',
        },
        'priya@stylestudio.com',
      );

      expect(result.success).toBe(true);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'priya@stylestudio.com',
          subject: expect.stringContaining('StyleStudio'),
        }),
      );
    });

    it('returns error for non-existent template', async () => {
      const result = await sendFromTemplate(
        'user_1',
        'nonexistent-template',
        {},
        '+919876543210',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template not found');
    });

    it('returns error when required variables are missing', async () => {
      const result = await sendFromTemplate(
        'user_1',
        'wa-cold-outreach-local',
        { client_name: 'Rahul' }, // Missing business_name, sender_name, etc.
        '+919876543210',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing template variables');
    });

    it('passes clientId and leadId to sendMessage', async () => {
      await sendFromTemplate(
        'user_1',
        'wa-cold-outreach-local',
        {
          client_name: 'Rahul',
          business_name: 'TechCorp',
          sender_name: 'Preet',
          agency_name: 'ORACLE Digital',
          pain_points: '• Weak SEO',
          city: 'Mumbai',
        },
        '+919876543210',
        undefined,
        { clientId: 'client_1', leadId: 'lead_1' },
      );

      expect(mockLogMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client_1',
          leadId: 'lead_1',
        }),
      );
    });
  });

  // ═══════════════════════════════════════
  // Bulk Send
  // ═══════════════════════════════════════

  describe('bulkSend', () => {
    beforeEach(() => {
      vi.mocked(isWhatsAppConfigured).mockReturnValue(true);
    });

    it('sends to multiple recipients and tracks results', async () => {
      const result = await bulkSend('user_1', {
        channel: 'whatsapp',
        recipients: [
          { to: '+919876543210', body: 'Message 1' },
          { to: '+919876543211', body: 'Message 2' },
          { to: '+919876543212', body: 'Message 3' },
        ],
        delayMs: 0, // No delay in tests
      });

      expect(result.total).toBe(3);
      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.results[0]).toEqual({ to: '+919876543210', success: true });
      expect(result.results[1]).toEqual({ to: '+919876543211', success: true });
      expect(result.results[2]).toEqual({ to: '+919876543212', success: true });
    });

    it('tracks mixed success/failure results', async () => {
      vi.mocked(sendWhatsAppText)
        .mockResolvedValueOnce({ success: true, messageId: 'wa_1' })
        .mockResolvedValueOnce({ success: false, error: 'Invalid number' })
        .mockResolvedValueOnce({ success: true, messageId: 'wa_3' });

      const result = await bulkSend('user_1', {
        channel: 'whatsapp',
        recipients: [
          { to: '+919876543210', body: 'Message 1' },
          { to: 'invalid', body: 'Message 2' },
          { to: '+919876543212', body: 'Message 3' },
        ],
        delayMs: 0,
      });

      expect(result.total).toBe(3);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results[1]?.success).toBe(false);
      expect(result.results[1]?.error).toBe('Invalid number');
    });

    it('handles empty recipients list', async () => {
      const result = await bulkSend('user_1', {
        channel: 'whatsapp',
        recipients: [],
        delayMs: 0,
      });

      expect(result.total).toBe(0);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('logs each message with clientId and leadId', async () => {
      await bulkSend('user_1', {
        channel: 'whatsapp',
        recipients: [
          { to: '+919876543210', body: 'Hello' },
        ],
        clientId: 'client_bulk',
        leadId: 'lead_bulk',
        delayMs: 0,
      });

      expect(mockLogMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client_bulk',
          leadId: 'lead_bulk',
          channel: 'whatsapp',
        }),
      );
    });
  });

  // ═══════════════════════════════════════
  // Inbound Message Handling
  // ═══════════════════════════════════════

  describe('Inbound Message Handling', () => {
    it('logs inbound WhatsApp messages', async () => {
      await handleInboundMessage('user_1', {
        from: '+919876543210',
        text: 'I am interested in your services',
        messageId: 'wa_inbound_001',
        timestamp: Date.now(),
        contactName: 'Rahul',
      });

      expect(mockLogMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_1',
          channel: 'whatsapp',
          direction: 'inbound',
          from: '+919876543210',
          body: 'I am interested in your services',
          providerMessageId: 'wa_inbound_001',
          status: 'delivered',
          metadata: expect.objectContaining({
            contactName: 'Rahul',
          }),
        }),
      );
    });

    it('handles inbound messages without contact name', async () => {
      await handleInboundMessage('user_1', {
        from: '+919876543210',
        text: 'Hello',
        messageId: 'wa_inbound_002',
        timestamp: Date.now(),
      });

      expect(mockLogMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'inbound',
          body: 'Hello',
          status: 'delivered',
        }),
      );
    });
  });

  // ═══════════════════════════════════════
  // Status Updates
  // ═══════════════════════════════════════

  describe('Status Updates', () => {
    it('updates message status to delivered', async () => {
      await handleStatusUpdate('wa_msg_001', 'delivered');

      expect(mockUpdateMessageStatus).toHaveBeenCalledWith('wa_msg_001', 'delivered', undefined);
    });

    it('updates message status to read', async () => {
      await handleStatusUpdate('wa_msg_001', 'read');

      expect(mockUpdateMessageStatus).toHaveBeenCalledWith('wa_msg_001', 'read', undefined);
    });

    it('updates message status to failed with error code', async () => {
      await handleStatusUpdate('wa_msg_001', 'failed', 131026);

      expect(mockUpdateMessageStatus).toHaveBeenCalledWith('wa_msg_001', 'failed', '131026');
    });

    it('updates message status to sent', async () => {
      await handleStatusUpdate('wa_msg_001', 'sent');

      expect(mockUpdateMessageStatus).toHaveBeenCalledWith('wa_msg_001', 'sent', undefined);
    });
  });
});
