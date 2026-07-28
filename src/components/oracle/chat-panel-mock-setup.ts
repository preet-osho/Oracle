/**
 * ORACLE — Shared ChatPanel mock setup.
 *
 * This module provides:
 * 1. A resetChatPanelMocks() function for beforeEach setup
 * 2. A ChatPanelMockInstances type for the mock instances object
 *
 * CONSTRAINT: Due to Vitest's vi.mock() hoisting model:
 * - vi.hoisted() mock instances MUST be defined inline in each test file
 *   (imported functions are TDZ when vi.hoisted() runs)
 * - vi.mock() calls MUST be at the TOP LEVEL of each test file
 *   (Vitest only hoists vi.mock() calls that appear directly in the file body,
 *    NOT nested inside function definitions — do NOT attempt to extract them
 *    into helper functions, even if called from the top level)
 *
 * This module only provides the shared reset logic and type.
 * Mock values are loaded via require() inside vi.hoisted() in each test file.
 *
 * Usage in test files (new factory pattern — preferred):
 * ```typescript
 * import { resetChatPanelMocks } from './chat-panel-mock-setup';
 *
 * const SHARED = vi.hoisted(() => require('./test-utils.mocks.cjs'));
 *
 * const { m, factories } = vi.hoisted(() => {
 *   const instances = SHARED.createChatPanelMockInstances(vi.fn);
 *   return {
 *     m: instances,
 *     factories: SHARED.createChatPanelMockFactories(instances, vi.fn),
 *   };
 * });
 *
 * // vi.mock() calls use factories.* one-liners instead of inline factories
 * vi.mock('nanoid', () => factories.nanoid);
 * vi.mock('@/styles/design-tokens', () => factories.designTokens);
 * vi.mock('@/lib/api', () => factories.api);
 * // ... other vi.mock() calls use factories.*
 *
 * describe('...', () => {
 *   beforeEach(() => resetChatPanelMocks(m));
 *   // test cases reference m.mockNanoid, m.streamingEnabledRef, etc.
 * });
 * ```
 *
 * Legacy pattern (still works but not recommended):
 * ```typescript
 * const m = vi.hoisted(() => ({
 *   mockNanoid: vi.fn(() => 'test-id'),
 *   streamingEnabledRef: { current: true },
 *   // ... all mock instances defined inline
 * }));
 * vi.mock('nanoid', () => ({ nanoid: m.mockNanoid }));
 * ```
 */
import { vi } from 'vitest';

// ─── Mock instance type ───

/**
 * Interface for the mock instances object created by vi.hoisted() in each test file.
 * Used by resetChatPanelMocks() to reset mocks in beforeEach.
 */
export interface ChatPanelMockInstances {
  mockNanoid: ReturnType<typeof vi.fn>;
  resetNanoid: () => void;
  mockToast: ReturnType<typeof vi.fn>;
  mockToastError: ReturnType<typeof vi.fn>;
  resetToastMocks: () => void;
  mockRunOperatingLoop: ReturnType<typeof vi.fn>;
  analyzeTask: ReturnType<typeof vi.fn>;
  mockLoadGuardConfig: ReturnType<typeof vi.fn>;
  mockRunHallucinationGuard: ReturnType<typeof vi.fn>;
  mockRecordLearning: ReturnType<typeof vi.fn>;
  mockAddCost: ReturnType<typeof vi.fn>;
  mockAddUsageRecord: ReturnType<typeof vi.fn>;
  streamingEnabledRef: { current: boolean };
  mockRecordProviderHealth: ReturnType<typeof vi.fn>;
  mockRunEditorGate: ReturnType<typeof vi.fn>;
  mockRunQualityGates: ReturnType<typeof vi.fn>;
}

/**
 * Resets all mock instances to their default state.
 * Call this in beforeEach() for each test.
 */
export function resetChatPanelMocks(mocks: ChatPanelMockInstances): void {
  mocks.streamingEnabledRef.current = true;
  mocks.resetNanoid();
  mocks.resetToastMocks();
  mocks.mockRecordLearning.mockClear();
  mocks.mockRunOperatingLoop.mockResolvedValue([]);
  mocks.mockRecordProviderHealth.mockClear();
  mocks.mockAddCost.mockClear();
  mocks.mockAddUsageRecord.mockClear();
  mocks.mockLoadGuardConfig.mockReturnValue({
    enabled: false,
    thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 },
  });
  mocks.mockRunHallucinationGuard.mockResolvedValue({
    confidence: 80,
    assessment: 'Looks good',
    checks: [],
    suggestions: [],
  });
  mocks.mockRunEditorGate.mockResolvedValue({ passed: true, confidence: 90, assessment: 'OK', issues: [], checkedAt: Date.now() });
  mocks.mockRunQualityGates.mockReturnValue({ passed: true, score: 80, checks: [] });
}
