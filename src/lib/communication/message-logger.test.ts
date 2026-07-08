// ═══════════════════════════════════════
// ORACLE — Message Logger Tests
// Supabase audit trail for all messages
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted Mocks ─────────────────────

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

// ─── Helpers ──────────────────────────

function setEnv(overrides: Record<string, string>) {
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
}

function cleanEnv() {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// ─── Tests ────────────────────────────

describe('Message Logger', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service_role_key',
    });
  });

  afterEach(() => {
    cleanEnv();
  });

  describe('logMessage', () => {
    it('inserts message log to Supabase and returns id', async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'log_001' }, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ insert: mockInsert }) });

      // Dynamic import to pick up fresh mock
      const { logMessage } = await import('./message-logger');

      const id = await logMessage({
        userId: 'user_1',
        channel: 'whatsapp',
        direction: 'outbound',
        to: '+919876543210',
        from: 'pn_123',
        body: 'Hello!',
        status: 'sent',
        providerMessageId: 'wa_msg_001',
      });

      expect(id).toBe('log_001');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user_1',
          channel: 'whatsapp',
          direction: 'outbound',
          to: '+919876543210',
          body: 'Hello!',
          status: 'sent',
          provider_message_id: 'wa_msg_001',
        }),
      );
    });

    it('returns null when Supabase is not configured', async () => {
      cleanEnv();

      const { logMessage } = await import('./message-logger');

      const id = await logMessage({
        userId: 'user_1',
        channel: 'whatsapp',
        direction: 'outbound',
        to: '+919876543210',
        from: 'pn_123',
        body: 'Hello!',
        status: 'sent',
      });

      expect(id).toBeNull();
    });

    it('returns null on database error', async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ insert: mockInsert }) });

      const { logMessage } = await import('./message-logger');

      const id = await logMessage({
        userId: 'user_1',
        channel: 'email',
        direction: 'outbound',
        to: 'test@example.com',
        from: 'oracle@oracle.app',
        body: 'Test email',
        status: 'sent',
      });

      expect(id).toBeNull();
    });

    it('returns null on network error', async () => {
      mockCreateClient.mockReturnValue({
        from: vi.fn().mockImplementation(() => { throw new Error('Network error'); }),
      });

      const { logMessage } = await import('./message-logger');

      const id = await logMessage({
        userId: 'user_1',
        channel: 'whatsapp',
        direction: 'outbound',
        to: '+919876543210',
        from: 'pn_123',
        body: 'Hello!',
        status: 'sent',
      });

      expect(id).toBeNull();
    });

    it('includes all optional fields in the insert', async () => {
      let insertedRow: Record<string, unknown> = {};
      const mockInsert = vi.fn().mockImplementation((row: Record<string, unknown>) => {
        insertedRow = row;
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'log_002' }, error: null }),
          }),
        };
      });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ insert: mockInsert }) });

      const { logMessage } = await import('./message-logger');

      await logMessage({
        userId: 'user_1',
        clientId: 'client_abc',
        leadId: 'lead_xyz',
        channel: 'email',
        direction: 'outbound',
        to: 'test@example.com',
        from: 'oracle@oracle.app',
        subject: 'Test Subject',
        body: 'Test body',
        templateId: 'tpl_001',
        providerMessageId: 'email_001',
        status: 'sent',
        metadata: { campaign: 'winter' },
      });

      expect(insertedRow.user_id).toBe('user_1');
      expect(insertedRow.client_id).toBe('client_abc');
      expect(insertedRow.lead_id).toBe('lead_xyz');
      expect(insertedRow.subject).toBe('Test Subject');
      expect(insertedRow.template_id).toBe('tpl_001');
      expect(insertedRow.provider_message_id).toBe('email_001');
      expect(insertedRow.metadata).toBe(JSON.stringify({ campaign: 'winter' }));
    });

    it('sets null for missing optional fields', async () => {
      let insertedRow: Record<string, unknown> = {};
      const mockInsert = vi.fn().mockImplementation((row: Record<string, unknown>) => {
        insertedRow = row;
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'log_003' }, error: null }),
          }),
        };
      });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ insert: mockInsert }) });

      const { logMessage } = await import('./message-logger');

      await logMessage({
        userId: 'user_1',
        channel: 'whatsapp',
        direction: 'inbound',
        to: 'pn_123',
        from: '+919876543210',
        body: 'Hi there',
        status: 'delivered',
      });

      expect(insertedRow.client_id).toBeNull();
      expect(insertedRow.lead_id).toBeNull();
      expect(insertedRow.subject).toBeNull();
      expect(insertedRow.template_id).toBeNull();
      expect(insertedRow.provider_message_id).toBeNull();
      expect(insertedRow.error_code).toBeNull();
      expect(insertedRow.metadata).toBeNull();
    });
  });

  describe('updateMessageStatus', () => {
    it('updates status in Supabase', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update: mockUpdate }) });

      const { updateMessageStatus } = await import('./message-logger');

      const result = await updateMessageStatus('wa_msg_001', 'delivered');
      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'delivered' }),
      );
      expect(mockEq).toHaveBeenCalledWith('provider_message_id', 'wa_msg_001');
    });

    it('returns false when Supabase is not configured', async () => {
      cleanEnv();
      const { updateMessageStatus } = await import('./message-logger');
      const result = await updateMessageStatus('wa_msg_001', 'delivered');
      expect(result).toBe(false);
    });

    it('returns false on database error', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: { message: 'Not found' } });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update: mockUpdate }) });

      const { updateMessageStatus } = await import('./message-logger');
      const result = await updateMessageStatus('wa_msg_001', 'failed', '131026');
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      mockCreateClient.mockReturnValue({
        from: vi.fn().mockImplementation(() => { throw new Error('Timeout'); }),
      });

      const { updateMessageStatus } = await import('./message-logger');
      const result = await updateMessageStatus('wa_msg_001', 'read');
      expect(result).toBe(false);
    });

    it('includes error code when provided', async () => {
      let updateData: Record<string, unknown> = {};
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockImplementation((data: Record<string, unknown>) => {
        updateData = data;
        return { eq: mockEq };
      });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update: mockUpdate }) });

      const { updateMessageStatus } = await import('./message-logger');
      await updateMessageStatus('wa_msg_001', 'failed', '131026');

      expect(updateData.error_code).toBe('131026');
      expect(updateData.status).toBe('failed');
    });
  });

  describe('getMessageHistory', () => {
    it('fetches message history for a user', async () => {
      const mockRange = vi.fn().mockResolvedValue({
        data: [{
          id: 'log_001',
          user_id: 'user_1',
          client_id: null,
          lead_id: null,
          channel: 'whatsapp',
          direction: 'outbound',
          to: '+919876543210',
          from: 'pn_123',
          subject: null,
          body: 'Hello!',
          template_id: null,
          provider_message_id: 'wa_msg_001',
          status: 'sent',
          error_code: null,
          metadata: null,
          created_at: 1700000000,
          updated_at: 1700000000,
        }],
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

      const { getMessageHistory } = await import('./message-logger');
      const messages = await getMessageHistory({ userId: 'user_1' });

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('log_001');
      expect(messages[0].channel).toBe('whatsapp');
      expect(messages[0].body).toBe('Hello!');
    });

    it('returns empty when Supabase is not configured', async () => {
      cleanEnv();
      const { getMessageHistory } = await import('./message-logger');
      const messages = await getMessageHistory({ userId: 'user_1' });
      expect(messages).toHaveLength(0);
    });

    it('returns empty on database error', async () => {
      const mockRange = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

      const { getMessageHistory } = await import('./message-logger');
      const messages = await getMessageHistory({ userId: 'user_1' });
      expect(messages).toHaveLength(0);
    });

    it('returns empty on network error', async () => {
      mockCreateClient.mockReturnValue({
        from: vi.fn().mockImplementation(() => { throw new Error('Network error'); }),
      });

      const { getMessageHistory } = await import('./message-logger');
      const messages = await getMessageHistory({ userId: 'user_1' });
      expect(messages).toHaveLength(0);
    });

    it('parses metadata JSON from stored string', async () => {
      const mockRange = vi.fn().mockResolvedValue({
        data: [{
          id: 'log_002',
          user_id: 'user_1',
          client_id: 'client_1',
          lead_id: null,
          channel: 'email',
          direction: 'outbound',
          to: 'test@example.com',
          from: 'oracle@oracle.app',
          subject: 'Test',
          body: 'Body',
          template_id: null,
          provider_message_id: 'email_001',
          status: 'sent',
          error_code: null,
          metadata: '{"campaign":"winter","source":"web"}',
          created_at: 1700000000,
          updated_at: 1700000000,
        }],
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

      const { getMessageHistory } = await import('./message-logger');
      const messages = await getMessageHistory({ userId: 'user_1' });

      expect(messages[0].metadata).toEqual({ campaign: 'winter', source: 'web' });
    });

    it('returns undefined metadata when null', async () => {
      const mockRange = vi.fn().mockResolvedValue({
        data: [{
          id: 'log_003',
          user_id: 'user_1',
          client_id: null,
          lead_id: null,
          channel: 'whatsapp',
          direction: 'inbound',
          to: 'pn_123',
          from: '+919876543210',
          subject: null,
          body: 'Hi',
          template_id: null,
          provider_message_id: null,
          status: 'delivered',
          error_code: null,
          metadata: null,
          created_at: 1700000000,
          updated_at: 1700000000,
        }],
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

      const { getMessageHistory } = await import('./message-logger');
      const messages = await getMessageHistory({ userId: 'user_1' });

      expect(messages[0].metadata).toBeUndefined();
    });
  });

  describe('getMessageStats', () => {
    it('returns aggregated stats', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        data: [
          { channel: 'whatsapp', status: 'sent', direction: 'outbound' },
          { channel: 'whatsapp', status: 'delivered', direction: 'outbound' },
          { channel: 'email', status: 'sent', direction: 'outbound' },
          { channel: 'email', status: 'failed', direction: 'outbound' },
        ],
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

      const { getMessageStats } = await import('./message-logger');
      const stats = await getMessageStats('user_1');

      expect(stats.total).toBe(4);
      expect(stats.byChannel.whatsapp).toBe(2);
      expect(stats.byChannel.email).toBe(2);
      expect(stats.byStatus.sent).toBe(2);
      expect(stats.byStatus.delivered).toBe(1);
      expect(stats.byStatus.failed).toBe(1);
      expect(stats.byDirection.outbound).toBe(4);
    });

    it('returns empty stats when Supabase is not configured', async () => {
      cleanEnv();
      const { getMessageStats } = await import('./message-logger');
      const stats = await getMessageStats('user_1');
      expect(stats.total).toBe(0);
      expect(stats.byChannel).toEqual({});
      expect(stats.byStatus).toEqual({});
      expect(stats.byDirection).toEqual({});
    });

    it('returns empty stats on database error', async () => {
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

      const { getMessageStats } = await import('./message-logger');
      const stats = await getMessageStats('user_1');
      expect(stats.total).toBe(0);
    });

    it('returns empty stats on network error', async () => {
      mockCreateClient.mockReturnValue({
        from: vi.fn().mockImplementation(() => { throw new Error('Network error'); }),
      });

      const { getMessageStats } = await import('./message-logger');
      const stats = await getMessageStats('user_1');
      expect(stats.total).toBe(0);
    });

    it('handles empty result set', async () => {
      const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockCreateClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

      const { getMessageStats } = await import('./message-logger');
      const stats = await getMessageStats('user_1');
      expect(stats.total).toBe(0);
    });
  });
});
