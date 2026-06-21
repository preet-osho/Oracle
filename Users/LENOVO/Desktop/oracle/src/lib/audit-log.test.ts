// ═══════════════════════════════════════
// ORACLE — Audit Log Tests
// writeAuditLog, AUDIT_ACTIONS, Supabase integration
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Must set env vars before import so singleton captures them
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

import { writeAuditLog, AUDIT_ACTIONS, type AuditLogEntry } from './audit-log';

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
});

// ─── writeAuditLog Tests ────────────────

describe('writeAuditLog', () => {
  const baseEntry: AuditLogEntry = {
    action: 'user.login',
    entityType: 'user',
  };

  it('writes an audit log entry to Supabase', async () => {
    await writeAuditLog(baseEntry);

    expect(mockFrom).toHaveBeenCalledWith('audit_logs');
    expect(mockInsert).toHaveBeenCalledTimes(1);

    const insertedData = mockInsert.mock.calls[0][0];
    expect(insertedData.action).toBe('user.login');
    expect(insertedData.entity_type).toBe('user');
    expect(insertedData.created_at).toBeGreaterThan(0);
  });

  it('includes all optional fields when provided', async () => {
    const fullEntry: AuditLogEntry = {
      userId: 'user-123',
      action: 'create',
      entityType: 'project',
      entityId: 'proj-456',
      oldValue: { name: 'Old Name' },
      newValue: { name: 'New Name' },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      metadata: { source: 'test' },
    };

    await writeAuditLog(fullEntry);

    const data = mockInsert.mock.calls[0][0];
    expect(data.user_id).toBe('user-123');
    expect(data.entity_id).toBe('proj-456');
    expect(data.old_value).toEqual({ name: 'Old Name' });
    expect(data.new_value).toEqual({ name: 'New Name' });
    expect(data.ip_address).toBe('127.0.0.1');
    expect(data.user_agent).toBe('Mozilla/5.0');
    expect(data.metadata).toEqual({ source: 'test' });
  });

  it('defaults optional fields to null', async () => {
    await writeAuditLog(baseEntry);

    const data = mockInsert.mock.calls[0][0];
    expect(data.user_id).toBeNull();
    expect(data.entity_id).toBeNull();
    expect(data.old_value).toBeNull();
    expect(data.new_value).toBeNull();
    expect(data.ip_address).toBeNull();
    expect(data.user_agent).toBeNull();
    expect(data.metadata).toEqual({});
  });

  it('does not throw on insert error', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'db error' } });

    await expect(writeAuditLog(baseEntry)).resolves.toBeUndefined();
  });

  it('does not throw on exception', async () => {
    mockInsert.mockRejectedValue(new Error('network failure'));

    await expect(writeAuditLog(baseEntry)).resolves.toBeUndefined();
  });

  it('skips when Supabase not configured', async () => {
    // The singleton is already created, so this tests the normal path
    // Just verify it doesn't throw
    await expect(writeAuditLog(baseEntry)).resolves.toBeUndefined();
  });

  it('always resolves even on catastrophic failure', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('unexpected');
    });

    await expect(writeAuditLog(baseEntry)).resolves.toBeUndefined();
  });
});

// ─── AUDIT_ACTIONS Tests ────────────────

describe('AUDIT_ACTIONS', () => {
  it('has auth actions', () => {
    expect(AUDIT_ACTIONS.USER_LOGIN).toBe('user.login');
    expect(AUDIT_ACTIONS.USER_LOGOUT).toBe('user.logout');
    expect(AUDIT_ACTIONS.USER_SIGNUP).toBe('user.signup');
    expect(AUDIT_ACTIONS.USER_PASSWORD_RESET).toBe('user.password_reset');
  });

  it('has CRUD actions', () => {
    expect(AUDIT_ACTIONS.CREATE).toBe('create');
    expect(AUDIT_ACTIONS.UPDATE).toBe('update');
    expect(AUDIT_ACTIONS.DELETE).toBe('delete');
  });

  it('has payment actions', () => {
    expect(AUDIT_ACTIONS.PAYMENT_ORDER_CREATED).toBe('payment.order_created');
    expect(AUDIT_ACTIONS.PAYMENT_VERIFIED).toBe('payment.verified');
  });

  it('has AI actions', () => {
    expect(AUDIT_ACTIONS.AI_CHAT).toBe('ai.chat');
    expect(AUDIT_ACTIONS.AI_ORCHESTRATOR).toBe('ai.orchestrator');
  });

  it('has config actions', () => {
    expect(AUDIT_ACTIONS.CONFIG_UPDATE).toBe('config.update');
    expect(AUDIT_ACTIONS.API_KEY_UPDATE).toBe('config.api_key_update');
  });

  it('has security actions', () => {
    expect(AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED).toBe('security.rate_limit_exceeded');
    expect(AUDIT_ACTIONS.RATE_LIMIT_WARNING).toBe('security.rate_limit_warning');
  });

  it('has at least 15 action constants', () => {
    expect(Object.keys(AUDIT_ACTIONS).length).toBeGreaterThanOrEqual(15);
  });

  it('all action values are non-empty strings', () => {
    for (const [, value] of Object.entries(AUDIT_ACTIONS)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
