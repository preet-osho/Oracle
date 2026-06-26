// ═══════════════════════════════════════
// ORACLE — Inngest Dispatch Helpers
// Server-side helpers for sending events to Inngest background functions
// ═══════════════════════════════════════

import { inngest } from '@/lib/inngest/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('InngestDispatch');

/**
 * Check if Inngest is configured (has an event key).
 * Falls back gracefully when INNGEST_EVENT_KEY is not set.
 */
export function isInngestConfigured(): boolean {
  return Boolean(process.env.INNGEST_EVENT_KEY);
}

// ─── Dispatch: Task Execution ──────────

/**
 * Dispatch a client task to the background queue for async execution.
 * Returns an event ID for tracking, or null if Inngest is not configured.
 */
export async function dispatchTaskExecution(params: {
  taskId: string;
  clientName: string;
  title: string;
  description: string;
  category: string;
  assignedAgents: string[];
  approach: 'balanced' | 'premium' | 'fast';
  parallel: boolean;
  userId?: string;
}): Promise<string | null> {
  if (!isInngestConfigured()) {
    log.warn('Inngest not configured — task will run synchronously');
    return null;
  }

  try {
    const event = await inngest.send({
      name: 'app/task.execute',
      data: params,
    });
    log.info('Task dispatched to background queue', {
      taskId: params.taskId,
      eventId: event.ids?.[0],
    });
    return event.ids?.[0] || null;
  } catch (err) {
    log.error('Failed to dispatch task to Inngest', {
      error: err instanceof Error ? err.message : 'Unknown',
      taskId: params.taskId,
    });
    return null;
  }
}

// ─── Dispatch: Memory Extraction ───────

/**
 * Dispatch memory extraction to the background queue.
 * Runs after a conversation completes to extract client facts.
 */
export async function dispatchMemoryExtraction(params: {
  clientId: string;
  conversation: string;
  userId?: string;
}): Promise<string | null> {
  if (!isInngestConfigured()) return null;

  try {
    const event = await inngest.send({
      name: 'app/memory.extract',
      data: params,
    });
    return event.ids?.[0] || null;
  } catch (err) {
    log.error('Failed to dispatch memory extraction', {
      error: err instanceof Error ? err.message : 'Unknown',
      clientId: params.clientId,
    });
    return null;
  }
}

// ─── Dispatch: Quality Scoring ─────────

/**
 * Dispatch quality scoring to the background queue.
 * Scores an AI response after it's been delivered to the user.
 */
export async function dispatchQualityScoring(params: {
  responseText: string;
  taskContext: string;
  conversationId?: string;
  userId?: string;
}): Promise<string | null> {
  if (!isInngestConfigured()) return null;

  try {
    const event = await inngest.send({
      name: 'app/quality.score',
      data: params,
    });
    return event.ids?.[0] || null;
  } catch (err) {
    log.error('Failed to dispatch quality scoring', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return null;
  }
}

// ─── Dispatch: Web Scan ────────────────

/**
 * Dispatch a weekly web scan to the background queue.
 */
export async function dispatchWebScan(params: {
  categories?: string[];
  userId?: string;
}): Promise<string | null> {
  if (!isInngestConfigured()) return null;

  try {
    const event = await inngest.send({
      name: 'app/webscan.run',
      data: params,
    });
    return event.ids?.[0] || null;
  } catch (err) {
    log.error('Failed to dispatch web scan', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return null;
  }
}

// ─── Dispatch: Weekly Report ───────────

/**
 * Dispatch report generation to the background queue.
 */
export async function dispatchReportGeneration(params: {
  userId: string;
  period?: 'weekly' | 'monthly';
}): Promise<string | null> {
  if (!isInngestConfigured()) return null;

  try {
    const event = await inngest.send({
      name: 'app/report.generate',
      data: params,
    });
    return event.ids?.[0] || null;
  } catch (err) {
    log.error('Failed to dispatch report generation', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return null;
  }
}

// ─── Dispatch: Lead Follow-Up ──────────

/**
 * Dispatch a lead follow-up check to the background queue.
 */
export async function dispatchLeadFollowUp(params: {
  orgId: string;
  leadId?: string;
  leadName?: string;
  leadEmail?: string;
  followUpType: 'auto-email' | 'task-reminder' | 'stale-lead-check';
  daysSinceLastContact?: number;
  userId?: string;
}): Promise<string | null> {
  if (!isInngestConfigured()) return null;

  try {
    const event = await inngest.send({
      name: 'app/lead.followup',
      data: params,
    });
    return event.ids?.[0] || null;
  } catch (err) {
    log.error('Failed to dispatch lead follow-up', {
      error: err instanceof Error ? err.message : 'Unknown',
      orgId: params.orgId,
    });
    return null;
  }
}

// ─── Dispatch: Automation Tick ─────────

/**
 * Dispatch an automation tick event to trigger scheduled jobs.
 */
export async function dispatchAutomationTick(params: {
  scheduleId: string;
  scheduleType: string;
  orgId?: string;
  userId?: string;
}): Promise<string | null> {
  if (!isInngestConfigured()) return null;

  try {
    const event = await inngest.send({
      name: 'app/automation.tick',
      data: params,
    });
    return event.ids?.[0] || null;
  } catch (err) {
    log.error('Failed to dispatch automation tick', {
      error: err instanceof Error ? err.message : 'Unknown',
      scheduleId: params.scheduleId,
    });
    return null;
  }
}
