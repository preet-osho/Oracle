// ═══════════════════════════════════════
// ORACLE — Inngest Dispatch Tests
// Background job dispatch helpers
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted Mocks ─────────────────────

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: mockSend },
}));

// ─── Import after mocks ────────────────

import {
  isInngestConfigured,
  dispatchTaskExecution,
  dispatchMemoryExtraction,
  dispatchQualityScoring,
  dispatchWebScan,
  dispatchReportGeneration,
  dispatchLeadFollowUp,
  dispatchAutomationTick,
  dispatchLeadCapture,
  dispatchClientOnboarding,
  dispatchClientReport,
} from './dispatch';

// ─── Helpers ──────────────────────────

function setEnv(overrides: Record<string, string>) {
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
}

// ─── Tests ────────────────────────────

describe('Inngest Dispatch', () => {
  afterEach(() => {
    delete process.env.INNGEST_EVENT_KEY;
    vi.clearAllMocks();
  });

  describe('isInngestConfigured', () => {
    it('returns true when event key is set', () => {
      setEnv({ INNGEST_EVENT_KEY: 'key_abc123' });
      expect(isInngestConfigured()).toBe(true);
    });

    it('returns false when event key is missing', () => {
      expect(isInngestConfigured()).toBe(false);
    });

    it('returns false when event key is empty', () => {
      setEnv({ INNGEST_EVENT_KEY: '' });
      expect(isInngestConfigured()).toBe(false);
    });
  });

  describe('dispatchTaskExecution', () => {
    it('returns null when Inngest is not configured', async () => {
      const result = await dispatchTaskExecution({
        taskId: 'task_1',
        clientName: 'Test Client',
        title: 'SEO Audit',
        description: 'Complete audit',
        category: 'seo',
        assignedAgents: ['researcher', 'analyst'],
        approach: 'balanced',
        parallel: false,
      });

      expect(result).toBeNull();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('dispatches event and returns event ID', async () => {
      setEnv({ INNGEST_EVENT_KEY: 'key_abc123' });
      mockSend.mockResolvedValueOnce({ ids: ['evt_001'] });

      const result = await dispatchTaskExecution({
        taskId: 'task_1',
        clientName: 'Test Client',
        title: 'SEO Audit',
        description: 'Complete audit',
        category: 'seo',
        assignedAgents: ['researcher'],
        approach: 'premium',
        parallel: true,
        userId: 'user_1',
      });

      expect(result).toBe('evt_001');
      expect(mockSend).toHaveBeenCalledWith({
        name: 'app/task.execute',
        data: expect.objectContaining({
          taskId: 'task_1',
          clientName: 'Test Client',
          approach: 'premium',
        }),
      });
    });

    it('returns null on send failure', async () => {
      setEnv({ INNGEST_EVENT_KEY: 'key_abc123' });
      mockSend.mockRejectedValueOnce(new Error('Network error'));

      const result = await dispatchTaskExecution({
        taskId: 'task_1',
        clientName: 'Test',
        title: 'Test',
        description: 'Test',
        category: 'test',
        assignedAgents: [],
        approach: 'fast',
        parallel: false,
      });

      expect(result).toBeNull();
    });
  });

  describe('dispatchMemoryExtraction', () => {
    it('returns null when not configured', async () => {
      const result = await dispatchMemoryExtraction({ clientId: 'c1', conversation: 'Hello' });
      expect(result).toBeNull();
    });

    it('dispatches event', async () => {
      setEnv({ INNGEST_EVENT_KEY: 'key_abc123' });
      mockSend.mockResolvedValueOnce({ ids: ['evt_mem_001'] });

      const result = await dispatchMemoryExtraction({ clientId: 'c1', conversation: 'Hello', userId: 'u1' });

      expect(result).toBe('evt_mem_001');
      expect(mockSend).toHaveBeenCalledWith({
        name: 'app/memory.extract',
        data: { clientId: 'c1', conversation: 'Hello', userId: 'u1' },
      });
    });
  });

  describe('dispatchQualityScoring', () => {
    it('returns null when not configured', async () => {
      const result = await dispatchQualityScoring({ responseText: 'Good', taskContext: 'SEO' });
      expect(result).toBeNull();
    });

    it('dispatches event', async () => {
      setEnv({ INNGEST_EVENT_KEY: 'key_abc123' });
      mockSend.mockResolvedValueOnce({ ids: ['evt_qa_001'] });

      const result = await dispatchQualityScoring({
        responseText: 'Great response',
        taskContext: 'SEO audit',
        conversationId: 'conv_1',
        userId: 'u1',
      });

      expect(result).toBe('evt_qa_001');
    });
  });

  describe('dispatchWebScan', () => {
    it('returns null when not configured', async () => {
      const result = await dispatchWebScan({ categories: ['seo'] });
      expect(result).toBeNull();
    });

    it('dispatches event', async () => {
      setEnv({ INNGEST_EVENT_KEY: 'key_abc123' });
      mockSend.mockResolvedValueOnce({ ids: ['evt_ws_001'] });

      const result = await dispatchWebScan({ categories: ['seo', 'ads'], userId: 'u1' });

      expect(result).toBe('evt_ws_001');
      expect(mockSend).toHaveBeenCalledWith({
        name: 'app/webscan.run',
        data: { categories: ['seo', 'ads'], userId: 'u1' },
      });
    });
  });

  describe('dispatchReportGeneration', () => {
    it('returns null when not configured', async () => {
      const result = await dispatchReportGeneration({ userId: 'u1' });
      expect(result).toBeNull();
    });

    it('dispatches event', async () => {
      setEnv({ INNGEST_EVENT_KEY: 'key_abc123' });
      mockSend.mockResolvedValueOnce({ ids: ['evt_rpt_001'] });

      const result = await dispatchReportGeneration({ userId: 'u1', period: 'weekly' });

      expect(result).toBe('evt_rpt_001');
    });
  });

  describe('dispatchLeadFollowUp', () => {
    it('returns null when not configured', async () => {
      const result = await dispatchLeadFollowUp({
        orgId: 'org_1',
        followUpType: 'auto-email',
      });
      expect(result).toBeNull();
    });

    it('dispatches event', async () => {
      setEnv({ INNGEST_EVENT_KEY: 'key_abc123' });
      mockSend.mockResolvedValueOnce({ ids: ['evt_lf_001'] });

      const result = await dispatchLeadFollowUp({
        orgId: 'org_1',
        leadId: 'lead_1',
        followUpType: 'task-reminder',
        daysSinceLastContact: 7,
        userId: 'u1',
      });

      expect(result).toBe('evt_lf_001');
    });
  });

  describe('dispatchAutomationTick', () => {
    it('returns null when not configured', async () => {
      const result = await dispatchAutomationTick({
        scheduleId: 'sch_1',
        scheduleType: 'report-weekly',
      });
      expect(result).toBeNull();
    });

    it('dispatches event', async () => {
      setEnv({ INNGEST_EVENT_KEY: 'key_abc123' });
      mockSend.mockResolvedValueOnce({ ids: ['evt_tick_001'] });

      const result = await dispatchAutomationTick({
        scheduleId: 'sch_1',
        scheduleType: 'report-weekly',
        orgId: 'org_1',
        userId: 'u1',
      });

      expect(result).toBe('evt_tick_001');
    });
  });

  describe('dispatchLeadCapture', () => {
    it('returns null when not configured', async () => {
      const result = await dispatchLeadCapture({
        leadId: 'lead_1',
        userId: 'u1',
        businessName: 'Test Corp',
      });
      expect(result).toBeNull();
    });

    it('dispatches event', async () => {
      setEnv({ INNGEST_EVENT_KEY: 'key_abc123' });
      mockSend.mockResolvedValueOnce({ ids: ['evt_lc_001'] });

      const result = await dispatchLeadCapture({
        leadId: 'lead_1',
        userId: 'u1',
        businessName: 'TechCorp',
        industry: 'technology',
        city: 'Mumbai',
        channel: 'WhatsApp',
      });

      expect(result).toBe('evt_lc_001');
      expect(mockSend).toHaveBeenCalledWith({
        name: 'app/lead.capture',
        data: expect.objectContaining({
          leadId: 'lead_1',
          businessName: 'TechCorp',
          channel: 'WhatsApp',
        }),
      });
    });
  });

  describe('dispatchClientOnboarding', () => {
    it('returns null when not configured', async () => {
      const result = await dispatchClientOnboarding({
        projectId: 'proj_1',
        userId: 'u1',
        clientName: 'New Client',
      });
      expect(result).toBeNull();
    });

    it('dispatches event', async () => {
      setEnv({ INNGEST_EVENT_KEY: 'key_abc123' });
      mockSend.mockResolvedValueOnce({ ids: ['evt_co_001'] });

      const result = await dispatchClientOnboarding({
        projectId: 'proj_1',
        userId: 'u1',
        clientName: 'New Client',
        industry: 'healthcare',
        service: 'SEO',
        value: '₹50,000/month',
        contactEmail: 'client@example.com',
      });

      expect(result).toBe('evt_co_001');
    });
  });

  describe('dispatchClientReport', () => {
    it('returns null when not configured', async () => {
      const result = await dispatchClientReport({
        projectId: 'proj_1',
        userId: 'u1',
        clientName: 'Client',
      });
      expect(result).toBeNull();
    });

    it('dispatches event', async () => {
      setEnv({ INNGEST_EVENT_KEY: 'key_abc123' });
      mockSend.mockResolvedValueOnce({ ids: ['evt_cr_001'] });

      const result = await dispatchClientReport({
        projectId: 'proj_1',
        userId: 'u1',
        clientName: 'Client',
        period: 'monthly',
        sendEmail: true,
      });

      expect(result).toBe('evt_cr_001');
    });
  });

  describe('error handling', () => {
    it('returns null when send throws a non-Error', async () => {
      setEnv({ INNGEST_EVENT_KEY: 'key_abc123' });
      mockSend.mockRejectedValueOnce('string error');

      const result = await dispatchTaskExecution({
        taskId: 't1',
        clientName: 'C',
        title: 'T',
        description: 'D',
        category: 'c',
        assignedAgents: [],
        approach: 'fast',
        parallel: false,
      });

      expect(result).toBeNull();
    });

    it('returns null when event ID is empty', async () => {
      setEnv({ INNGEST_EVENT_KEY: 'key_abc123' });
      mockSend.mockResolvedValueOnce({ ids: [] });

      const result = await dispatchTaskExecution({
        taskId: 't1',
        clientName: 'C',
        title: 'T',
        description: 'D',
        category: 'c',
        assignedAgents: [],
        approach: 'fast',
        parallel: false,
      });

      expect(result).toBeNull();
    });
  });
});
