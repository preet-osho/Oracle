// ═══════════════════════════════════════
// ORACLE — Automation Scheduler
// Central configuration for scheduled automations
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';

const log = createLogger('AutomationScheduler');

// ─── Types ─────────────────────────────

export type ScheduleFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly';

export type ScheduleType =
  | 'web-scan'
  | 'lead-followup'
  | 'report-weekly'
  | 'report-monthly'
  | 'quality-review'
  | 'memory-extraction';

export interface ScheduleDefinition {
  type: ScheduleType;
  name: string;
  description: string;
  defaultFrequency: ScheduleFrequency;
  cronExpression: string;
  requiresOrg: boolean;
  requiresUserId: boolean;
  enabledByDefault: boolean;
}

export interface AutomationSchedule {
  id: string;
  orgId: string;
  type: ScheduleType;
  frequency: ScheduleFrequency;
  cronExpression: string;
  enabled: boolean;
  lastRunAt: number | null;
  nextRunAt: number | null;
  config: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface ScheduleExecutionLog {
  id: string;
  scheduleId: string;
  orgId: string;
  scheduleType: ScheduleType;
  status: 'success' | 'failed' | 'skipped';
  durationMs: number;
  result?: Record<string, unknown>;
  error?: string;
  executedAt: number;
}

// ─── Schedule Definitions ──────────────

export const SCHEDULE_DEFINITIONS: Record<ScheduleType, ScheduleDefinition> = {
  'web-scan': {
    type: 'web-scan',
    name: 'Weekly Web Scan',
    description: 'Scan for new tools, trends, and competitor changes in your industry',
    defaultFrequency: 'weekly',
    cronExpression: '0 6 * * 1', // Monday 06:00 UTC
    requiresOrg: false,
    requiresUserId: true,
    enabledByDefault: true,
  },
  'lead-followup': {
    type: 'lead-followup',
    name: 'Lead Follow-Up Check',
    description: 'Identify stale leads and create follow-up tasks automatically',
    defaultFrequency: 'weekly',
    cronExpression: '0 9 * * 2', // Tuesday 09:00 UTC
    requiresOrg: true,
    requiresUserId: false,
    enabledByDefault: true,
  },
  'report-weekly': {
    type: 'report-weekly',
    name: 'Weekly Intelligence Report',
    description: 'Generate a weekly summary of AI usage, costs, and quality metrics',
    defaultFrequency: 'weekly',
    cronExpression: '0 7 * * 1', // Monday 07:00 UTC
    requiresOrg: false,
    requiresUserId: true,
    enabledByDefault: true,
  },
  'report-monthly': {
    type: 'report-monthly',
    name: 'Monthly Intelligence Report',
    description: 'Generate a comprehensive monthly report with trends and recommendations',
    defaultFrequency: 'monthly',
    cronExpression: '0 8 1 * *', // 1st of month 08:00 UTC
    requiresOrg: false,
    requiresUserId: true,
    enabledByDefault: true,
  },
  'quality-review': {
    type: 'quality-review',
    name: 'Quality Score Review',
    description: 'Review quality scores and flag conversations needing attention',
    defaultFrequency: 'weekly',
    cronExpression: '0 10 * * 3', // Wednesday 10:00 UTC
    requiresOrg: false,
    requiresUserId: true,
    enabledByDefault: false,
  },
  'memory-extraction': {
    type: 'memory-extraction',
    name: 'Memory Extraction Batch',
    description: 'Process pending conversations and extract client memories',
    defaultFrequency: 'daily',
    cronExpression: '0 2 * * *', // Every day at 02:00 UTC
    requiresOrg: false,
    requiresUserId: true,
    enabledByDefault: false,
  },
};

// ─── Cron Helpers ──────────────────────

const FREQUENCY_CRON: Record<ScheduleFrequency, string> = {
  hourly: '0 * * * *',
  daily: '0 8 * * *',
  weekly: '0 8 * * 1',
  monthly: '0 8 1 * *',
};

/**
 * Get a default cron expression for a frequency.
 */
export function getCronForFrequency(frequency: ScheduleFrequency): string {
  return FREQUENCY_CRON[frequency];
}

/**
 * Validate a single cron field (supports *, ranges, steps, lists).
 */
function isValidCronField(field: string, min: number, max: number): boolean {
  // A field can be a comma-separated list of sub-fields
  const subFields = field.split(',');
  return subFields.every(sub => {
    // * or */n
    if (sub === '*') return true;
    if (/^\*\/[0-9]+$/.test(sub)) return true;
    // Single number
    if (/^[0-9]+$/.test(sub)) {
      const n = parseInt(sub, 10);
      return n >= min && n <= max;
    }
    // Range: a-b
    if (/^[0-9]+-[0-9]+$/.test(sub)) {
      const [a, b] = sub.split('-').map(Number);
      return a >= min && b <= max && a <= b;
    }
    // Range with step: a-b/n
    if (/^[0-9]+-[0-9]+\/[0-9]+$/.test(sub)) {
      const [range, step] = sub.split('/');
      const [a, b] = range.split('-').map(Number);
      return a >= min && b <= max && a <= b && parseInt(step, 10) > 0;
    }
    return false;
  });
}

/**
 * Validate a cron expression (5-field validation supporting *, ranges, steps, lists).
 */
export function isValidCron(expression: string): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  return (
    isValidCronField(parts[0], 0, 59) && // minute
    isValidCronField(parts[1], 0, 23) && // hour
    isValidCronField(parts[2], 1, 31) && // day of month
    isValidCronField(parts[3], 1, 12) && // month
    isValidCronField(parts[4], 0, 6)    // day of week
  );
}

/**
 * Calculate the next run time based on cron expression.
 * Simplified estimation for display purposes.
 */
export function estimateNextRun(cronExpression: string, from: Date = new Date()): Date {
  const parts = cronExpression.trim().split(/\s+/);
  const [, hourPart, dayPart, monthPart, dowPart] = parts;

  const next = new Date(from);
  next.setSeconds(0);
  next.setMilliseconds(0);

  // Parse hour
  if (hourPart !== '*') {
    const hour = parseInt(hourPart, 10);
    if (!isNaN(hour)) next.setHours(hour);
  }

  // Advance to next valid day
  if (dowPart !== '*') {
    const targetDow = parseInt(dowPart, 10);
    if (!isNaN(targetDow)) {
      const currentDow = next.getDay();
      const daysAhead = (targetDow - currentDow + 7) % 7 || 7;
      next.setDate(next.getDate() + daysAhead);
    }
  } else if (dayPart !== '*') {
    const targetDay = parseInt(dayPart, 10);
    if (!isNaN(targetDay) && next.getDate() >= targetDay) {
      next.setMonth(next.getMonth() + 1);
    }
    if (!isNaN(targetDay)) next.setDate(targetDay);
  }

  // If next run is in the past, advance
  if (next <= from) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

// ─── Default Schedule Factory ──────────

/**
 * Create a default schedule config for a given type.
 */
export function createDefaultSchedule(
  type: ScheduleType,
  orgId: string,
  overrides?: Partial<Pick<AutomationSchedule, 'frequency' | 'cronExpression' | 'enabled' | 'config'>>
): Omit<AutomationSchedule, 'id'> {
  const def = SCHEDULE_DEFINITIONS[type];
  if (!def) throw new Error(`Unknown schedule type: ${type}`);

  const frequency = overrides?.frequency ?? def.defaultFrequency;
  const cronExpression = overrides?.cronExpression ?? def.cronExpression;
  const now = Date.now();

  return {
    orgId,
    type,
    frequency,
    cronExpression,
    enabled: overrides?.enabled ?? def.enabledByDefault,
    lastRunAt: null,
    nextRunAt: estimateNextRun(cronExpression).getTime(),
    config: overrides?.config ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get all available schedule types that can be configured.
 */
export function getAvailableSchedules(): ScheduleDefinition[] {
  return Object.values(SCHEDULE_DEFINITIONS);
}

/**
 * Get the Inngest event name for a schedule type.
 */
export function getScheduleEventType(type: ScheduleType): string | null {
  const mapping: Record<ScheduleType, string | null> = {
    'web-scan': 'app/webscan.run',
    'lead-followup': 'app/lead.followup',
    'report-weekly': 'app/report.generate',
    'report-monthly': 'app/report.generate',
    'quality-review': 'app/quality.score',
    'memory-extraction': 'app/memory.extract',
  };
  return mapping[type] ?? null;
}
