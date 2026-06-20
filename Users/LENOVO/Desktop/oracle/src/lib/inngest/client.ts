// ═══════════════════════════════════════
// ORACLE — Inngest Client
// Background job queue for long-running AI tasks
// ═══════════════════════════════════════

import { Inngest, type EventPayload } from 'inngest';

/**
 * Inngest client — the entry point for all background job operations.
 *
 * Environment variables required:
 *   INNGEST_EVENT_KEY   — from Inngest dashboard (for cloud) or dev server
 *   INNGEST_SIGNING_KEY — from Inngest dashboard (for cloud) or dev server
 *
 * The `id` is a stable identifier for this Inngest app. Changing it
 * will cause all in-flight functions to be orphaned, so never change it
 * after the first deploy.
 */
export const inngest = new Inngest({
  id: 'oracle-ai',
  name: 'ORACLE AI Background Jobs',
  // Register event schemas so event.data is type-safe in function handlers
  events: [
    {
      name: 'app/task.execute' as const,
      data: {} as {
        taskId: string;
        clientName: string;
        title: string;
        description: string;
        category: string;
        assignedAgents: string[];
        approach: 'balanced' | 'premium' | 'fast';
        parallel: boolean;
        userId?: string;
      },
    },
    {
      name: 'app/memory.extract' as const,
      data: {} as {
        clientId: string;
        conversation: string;
        userId?: string;
      },
    },
    {
      name: 'app/quality.score' as const,
      data: {} as {
        responseText: string;
        taskContext: string;
        conversationId?: string;
        userId?: string;
      },
    },
    {
      name: 'app/webscan.run' as const,
      data: {} as {
        categories?: string[];
        userId?: string;
      },
    },
    {
      name: 'app/report.generate' as const,
      data: {} as {
        userId: string;
        period?: 'weekly' | 'monthly';
      },
    },
    {
      name: 'app/lead.followup' as const,
      data: {} as {
        orgId: string;
        leadId?: string;
        leadName?: string;
        leadEmail?: string;
        followUpType: 'auto-email' | 'task-reminder' | 'stale-lead-check';
        daysSinceLastContact?: number;
        userId?: string;
      },
    },
    {
      name: 'app/automation.tick' as const,
      data: {} as {
        scheduleId: string;
        scheduleType: string;
        orgId?: string;
        userId?: string;
      },
    },
    {
      name: 'app/quality.batch-review' as const,
      data: {} as {
        orgId: string;
        userId?: string;
        maxItems?: number;
      },
    },
    {
      name: 'app/memory.batch-extract' as const,
      data: {} as {
        orgId: string;
        userId?: string;
        maxItems?: number;
      },
    },
  ],
});
