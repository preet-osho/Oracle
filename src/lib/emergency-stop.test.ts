import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  activateEmergencyStop,
  deactivateEmergencyStop,
  isEmergencyStopActive,
  getEmergencyStopStatus,
  canStartSwarm,
  registerSwarmExecution,
  shouldContinueSwarm,
  isWithinCostLimit,
  getCostLimit,
  completeSwarmExecution,
  getActiveSwarms,
} from './emergency-stop';

describe('Emergency Stop', () => {
  beforeEach(() => {
    // Reset state between tests
    deactivateEmergencyStop();
    // Complete all active swarms
    for (const swarm of getActiveSwarms()) {
      completeSwarmExecution(swarm.executionId);
    }
  });

  describe('activateEmergencyStop', () => {
    it('activates the emergency stop', () => {
      activateEmergencyStop('Cost limit exceeded');
      expect(isEmergencyStopActive()).toBe(true);
    });

    it('stores the reason', () => {
      activateEmergencyStop('Budget overrun');
      const status = getEmergencyStopStatus();
      expect(status.reason).toBe('Budget overrun');
    });

    it('records activation timestamp', () => {
      const before = Date.now();
      activateEmergencyStop('Test');
      const status = getEmergencyStopStatus();
      expect(status.activatedAt).toBeGreaterThanOrEqual(before);
      expect(status.activatedAt).toBeLessThanOrEqual(Date.now());
    });

    it('clears all active swarms', () => {
      registerSwarmExecution('user-1', 'task 1');
      registerSwarmExecution('user-1', 'task 2');
      expect(getActiveSwarms().length).toBe(2);

      activateEmergencyStop('Emergency');
      expect(getActiveSwarms().length).toBe(0);
    });
  });

  describe('deactivateEmergencyStop', () => {
    it('deactivates the emergency stop', () => {
      activateEmergencyStop('Test');
      deactivateEmergencyStop();
      expect(isEmergencyStopActive()).toBe(false);
    });

    it('clears reason and timestamp', () => {
      activateEmergencyStop('Test');
      deactivateEmergencyStop();
      const status = getEmergencyStopStatus();
      expect(status.reason).toBeNull();
      expect(status.activatedAt).toBeNull();
    });
  });

  describe('isEmergencyStopActive', () => {
    it('returns false by default', () => {
      expect(isEmergencyStopActive()).toBe(false);
    });

    it('returns true when activated', () => {
      activateEmergencyStop('Test');
      expect(isEmergencyStopActive()).toBe(true);
    });

    it('returns false after deactivation', () => {
      activateEmergencyStop('Test');
      deactivateEmergencyStop();
      expect(isEmergencyStopActive()).toBe(false);
    });
  });

  describe('getEmergencyStopStatus', () => {
    it('returns correct status when inactive', () => {
      const status = getEmergencyStopStatus();
      expect(status.active).toBe(false);
      expect(status.reason).toBeNull();
      expect(status.activatedAt).toBeNull();
      expect(status.activeSwarms).toBe(0);
    });

    it('returns correct status when active', () => {
      activateEmergencyStop('Budget exceeded');
      const status = getEmergencyStopStatus();
      expect(status.active).toBe(true);
      expect(status.reason).toBe('Budget exceeded');
      expect(status.activatedAt).toBeGreaterThan(0);
    });
  });

  describe('canStartSwarm', () => {
    it('returns null when allowed', () => {
      expect(canStartSwarm('user-1')).toBeNull();
    });

    it('returns error when emergency stop is active', () => {
      activateEmergencyStop('Budget exceeded');
      const result = canStartSwarm('user-1');
      expect(result).toContain('Emergency stop');
      expect(result).toContain('Budget exceeded');
    });

    it('returns error when max concurrent swarms reached', () => {
      registerSwarmExecution('user-1', 'task 1');
      registerSwarmExecution('user-1', 'task 2');
      registerSwarmExecution('user-1', 'task 3');
      const result = canStartSwarm('user-1');
      expect(result).toContain('Maximum concurrent');
    });

    it('allows swarm after completing one', () => {
      const id1 = registerSwarmExecution('user-1', 'task 1');
      registerSwarmExecution('user-1', 'task 2');
      registerSwarmExecution('user-1', 'task 3');
      expect(canStartSwarm('user-1')).not.toBeNull();

      completeSwarmExecution(id1!);
      expect(canStartSwarm('user-1')).toBeNull();
    });
  });

  describe('registerSwarmExecution', () => {
    it('returns an execution ID when allowed', () => {
      const id = registerSwarmExecution('user-1', 'Test task');
      expect(id).toBeTruthy();
      expect(id).toMatch(/^swarm_/);
    });

    it('returns null when emergency stop is active', () => {
      activateEmergencyStop('Test');
      const id = registerSwarmExecution('user-1', 'Test task');
      expect(id).toBeNull();
    });

    it('returns null when max swarms reached', () => {
      registerSwarmExecution('user-1', 'task 1');
      registerSwarmExecution('user-1', 'task 2');
      registerSwarmExecution('user-1', 'task 3');
      const id = registerSwarmExecution('user-1', 'task 4');
      expect(id).toBeNull();
    });

    it('tracks the swarm in active list', () => {
      const id = registerSwarmExecution('user-1', 'Test task');
      const active = getActiveSwarms();
      expect(active.some(s => s.executionId === id)).toBe(true);
    });

    it('stores truncated task for debugging', () => {
      const longTask = 'x'.repeat(300);
      const id = registerSwarmExecution('user-1', longTask);
      const active = getActiveSwarms();
      const swarm = active.find(s => s.executionId === id);
      expect(swarm!.taskPreview.length).toBeLessThanOrEqual(200);
    });
  });

  describe('shouldContinueSwarm', () => {
    it('returns null for active swarm within time limit', () => {
      const id = registerSwarmExecution('user-1', 'Test task');
      expect(shouldContinueSwarm(id!)).toBeNull();
    });

    it('returns error when emergency stop activated', () => {
      const id = registerSwarmExecution('user-1', 'Test task');
      activateEmergencyStop('Emergency');
      expect(shouldContinueSwarm(id!)).toContain('Emergency stop');
    });

    it('returns error for unknown execution ID', () => {
      expect(shouldContinueSwarm('swarm_nonexistent')).toContain('not found');
    });

    it('returns error for completed swarm', () => {
      const id = registerSwarmExecution('user-1', 'Test task');
      completeSwarmExecution(id!);
      expect(shouldContinueSwarm(id!)).toContain('not found');
    });
  });

  describe('isWithinCostLimit', () => {
    it('returns true for costs within limit', () => {
      expect(isWithinCostLimit(1.0)).toBe(true);
      expect(isWithinCostLimit(0)).toBe(true);
      expect(isWithinCostLimit(2.0)).toBe(true);
    });

    it('returns false for costs exceeding limit', () => {
      expect(isWithinCostLimit(2.01)).toBe(false);
      expect(isWithinCostLimit(100)).toBe(false);
    });
  });

  describe('getCostLimit', () => {
    it('returns the cost limit', () => {
      expect(getCostLimit()).toBe(2.0);
    });
  });

  describe('completeSwarmExecution', () => {
    it('removes swarm from active list', () => {
      const id = registerSwarmExecution('user-1', 'Test task');
      expect(getActiveSwarms().length).toBe(1);

      completeSwarmExecution(id!);
      expect(getActiveSwarms().length).toBe(0);
    });

    it('handles unknown execution ID gracefully', () => {
      expect(() => completeSwarmExecution('swarm_nonexistent')).not.toThrow();
    });
  });

  describe('getActiveSwarms', () => {
    it('returns empty array by default', () => {
      expect(getActiveSwarms()).toEqual([]);
    });

    it('returns all active swarms', () => {
      registerSwarmExecution('user-1', 'task 1');
      registerSwarmExecution('user-2', 'task 2');
      const active = getActiveSwarms();
      expect(active.length).toBe(2);
    });

    it('includes execution details', () => {
      const id = registerSwarmExecution('user-1', 'Test task');
      const active = getActiveSwarms();
      const swarm = active.find(s => s.executionId === id);
      expect(swarm).toBeDefined();
      expect(swarm!.userId).toBe('user-1');
      expect(swarm!.taskPreview).toBe('Test task');
      expect(swarm!.startedAt).toBeGreaterThan(0);
      expect(swarm!.elapsed).toBeGreaterThanOrEqual(0);
    });
  });
});
