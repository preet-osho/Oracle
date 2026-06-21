// ═══════════════════════════════════════
// ORACLE — Progress Tracker Tests
// Task creation, step status, progress calculation, localStorage persistence
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createProgressTask,
  getProgressTasks,
  updateStepStatus,
  deleteProgressTask,
  getTaskProgress,
  getProgressColor,
  getActiveStep,
  type ProgressTask,
  type ProgressStep,
} from './progress-tracker';

beforeEach(() => {
  localStorage.clear();
});

// ─── createProgressTask Tests ───────────

describe('createProgressTask', () => {
  it('creates a task with given title and steps', () => {
    const task = createProgressTask('Deploy', ['Build', 'Test', 'Ship']);
    expect(task.title).toBe('Deploy');
    expect(task.steps).toHaveLength(3);
    expect(task.steps[0].name).toBe('Build');
    expect(task.steps[1].name).toBe('Test');
    expect(task.steps[2].name).toBe('Ship');
  });

  it('sets all steps to pending', () => {
    const task = createProgressTask('Task', ['A', 'B']);
    for (const step of task.steps) {
      expect(step.status).toBe('pending');
    }
  });

  it('sets task status to in-progress', () => {
    const task = createProgressTask('Task', ['A']);
    expect(task.status).toBe('in-progress');
  });

  it('generates unique IDs', () => {
    const t1 = createProgressTask('A', ['1']);
    const t2 = createProgressTask('B', ['2']);
    expect(t1.id).not.toBe(t2.id);
    expect(t1.steps[0].id).not.toBe(t2.steps[0].id);
  });

  it('sets createdAt and updatedAt to recent timestamps', () => {
    const before = Date.now();
    const task = createProgressTask('Task', []);
    const after = Date.now();
    expect(task.createdAt).toBeGreaterThanOrEqual(before);
    expect(task.createdAt).toBeLessThanOrEqual(after);
    expect(task.updatedAt).toBeGreaterThanOrEqual(before);
    expect(task.updatedAt).toBeLessThanOrEqual(after);
  });

  it('stores in localStorage', () => {
    createProgressTask('Task', ['A']);
    const stored = JSON.parse(localStorage.getItem('oracle_progress') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe('Task');
  });

  it('prepends newest task first', () => {
    createProgressTask('First', ['A']);
    createProgressTask('Second', ['B']);
    const tasks = getProgressTasks();
    expect(tasks[0].title).toBe('Second');
    expect(tasks[1].title).toBe('First');
  });

  it('caps storage at 200 tasks', () => {
    for (let i = 0; i < 210; i++) {
      createProgressTask(`Task ${i}`, ['A']);
    }
    const stored = JSON.parse(localStorage.getItem('oracle_progress') || '[]');
    expect(stored).toHaveLength(200);
  });

  it('includes projectId when provided', () => {
    const task = createProgressTask('Task', ['A'], 'proj-123');
    expect(task.projectId).toBe('proj-123');
  });

  it('handles empty steps array', () => {
    const task = createProgressTask('Empty', []);
    expect(task.steps).toHaveLength(0);
  });
});

// ─── getProgressTasks Tests ─────────────

describe('getProgressTasks', () => {
  it('returns all tasks when no projectId filter', () => {
    createProgressTask('A', []);
    createProgressTask('B', []);
    expect(getProgressTasks()).toHaveLength(2);
  });

  it('filters by projectId', () => {
    createProgressTask('A', [], 'p1');
    createProgressTask('B', [], 'p2');
    createProgressTask('C', [], 'p1');
    expect(getProgressTasks('p1')).toHaveLength(2);
    expect(getProgressTasks('p2')).toHaveLength(1);
  });

  it('returns empty when no tasks stored', () => {
    expect(getProgressTasks()).toEqual([]);
  });

  it('returns empty when localStorage has malformed data', () => {
    localStorage.setItem('oracle_progress', 'not-json');
    expect(getProgressTasks()).toEqual([]);
  });
});

// ─── updateStepStatus Tests ─────────────

describe('updateStepStatus', () => {
  it('updates step status to completed', () => {
    const task = createProgressTask('Task', ['A', 'B']);
    const stepId = task.steps[0].id;
    updateStepStatus(task.id, stepId, 'completed');

    const updated = getProgressTasks().find((t) => t.id === task.id)!;
    expect(updated.steps[0].status).toBe('completed');
    expect(updated.steps[0].completedAt).toBeGreaterThan(0);
  });

  it('sets startedAt when status is in-progress', () => {
    const task = createProgressTask('Task', ['A']);
    updateStepStatus(task.id, task.steps[0].id, 'in-progress');

    const updated = getProgressTasks().find((t) => t.id === task.id)!;
    expect(updated.steps[0].status).toBe('in-progress');
    expect(updated.steps[0].startedAt).toBeGreaterThan(0);
  });

  it('does not overwrite startedAt if already set', () => {
    const task = createProgressTask('Task', ['A']);
    updateStepStatus(task.id, task.steps[0].id, 'in-progress');
    const firstStarted = getProgressTasks().find((t) => t.id === task.id)!.steps[0].startedAt;

    // Update again to in-progress
    updateStepStatus(task.id, task.steps[0].id, 'in-progress');
    const secondStarted = getProgressTasks().find((t) => t.id === task.id)!.steps[0].startedAt;

    expect(secondStarted).toBe(firstStarted);
  });

  it('auto-completes task when all steps are completed', () => {
    const task = createProgressTask('Task', ['A', 'B']);
    updateStepStatus(task.id, task.steps[0].id, 'completed');
    updateStepStatus(task.id, task.steps[1].id, 'completed');

    const updated = getProgressTasks().find((t) => t.id === task.id)!;
    expect(updated.status).toBe('completed');
  });

  it('auto-completes task when all steps are completed or skipped', () => {
    const task = createProgressTask('Task', ['A', 'B']);
    updateStepStatus(task.id, task.steps[0].id, 'completed');
    updateStepStatus(task.id, task.steps[1].id, 'skipped');

    const updated = getProgressTasks().find((t) => t.id === task.id)!;
    expect(updated.status).toBe('completed');
  });

  it('keeps task in-progress when some steps are pending', () => {
    const task = createProgressTask('Task', ['A', 'B']);
    updateStepStatus(task.id, task.steps[0].id, 'completed');

    const updated = getProgressTasks().find((t) => t.id === task.id)!;
    expect(updated.status).toBe('in-progress');
  });

  it('updates updatedAt timestamp', () => {
    const task = createProgressTask('Task', ['A']);
    const before = Date.now();
    updateStepStatus(task.id, task.steps[0].id, 'completed');
    const updated = getProgressTasks().find((t) => t.id === task.id)!;
    expect(updated.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('does nothing for unknown taskId', () => {
    createProgressTask('Task', ['A']);
    updateStepStatus('nonexistent', 'step-1', 'completed');
    expect(getProgressTasks()[0].steps[0].status).toBe('pending');
  });

  it('does nothing for unknown stepId', () => {
    const task = createProgressTask('Task', ['A']);
    updateStepStatus(task.id, 'nonexistent', 'completed');
    expect(getProgressTasks()[0].steps[0].status).toBe('pending');
  });
});

// ─── deleteProgressTask Tests ───────────

describe('deleteProgressTask', () => {
  it('removes the specified task', () => {
    const t1 = createProgressTask('A', []);
    const t2 = createProgressTask('B', []);
    deleteProgressTask(t1.id);
    const remaining = getProgressTasks();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(t2.id);
  });

  it('does nothing for unknown taskId', () => {
    createProgressTask('A', []);
    deleteProgressTask('nonexistent');
    expect(getProgressTasks()).toHaveLength(1);
  });

  it('handles empty storage', () => {
    deleteProgressTask('anything');
    expect(getProgressTasks()).toEqual([]);
  });
});

// ─── getTaskProgress Tests ──────────────

describe('getTaskProgress', () => {
  it('returns 0 for empty steps', () => {
    const task = createProgressTask('Empty', []);
    expect(getTaskProgress(task)).toBe(0);
  });

  it('returns 0 when no steps completed', () => {
    const task = createProgressTask('Task', ['A', 'B', 'C']);
    expect(getTaskProgress(task)).toBe(0);
  });

  it('returns 100 when all steps completed', () => {
    const task: ProgressTask = {
      id: '1', title: 'T', createdAt: 0, updatedAt: 0, status: 'in-progress',
      steps: [
        { id: '1', name: 'A', status: 'completed' },
        { id: '2', name: 'B', status: 'completed' },
      ],
    };
    expect(getTaskProgress(task)).toBe(100);
  });

  it('counts skipped as completed', () => {
    const task: ProgressTask = {
      id: '1', title: 'T', createdAt: 0, updatedAt: 0, status: 'in-progress',
      steps: [
        { id: '1', name: 'A', status: 'completed' },
        { id: '2', name: 'B', status: 'skipped' },
        { id: '3', name: 'C', status: 'pending' },
      ],
    };
    // 2/3 = 66.67 → 67
    expect(getTaskProgress(task)).toBe(67);
  });

  it('calculates partial progress', () => {
    const task: ProgressTask = {
      id: '1', title: 'T', createdAt: 0, updatedAt: 0, status: 'in-progress',
      steps: [
        { id: '1', name: 'A', status: 'completed' },
        { id: '2', name: 'B', status: 'pending' },
      ],
    };
    expect(getTaskProgress(task)).toBe(50);
  });

  it('rounds to nearest integer', () => {
    const task: ProgressTask = {
      id: '1', title: 'T', createdAt: 0, updatedAt: 0, status: 'in-progress',
      steps: [
        { id: '1', name: 'A', status: 'completed' },
        { id: '2', name: 'B', status: 'pending' },
        { id: '3', name: 'C', status: 'pending' },
      ],
    };
    // 1/3 = 33.33 → 33
    expect(getTaskProgress(task)).toBe(33);
  });
});

// ─── getProgressColor Tests ─────────────

describe('getProgressColor', () => {
  it('returns success for 100%', () => {
    expect(getProgressColor(100)).toBe('var(--oracle-success)');
    expect(getProgressColor(110)).toBe('var(--oracle-success)');
  });

  it('returns primary for 60-99', () => {
    expect(getProgressColor(60)).toBe('var(--oracle-primary)');
    expect(getProgressColor(85)).toBe('var(--oracle-primary)');
  });

  it('returns warning for 30-59', () => {
    expect(getProgressColor(30)).toBe('var(--oracle-warning)');
    expect(getProgressColor(50)).toBe('var(--oracle-warning)');
  });

  it('returns error for 0-29', () => {
    expect(getProgressColor(0)).toBe('var(--oracle-error)');
    expect(getProgressColor(15)).toBe('var(--oracle-error)');
  });
});

// ─── getActiveStep Tests ────────────────

describe('getActiveStep', () => {
  it('returns the in-progress step', () => {
    const task: ProgressTask = {
      id: '1', title: 'T', createdAt: 0, updatedAt: 0, status: 'in-progress',
      steps: [
        { id: '1', name: 'A', status: 'completed' },
        { id: '2', name: 'B', status: 'in-progress' },
        { id: '3', name: 'C', status: 'pending' },
      ],
    };
    expect(getActiveStep(task)?.id).toBe('2');
  });

  it('returns null when no step is in-progress', () => {
    const task: ProgressTask = {
      id: '1', title: 'T', createdAt: 0, updatedAt: 0, status: 'completed',
      steps: [
        { id: '1', name: 'A', status: 'completed' },
        { id: '2', name: 'B', status: 'completed' },
      ],
    };
    expect(getActiveStep(task)).toBeNull();
  });

  it('returns null for empty steps', () => {
    const task: ProgressTask = {
      id: '1', title: 'T', createdAt: 0, updatedAt: 0, status: 'completed',
      steps: [],
    };
    expect(getActiveStep(task)).toBeNull();
  });
});
