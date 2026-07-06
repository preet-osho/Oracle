// ═══════════════════════════════════════
// ORACLE — Automation Scheduler Tests
// ═══════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  SCHEDULE_DEFINITIONS,
  getCronForFrequency,
  isValidCron,
  estimateNextRun,
  createDefaultSchedule,
  getAvailableSchedules,
  getScheduleEventType,
  type ScheduleType,
} from './scheduler';

// ─── Cron Validation ───────────────────

describe('isValidCron', () => {
  it('accepts valid 5-field cron expressions', () => {
    expect(isValidCron('* * * * *')).toBe(true);
    expect(isValidCron('0 6 * * 1')).toBe(true);
    expect(isValidCron('30 8 1 * *')).toBe(true);
    expect(isValidCron('*/15 * * * *')).toBe(true);
    expect(isValidCron('0 9-17 * * 1-5')).toBe(true);
  });

  it('rejects invalid cron expressions', () => {
    expect(isValidCron('')).toBe(false);
    expect(isValidCron('* *')).toBe(false);
    expect(isValidCron('* * * * * *')).toBe(false);
    expect(isValidCron('abc def ghi jkl mno')).toBe(false);
  });
});

// ─── Cron Frequency Mapping ────────────

describe('getCronForFrequency', () => {
  it('returns correct cron for hourly', () => {
    expect(getCronForFrequency('hourly')).toBe('0 * * * *');
  });

  it('returns correct cron for daily', () => {
    expect(getCronForFrequency('daily')).toBe('0 8 * * *');
  });

  it('returns correct cron for weekly', () => {
    expect(getCronForFrequency('weekly')).toBe('0 8 * * 1');
  });

  it('returns correct cron for monthly', () => {
    expect(getCronForFrequency('monthly')).toBe('0 8 1 * *');
  });
});

// ─── Next Run Estimation ───────────────

describe('estimateNextRun', () => {
  it('returns a date in the future', () => {
    const cron = '0 8 * * 1'; // Monday 08:00
    const now = new Date('2026-06-15T10:00:00Z'); // Monday 10:00
    const next = estimateNextRun(cron, now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it('handles monthly schedules', () => {
    const cron = '0 8 1 * *'; // 1st of month
    const now = new Date('2026-06-15T10:00:00Z');
    const next = estimateNextRun(cron, now);
    expect(next.getDate()).toBe(1);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });
});

// ─── Schedule Definitions ──────────────

describe('SCHEDULE_DEFINITIONS', () => {
  it('has all 10 schedule types', () => {
    expect(Object.keys(SCHEDULE_DEFINITIONS)).toHaveLength(10);
  });

  it('each definition has required fields', () => {
    for (const [type, def] of Object.entries(SCHEDULE_DEFINITIONS)) {
      expect(def.type).toBe(type);
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.defaultFrequency).toBeTruthy();
      expect(def.cronExpression).toBeTruthy();
      expect(isValidCron(def.cronExpression)).toBe(true);
      expect(typeof def.enabledByDefault).toBe('boolean');
    }
  });
});

// ─── Available Schedules ───────────────

describe('getAvailableSchedules', () => {
  it('returns all 10 schedule definitions', () => {
    const schedules = getAvailableSchedules();
    expect(schedules).toHaveLength(10);
  });
});

// ─── Create Default Schedule ───────────

describe('createDefaultSchedule', () => {
  it('creates a schedule with defaults', () => {
    const schedule = createDefaultSchedule('web-scan', 'org-1');
    expect(schedule.orgId).toBe('org-1');
    expect(schedule.type).toBe('web-scan');
    expect(schedule.frequency).toBe('weekly');
    expect(schedule.cronExpression).toBe('0 6 * * 1');
    expect(schedule.enabled).toBe(true);
    expect(schedule.lastRunAt).toBeNull();
    expect(schedule.config).toEqual({});
  });

  it('applies overrides', () => {
    const schedule = createDefaultSchedule('lead-followup', 'org-2', {
      frequency: 'daily',
      enabled: false,
      config: { threshold: 14 },
    });
    expect(schedule.frequency).toBe('daily');
    expect(schedule.enabled).toBe(false);
    expect(schedule.config).toEqual({ threshold: 14 });
  });

  it('throws on unknown schedule type', () => {
    // @ts-expect-error Testing invalid type
    expect(() => createDefaultSchedule('invalid', 'org-1')).toThrow('Unknown schedule type');
  });
});

// ─── Schedule Event Mapping ────────────

describe('getScheduleEventType', () => {
  it('maps web-scan to correct event', () => {
    expect(getScheduleEventType('web-scan')).toBe('app/webscan.run');
  });

  it('maps lead-followup to correct event', () => {
    expect(getScheduleEventType('lead-followup')).toBe('app/lead.followup');
  });

  it('maps report-weekly to report.generate event', () => {
    expect(getScheduleEventType('report-weekly')).toBe('app/report.generate');
  });

  it('maps report-monthly to report.generate event', () => {
    expect(getScheduleEventType('report-monthly')).toBe('app/report.generate');
  });
});
