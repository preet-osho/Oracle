// ═══════════════════════════════════════
// ORACLE — Progress Tracker
// Multi-step task progress · Percentage completion · Status indicators
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export interface ProgressTask {
  id: string;
  title: string;
  steps: ProgressStep[];
  projectId?: string;
  createdAt: number;
  updatedAt: number;
  status: 'in-progress' | 'completed' | 'paused';
}

export interface ProgressStep {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  startedAt?: number;
  completedAt?: number;
}

// ─── Storage ───────────────────────────

const PROGRESS_KEY = 'oracle_progress';

export function createProgressTask(title: string, steps: string[], projectId?: string): ProgressTask {
  const task: ProgressTask = {
    id: crypto.randomUUID(),
    title,
    projectId,
    steps: steps.map((name) => ({
      id: crypto.randomUUID(),
      name,
      status: 'pending',
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'in-progress',
  };
  if (typeof window === 'undefined') return task;
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const tasks: ProgressTask[] = raw ? JSON.parse(raw) : [];
    tasks.unshift(task);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(tasks.slice(0, 200)));
  } catch {
    // Silently fail
  }
  return task;
}

export function getProgressTasks(projectId?: string): ProgressTask[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const tasks: ProgressTask[] = raw ? JSON.parse(raw) : [];
    if (projectId) return tasks.filter((t) => t.projectId === projectId);
    return tasks;
  } catch {
    return [];
  }
}

export function updateStepStatus(taskId: string, stepId: string, status: ProgressStep['status']): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const tasks: ProgressTask[] = raw ? JSON.parse(raw) : [];
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const step = task.steps.find((s) => s.id === stepId);
    if (!step) return;

    step.status = status;
    if (status === 'in-progress' && !step.startedAt) step.startedAt = Date.now();
    if (status === 'completed') step.completedAt = Date.now();

    // Auto-update task status
    const allCompleted = task.steps.every((s) => s.status === 'completed' || s.status === 'skipped');
    task.status = allCompleted ? 'completed' : 'in-progress';
    task.updatedAt = Date.now();

    localStorage.setItem(PROGRESS_KEY, JSON.stringify(tasks));
  } catch {
    // Silently fail
  }
}

export function deleteProgressTask(taskId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const tasks: ProgressTask[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(tasks.filter((t) => t.id !== taskId)));
  } catch {
    // Silently fail
  }
}

// ─── Calculation ───────────────────────

export function getTaskProgress(task: ProgressTask): number {
  if (task.steps.length === 0) return 0;
  const completed = task.steps.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
  return Math.round((completed / task.steps.length) * 100);
}

export function getProgressColor(percent: number): string {
  if (percent >= 100) return 'var(--oracle-success)';
  if (percent >= 60) return 'var(--oracle-primary)';
  if (percent >= 30) return 'var(--oracle-warning)';
  return 'var(--oracle-error)';
}

export function getActiveStep(task: ProgressTask): ProgressStep | null {
  return task.steps.find((s) => s.status === 'in-progress') || null;
}
