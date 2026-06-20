// ═══════════════════════════════════════
// ORACLE — Emergency Stop
// Global kill switch for all running swarm executions
// Prevents runaway AI agent loops and cost explosions
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';

const log = createLogger('EmergencyStop');

// ─── State ─────────────────────────────

/** Global emergency stop flag — when true, all swarm executions abort */
let emergencyStopActive = false;

/** Reason for the emergency stop */
let stopReason: string | null = null;

/** Timestamp when emergency stop was activated */
let stopActivatedAt: number | null = null;

/** Maximum concurrent swarm executions */
const MAX_CONCURRENT_SWARMS = 3;

/** Active swarm execution tracking */
const activeSwarms = new Map<string, { startedAt: number; userId?: string; task: string }>();

/** Cost limit per swarm execution (USD) */
const MAX_SWARM_COST_USD = 2.0;

/** Maximum execution time per swarm (ms) */
const MAX_SWARM_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ─── Public API ────────────────────────

/**
 * Activate the emergency stop. All running and new swarm executions will abort.
 */
export function activateEmergencyStop(reason: string): void {
  emergencyStopActive = true;
  stopReason = reason;
  stopActivatedAt = Date.now();

  log.error('EMERGENCY STOP ACTIVATED', {
    reason,
    activeSwarms: activeSwarms.size,
  });

  // Clear all active swarm tracking (they'll abort on next check)
  activeSwarms.clear();
}

/**
 * Deactivate the emergency stop. New swarm executions can proceed.
 */
export function deactivateEmergencyStop(): void {
  emergencyStopActive = false;
  stopReason = null;
  stopActivatedAt = null;

  log.info('Emergency stop deactivated');
}

/**
 * Check if the emergency stop is currently active.
 */
export function isEmergencyStopActive(): boolean {
  return emergencyStopActive;
}

/**
 * Get the current emergency stop status.
 */
export function getEmergencyStopStatus(): {
  active: boolean;
  reason: string | null;
  activatedAt: number | null;
  activeSwarms: number;
} {
  return {
    active: emergencyStopActive,
    reason: stopReason,
    activatedAt: stopActivatedAt,
    activeSwarms: activeSwarms.size,
  };
}

/**
 * Check if a new swarm execution is allowed.
 * Returns null if allowed, or an error message if blocked.
 */
export function canStartSwarm(userId?: string): string | null {
  if (emergencyStopActive) {
    return `Emergency stop is active: ${stopReason || 'No reason provided'}. All executions are paused.`;
  }

  if (activeSwarms.size >= MAX_CONCURRENT_SWARMS) {
    return `Maximum concurrent swarm executions (${MAX_CONCURRENT_SWARMS}) reached. Wait for current executions to complete.`;
  }

  return null;
}

/**
 * Register a new swarm execution. Returns an execution ID.
 * Returns null if the swarm cannot start.
 */
export function registerSwarmExecution(
  userId: string | undefined,
  task: string
): string | null {
  const blockReason = canStartSwarm(userId);
  if (blockReason) {
    log.warn('Swarm execution blocked', { reason: blockReason, userId });
    return null;
  }

  const executionId = `swarm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  activeSwarms.set(executionId, {
    startedAt: Date.now(),
    userId,
    task: task.slice(0, 200), // Store truncated task for debugging
  });

  log.info('Swarm execution registered', {
    executionId,
    userId,
    activeCount: activeSwarms.size,
  });

  return executionId;
}

/**
 * Check if a specific swarm execution should continue.
 * Returns null if OK, or a reason to abort.
 */
export function shouldContinueSwarm(executionId: string): string | null {
  if (emergencyStopActive) {
    return `Emergency stop activated: ${stopReason}`;
  }

  const swarm = activeSwarms.get(executionId);
  if (!swarm) {
    return 'Swarm execution not found or already completed';
  }

  const elapsed = Date.now() - swarm.startedAt;
  if (elapsed > MAX_SWARM_DURATION_MS) {
    return `Swarm execution exceeded maximum duration (${MAX_SWARM_DURATION_MS / 1000}s)`;
  }

  return null;
}

/**
 * Check if a cost estimate is within budget limits.
 */
export function isWithinCostLimit(estimatedCostUsd: number): boolean {
  return estimatedCostUsd <= MAX_SWARM_COST_USD;
}

/**
 * Get the current cost limit.
 */
export function getCostLimit(): number {
  return MAX_SWARM_COST_USD;
}

/**
 * Complete a swarm execution.
 */
export function completeSwarmExecution(executionId: string): void {
  const swarm = activeSwarms.get(executionId);
  if (swarm) {
    const duration = Date.now() - swarm.startedAt;
    log.info('Swarm execution completed', {
      executionId,
      durationMs: duration,
      remaining: activeSwarms.size - 1,
    });
    activeSwarms.delete(executionId);
  }
}

/**
 * Get a list of all active swarm executions (for monitoring).
 */
export function getActiveSwarms(): Array<{
  executionId: string;
  startedAt: number;
  elapsed: number;
  userId?: string;
  taskPreview: string;
}> {
  const result: Array<{
    executionId: string;
    startedAt: number;
    elapsed: number;
    userId?: string;
    taskPreview: string;
  }> = [];

  for (const [executionId, swarm] of activeSwarms) {
    result.push({
      executionId,
      startedAt: swarm.startedAt,
      elapsed: Date.now() - swarm.startedAt,
      userId: swarm.userId,
      taskPreview: swarm.task,
    });
  }

  return result;
}
