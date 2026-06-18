// ═══════════════════════════════════════
// ORACLE — Deadline Tracker
// Deadline alerts · Overdue detection · Priority scoring
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export interface DeadlineItem {
  id: string;
  title: string;
  projectId?: string;
  clientName?: string;
  dueDate: number;
  createdAt: number;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
}

export interface DeadlineAlert {
  item: DeadlineItem;
  daysRemaining: number;
  alertLevel: 'info' | 'warning' | 'urgent' | 'overdue';
  message: string;
}

// ─── Alert Engine ──────────────────────

export function getDeadlineAlerts(items: DeadlineItem[]): DeadlineAlert[] {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  return items
    .filter((item) => item.status !== 'completed')
    .map((item) => {
      const daysRemaining = Math.ceil((item.dueDate - now) / DAY);
      let alertLevel: DeadlineAlert['alertLevel'];
      let message: string;

      if (daysRemaining < 0) {
        alertLevel = 'overdue';
        message = `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''}`;
      } else if (daysRemaining === 0) {
        alertLevel = 'urgent';
        message = 'Due today';
      } else if (daysRemaining <= 2) {
        alertLevel = 'urgent';
        message = `Due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
      } else if (daysRemaining <= 5) {
        alertLevel = 'warning';
        message = `Due in ${daysRemaining} days`;
      } else {
        alertLevel = 'info';
        message = `Due in ${daysRemaining} days`;
      }

      return { item, daysRemaining, alertLevel, message };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export function getAlertColor(alertLevel: DeadlineAlert['alertLevel']): string {
  switch (alertLevel) {
    case 'overdue': return 'var(--oracle-error)';
    case 'urgent': return 'var(--oracle-error)';
    case 'warning': return 'var(--oracle-warning)';
    case 'info': return 'var(--oracle-info)';
    default: return 'var(--oracle-text-muted)';
  }
}

export function getAlertEmoji(alertLevel: DeadlineAlert['alertLevel']): string {
  switch (alertLevel) {
    case 'overdue': return '🚨';
    case 'urgent': return '⏰';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ️';
    default: return '📋';
  }
}

export function getPriorityWeight(priority: DeadlineItem['priority']): number {
  switch (priority) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

export function getDeadlineStats(items: DeadlineItem[]): {
  total: number;
  overdue: number;
  dueSoon: number;
  onTrack: number;
  completed: number;
} {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  return {
    total: items.length,
    overdue: items.filter((i) => i.status !== 'completed' && i.dueDate < now).length,
    dueSoon: items.filter((i) => i.status !== 'completed' && i.dueDate >= now && i.dueDate - now <= 5 * DAY).length,
    onTrack: items.filter((i) => i.status !== 'completed' && i.dueDate - now > 5 * DAY).length,
    completed: items.filter((i) => i.status === 'completed').length,
  };
}
