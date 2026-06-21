// ═══════════════════════════════════════
// ORACLE — Deadline Tracker Tests
// Alert engine, priority scoring, deadline stats
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDeadlineAlerts,
  getAlertColor,
  getAlertEmoji,
  getPriorityWeight,
  getDeadlineStats,
  type DeadlineItem,
} from './deadline-tracker';

// ─── Helpers ────────────────────────────

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

function makeItem(overrides: Partial<DeadlineItem> = {}): DeadlineItem {
  return {
    id: 'item-1',
    title: 'Test Deadline',
    dueDate: now + 3 * DAY,
    createdAt: now - DAY,
    status: 'pending',
    priority: 'medium',
    category: 'seo',
    ...overrides,
  };
}

// ─── getDeadlineAlerts Tests ────────────

describe('getDeadlineAlerts', () => {
  it('generates info alert for deadlines > 5 days away', () => {
    const item = makeItem({ dueDate: now + 10 * DAY });
    const alerts = getDeadlineAlerts([item]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertLevel).toBe('info');
    expect(alerts[0].daysRemaining).toBe(10);
    expect(alerts[0].message).toContain('10 days');
  });

  it('generates warning alert for deadlines 3-5 days away', () => {
    const item = makeItem({ dueDate: now + 4 * DAY });
    const alerts = getDeadlineAlerts([item]);
    expect(alerts[0].alertLevel).toBe('warning');
    expect(alerts[0].daysRemaining).toBe(4);
  });

  it('generates urgent alert for deadlines 1-2 days away', () => {
    const item = makeItem({ dueDate: now + 1 * DAY });
    const alerts = getDeadlineAlerts([item]);
    expect(alerts[0].alertLevel).toBe('urgent');
    expect(alerts[0].daysRemaining).toBe(1);
    expect(alerts[0].message).toContain('1 day');
  });

  it('generates urgent alert for today (0 days)', () => {
    const item = makeItem({ dueDate: now });
    const alerts = getDeadlineAlerts([item]);
    expect(alerts[0].alertLevel).toBe('urgent');
    expect(alerts[0].message).toBe('Due today');
  });

  it('generates overdue alert for past deadlines', () => {
    const item = makeItem({ dueDate: now - 3 * DAY });
    const alerts = getDeadlineAlerts([item]);
    expect(alerts[0].alertLevel).toBe('overdue');
    expect(alerts[0].daysRemaining).toBe(-3);
    expect(alerts[0].message).toContain('Overdue by 3 days');
  });

  it('uses singular "day" for 1-day overdue', () => {
    const item = makeItem({ dueDate: now - 1 * DAY });
    const alerts = getDeadlineAlerts([item]);
    expect(alerts[0].message).toContain('Overdue by 1 day');
    expect(alerts[0].message).not.toContain('days');
  });

  it('filters out completed items', () => {
    const item = makeItem({ status: 'completed', dueDate: now - DAY });
    const alerts = getDeadlineAlerts([item]);
    expect(alerts).toHaveLength(0);
  });

  it('includes in-progress items', () => {
    const item = makeItem({ status: 'in-progress', dueDate: now + DAY });
    const alerts = getDeadlineAlerts([item]);
    expect(alerts).toHaveLength(1);
  });

  it('sorts by daysRemaining ascending (most urgent first)', () => {
    const items = [
      makeItem({ id: 'a', dueDate: now + 10 * DAY }),
      makeItem({ id: 'b', dueDate: now - 1 * DAY }),
      makeItem({ id: 'c', dueDate: now + 2 * DAY }),
    ];
    const alerts = getDeadlineAlerts(items);
    expect(alerts[0].daysRemaining).toBe(-1); // overdue
    expect(alerts[1].daysRemaining).toBe(2);
    expect(alerts[2].daysRemaining).toBe(10);
  });

  it('returns empty array for no items', () => {
    expect(getDeadlineAlerts([])).toEqual([]);
  });

  it('uses singular "day" for 1-day urgent', () => {
    const item = makeItem({ dueDate: now + 1 * DAY });
    const alerts = getDeadlineAlerts([item]);
    expect(alerts[0].message).toContain('1 day');
    expect(alerts[0].message).not.toContain('1 days');
  });
});

// ─── getAlertColor Tests ────────────────

describe('getAlertColor', () => {
  it('returns error for overdue', () => {
    expect(getAlertColor('overdue')).toBe('var(--oracle-error)');
  });

  it('returns error for urgent', () => {
    expect(getAlertColor('urgent')).toBe('var(--oracle-error)');
  });

  it('returns warning for warning', () => {
    expect(getAlertColor('warning')).toBe('var(--oracle-warning)');
  });

  it('returns info for info', () => {
    expect(getAlertColor('info')).toBe('var(--oracle-info)');
  });
});

// ─── getAlertEmoji Tests ────────────────

describe('getAlertEmoji', () => {
  it('returns 🚨 for overdue', () => {
    expect(getAlertEmoji('overdue')).toBe('🚨');
  });

  it('returns ⏰ for urgent', () => {
    expect(getAlertEmoji('urgent')).toBe('⏰');
  });

  it('returns ⚠️ for warning', () => {
    expect(getAlertEmoji('warning')).toBe('⚠️');
  });

  it('returns ℹ️ for info', () => {
    expect(getAlertEmoji('info')).toBe('ℹ️');
  });
});

// ─── getPriorityWeight Tests ────────────

describe('getPriorityWeight', () => {
  it('returns 4 for critical', () => {
    expect(getPriorityWeight('critical')).toBe(4);
  });

  it('returns 3 for high', () => {
    expect(getPriorityWeight('high')).toBe(3);
  });

  it('returns 2 for medium', () => {
    expect(getPriorityWeight('medium')).toBe(2);
  });

  it('returns 1 for low', () => {
    expect(getPriorityWeight('low')).toBe(1);
  });
});

// ─── getDeadlineStats Tests ─────────────

describe('getDeadlineStats', () => {
  it('returns zeros for empty array', () => {
    const stats = getDeadlineStats([]);
    expect(stats.total).toBe(0);
    expect(stats.overdue).toBe(0);
    expect(stats.dueSoon).toBe(0);
    expect(stats.onTrack).toBe(0);
    expect(stats.completed).toBe(0);
  });

  it('counts overdue items (past due, not completed)', () => {
    const items = [
      makeItem({ dueDate: now - DAY, status: 'pending' }),
      makeItem({ id: '2', dueDate: now - 2 * DAY, status: 'in-progress' }),
    ];
    const stats = getDeadlineStats(items);
    expect(stats.overdue).toBe(2);
  });

  it('counts due-soon items (within 5 days, not completed)', () => {
    const items = [
      makeItem({ dueDate: now + 3 * DAY }),
      makeItem({ id: '2', dueDate: now + 5 * DAY }),
    ];
    const stats = getDeadlineStats(items);
    expect(stats.dueSoon).toBe(2);
  });

  it('counts on-track items (> 5 days away, not completed)', () => {
    const items = [
      makeItem({ dueDate: now + 10 * DAY }),
      makeItem({ id: '2', dueDate: now + 30 * DAY }),
    ];
    const stats = getDeadlineStats(items);
    expect(stats.onTrack).toBe(2);
  });

  it('counts completed items', () => {
    const items = [
      makeItem({ status: 'completed' }),
      makeItem({ id: '2', status: 'completed' }),
    ];
    const stats = getDeadlineStats(items);
    expect(stats.completed).toBe(2);
  });

  it('excludes completed from overdue/dueSoon/onTrack', () => {
    const items = [
      makeItem({ status: 'completed', dueDate: now - DAY }),
      makeItem({ id: '2', status: 'completed', dueDate: now + 2 * DAY }),
    ];
    const stats = getDeadlineStats(items);
    expect(stats.overdue).toBe(0);
    expect(stats.dueSoon).toBe(0);
    expect(stats.onTrack).toBe(0);
    expect(stats.completed).toBe(2);
  });

  it('returns total count of all items', () => {
    const items = [
      makeItem({ status: 'pending' }),
      makeItem({ id: '2', status: 'completed' }),
      makeItem({ id: '3', dueDate: now + 10 * DAY }),
    ];
    const stats = getDeadlineStats(items);
    expect(stats.total).toBe(3);
  });

  it('classifies mixed statuses correctly', () => {
    const items = [
      makeItem({ dueDate: now - DAY, status: 'pending' }),      // overdue
      makeItem({ id: '2', dueDate: now + 2 * DAY, status: 'in-progress' }), // dueSoon
      makeItem({ id: '3', dueDate: now + 10 * DAY, status: 'pending' }),    // onTrack
      makeItem({ id: '4', status: 'completed' }),                            // completed
    ];
    const stats = getDeadlineStats(items);
    expect(stats.total).toBe(4);
    expect(stats.overdue).toBe(1);
    expect(stats.dueSoon).toBe(1);
    expect(stats.onTrack).toBe(1);
    expect(stats.completed).toBe(1);
  });
});
