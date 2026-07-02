// ═══════════════════════════════════════
// ORACLE — Type-Safe Event Bus
// Replaces untyped CustomEvent/window.dispatchEvent patterns
// with compile-time checked event names and payloads.
// ═══════════════════════════════════════

// ─── Event Definitions ─────────────────

import type { OperatingLoopResult } from '@/lib/agency-operations';

/** All application events and their payload types. */
export interface OracleEventMap {
  'oracle-quick-action': { prompt: string };
  'oracle-projects-update': { projects: Array<{ id: string; clientName: string; industry: string; service: string; status: string; memoryCount: number }> };
  'oracle-quality-update': { score: number };
  'oracle-project-select': { projectId: string | null };
  'oracle-web-search-toggle': { enabled: boolean };
  'oracle-loop-complete': { results: OperatingLoopResult[]; total: number; task: string; timestamp: number };
  'oracle-client-task': { task: string; prompt: string };
  'oracle-task-progress': { taskId: string; clientName: string; status: string; currentAgent?: string; completedAgents: string[]; totalAgents: number; synthesisOutput?: string; error?: string; startedAt: number; elapsed: number };
  'oracle-task-complete': { taskId: string; synthesis: string; agentResults: unknown[]; totalCostUsd: number; totalTokens: number; totalDurationMs: number; success: boolean; error?: string; backgroundEventId?: string };
}

export type OracleEventName = keyof OracleEventMap;

// ─── Dispatch ──────────────────────────

/**
 * Type-safe event dispatch. Compile-time checks event name and payload shape.
 *
 * Usage:
 *   import { emit } from '@/lib/events';
 *   emit('oracle-quick-action', { prompt: 'Write a blog post' });
 */
export function emit<K extends OracleEventName>(name: K, detail: OracleEventMap[K]): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

// ─── Listen ────────────────────────────

/**
 * Type-safe event listener. Returns an unsubscribe function.
 *
 * Usage:
 *   import { on } from '@/lib/events';
 *   useEffect(() => {
 *     return on('oracle-quick-action', (e) => {
 *       setInput(e.detail.prompt);
 *     });
 *   }, []);
 */
export function on<K extends OracleEventName>(
  name: K,
  handler: (event: CustomEvent<OracleEventMap[K]>) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const listener = ((e: Event) => handler(e as CustomEvent<OracleEventMap[K]>)) as EventListener;
  window.addEventListener(name, listener);

  return () => {
    window.removeEventListener(name, listener);
  };
}
