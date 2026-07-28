/**
 * Smoke tests for createChatPanelMockInstances and createChatPanelMockFactories
 * from test-utils.mocks.cjs.
 *
 * Verifies that the factory functions return expected keys and that mock instances
 * are callable with correct default behaviors.
 */
import { describe, it, expect, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SHARED = require('./test-utils.mocks.cjs');

// ─── createChatPanelMockInstances ───

describe('createChatPanelMockInstances', () => {
  it('returns an object with all expected keys', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const expectedKeys = [
      'mockNanoid', 'resetNanoid', 'mockToast', 'mockToastError',
      'resetToastMocks', 'mockRunOperatingLoop', 'analyzeTask',
      'mockLoadGuardConfig', 'mockRunHallucinationGuard', 'mockRecordLearning',
      'mockAddCost', 'mockAddUsageRecord', 'streamingEnabledRef',
      'mockRecordProviderHealth',
    ];
    for (const key of expectedKeys) {
      expect(m).toHaveProperty(key);
    }
  });

  it('mockNanoid is callable and returns sequential IDs', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    expect(m.mockNanoid()).toBe('test-id-1');
    expect(m.mockNanoid()).toBe('test-id-2');
    expect(m.mockNanoid()).toBe('test-id-3');
  });

  it('resetNanoid resets counter and clears mock calls', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    m.mockNanoid();
    m.mockNanoid();
    m.resetNanoid();
    expect(m.mockNanoid()).toBe('test-id-1');
  });

  it('mockToast and mockToastError are callable vi.fn instances', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    m.mockToast('hello');
    m.mockToastError('oops');
    expect(m.mockToast).toHaveBeenCalledWith('hello');
    expect(m.mockToastError).toHaveBeenCalledWith('oops');
  });

  it('resetToastMocks clears both toast mocks', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    m.mockToast('a');
    m.mockToastError('b');
    m.resetToastMocks();
    expect(m.mockToast).not.toHaveBeenCalled();
    expect(m.mockToastError).not.toHaveBeenCalled();
  });

  it('mockRunOperatingLoop returns a resolved promise with empty array', async () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const result = await m.mockRunOperatingLoop();
    expect(result).toEqual([]);
  });

  it('analyzeTask returns default task analysis', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const result = m.analyzeTask('test task');
    expect(result).toEqual({ complexity: 0.3, agents: [], suggestedTier: 'standard' });
  });

  it('mockLoadGuardConfig returns default config', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const config = m.mockLoadGuardConfig();
    expect(config).toEqual({
      enabled: false,
      thresholds: { passThreshold: 70, warnThreshold: 50, blockThreshold: 30 },
    });
  });

  it('mockRunHallucinationGuard returns a resolved promise with default assessment', async () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const result = await m.mockRunHallucinationGuard();
    expect(result).toEqual({
      confidence: 80,
      assessment: 'Looks good',
      checks: [],
      suggestions: [],
    });
  });

  it('streamingEnabledRef starts with current=true', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    expect(m.streamingEnabledRef.current).toBe(true);
  });

  it('streamingEnabledRef.current can be toggled', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    m.streamingEnabledRef.current = false;
    expect(m.streamingEnabledRef.current).toBe(false);
    m.streamingEnabledRef.current = true;
    expect(m.streamingEnabledRef.current).toBe(true);
  });

  it('mockAddCost, mockAddUsageRecord, mockRecordLearning, mockRecordProviderHealth are callable', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    m.mockAddCost(0.01);
    m.mockAddUsageRecord({ tokens: 100 });
    m.mockRecordLearning({ lesson: 'test' });
    m.mockRecordProviderHealth({ provider: 'openai' });
    expect(m.mockAddCost).toHaveBeenCalledWith(0.01);
    expect(m.mockAddUsageRecord).toHaveBeenCalledWith({ tokens: 100 });
    expect(m.mockRecordLearning).toHaveBeenCalledWith({ lesson: 'test' });
    expect(m.mockRecordProviderHealth).toHaveBeenCalledWith({ provider: 'openai' });
  });
});

// ─── createChatPanelMockFactories ───

describe('createChatPanelMockFactories', () => {
  it('returns an object with all expected factory keys', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    const expectedKeys = [
      'nanoid', 'designTokens', 'router', 'routerStore', 'api', 'rag',
      'memory', 'quality', 'systemPrompt', 'hallucinationGuard', 'toast',
      'tokenBudget', 'contextManager', 'utils', 'exportUtils', 'search',
      'csrf', 'selfTraining', 'crossDomainThinking', 'patternRecognition',
      'searchHelpers', 'workflowValidation', 'toastConfig', 'taskAnalyzer',
      'providerHealth', 'editorGate', 'outputQualityEvaluator',
      'feedbackBridge', 'agencyOperations', 'promptSanitizer', 'guardStatsPanel',
    ];
    for (const key of expectedKeys) {
      expect(f).toHaveProperty(key);
    }
  });

  it('nanoid factory exposes the mockNanoid from instances', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    expect(f.nanoid.nanoid).toBe(m.mockNanoid);
    expect(f.nanoid.nanoid()).toBe('test-id-1');
  });

  it('designTokens factory has expected shape', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    expect(f.designTokens).toHaveProperty('motionVariants');
    expect(f.designTokens).toHaveProperty('transitions');
    expect(f.designTokens).toHaveProperty('QUICK_START_CARDS');
  });

  it('router factory has NeverStopRouter.calculateCost', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    expect(f.router.NeverStopRouter.calculateCost).toBeDefined();
    expect(f.router.NeverStopRouter.calculateCost()).toEqual({ usd: 0.001, inr: 0.084 });
  });

  it('routerStore factory reads streamingEnabled from ref at call time', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    expect(f.routerStore.useRouterStore().streamingEnabled).toBe(true);
    m.streamingEnabledRef.current = false;
    expect(f.routerStore.useRouterStore().streamingEnabled).toBe(false);
  });

  it('api factory has conversationsApi with list/get/create/update/delete', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    expect(f.api.conversationsApi.list).toBeDefined();
    expect(f.api.conversationsApi.get).toBeDefined();
    expect(f.api.conversationsApi.create).toBeDefined();
    expect(f.api.conversationsApi.update).toBeDefined();
    expect(f.api.conversationsApi.delete).toBeDefined();
  });

  it('taskAnalyzer factory exposes analyzeTask from instances', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    expect(f.taskAnalyzer.analyzeTask).toBe(m.analyzeTask);
  });

  it('providerHealth factory exposes recordProviderHealth from instances', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    expect(f.providerHealth.recordProviderHealth).toBe(m.mockRecordProviderHealth);
  });

  it('agencyOperations factory has runOperatingLoop from instances', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    expect(f.agencyOperations.runOperatingLoop).toBe(m.mockRunOperatingLoop);
  });

  it('toast factory wraps mockToast and mockToastError', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    // toast factory returns { __esModule: true, default: <fn with .error> }
    // so error lives on f.toast.default.error, not f.toast.error
    f.toast.default('hello');
    f.toast.default.error('oops');
    expect(m.mockToast).toHaveBeenCalledWith('hello');
    expect(m.mockToastError).toHaveBeenCalledWith('oops');
  });

  it('hallucinationGuard factory wraps guard mocks', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    f.hallucinationGuard.loadGuardConfig();
    f.hallucinationGuard.runHallucinationGuard();
    f.hallucinationGuard.recordLearning({ lesson: 'test' });
    expect(m.mockLoadGuardConfig).toHaveBeenCalled();
    expect(m.mockRunHallucinationGuard).toHaveBeenCalled();
    expect(m.mockRecordLearning).toHaveBeenCalledWith({ lesson: 'test' });
  });

  it('workflowValidation factory has VALID_AGENTS array', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    expect(Array.isArray(f.workflowValidation.VALID_AGENTS)).toBe(true);
    expect(f.workflowValidation.VALID_AGENTS).toContain('researcher');
    expect(f.workflowValidation.VALID_AGENTS).toContain('developer');
  });

  // ─── editorGate factory ───

  it('editorGate factory has all expected keys', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    expect(f.editorGate).toHaveProperty('runEditorGate');
    expect(f.editorGate).toHaveProperty('loadEditorConfig');
    expect(f.editorGate).toHaveProperty('saveEditorConfig');
    expect(f.editorGate).toHaveProperty('DEFAULT_EDITOR_CONFIG');
  });

  it('editorGate.runEditorGate resolves with default assessment', async () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    const result = await f.editorGate.runEditorGate('test content', 'researcher');
    expect(result).toEqual(expect.objectContaining({ passed: true, confidence: 90, assessment: 'OK', issues: [] }));
    expect(typeof result.checkedAt).toBe('number');
  });

  it('editorGate.loadEditorConfig returns default config', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    const config = f.editorGate.loadEditorConfig();
    expect(config).toEqual({ enabled: true, minLength: 100, skipAgentTypes: [] });
  });

  it('editorGate.DEFAULT_EDITOR_CONFIG matches loadEditorConfig default', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    expect(f.editorGate.DEFAULT_EDITOR_CONFIG).toEqual(f.editorGate.loadEditorConfig());
  });

  it('editorGate.saveEditorConfig is callable', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    expect(typeof f.editorGate.saveEditorConfig).toBe('function');
    // saveEditorConfig is a stubFn() — calling it should not throw
    f.editorGate.saveEditorConfig({ enabled: false, minLength: 200, skipAgentTypes: [] });
  });

  // ─── outputQualityEvaluator factory ───

  it('outputQualityEvaluator factory has evaluateOutput key', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    expect(f.outputQualityEvaluator).toHaveProperty('evaluateOutput');
  });

  it('outputQualityEvaluator.evaluateOutput returns default evaluation', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    const result = f.outputQualityEvaluator.evaluateOutput('test output', 'researcher');
    expect(result).toEqual({ passed: true, overallScore: 85, checks: [], suggestions: [] });
  });

  it('outputQualityEvaluator.evaluateOutput is callable with no args', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    const result = f.outputQualityEvaluator.evaluateOutput();
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('overallScore');
  });

  // ─── feedbackBridge factory ───

  it('feedbackBridge factory has all expected keys', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    expect(f.feedbackBridge).toHaveProperty('attachQualityToTraining');
    expect(f.feedbackBridge).toHaveProperty('recordMessageFeedback');
    expect(f.feedbackBridge).toHaveProperty('recordGuardVerdict');
  });

  it('feedbackBridge.attachQualityToTraining is callable', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    f.feedbackBridge.attachQualityToTraining({ score: 80, agent: 'researcher' });
    // stubFn records calls — no assertion on return value (returns undefined)
    expect(typeof f.feedbackBridge.attachQualityToTraining).toBe('function');
  });

  it('feedbackBridge.recordMessageFeedback is callable', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    f.feedbackBridge.recordMessageFeedback({ messageId: 'msg-1', rating: 'positive' });
    expect(typeof f.feedbackBridge.recordMessageFeedback).toBe('function');
  });

  it('feedbackBridge.recordGuardVerdict is callable', () => {
    const m = SHARED.createChatPanelMockInstances(vi.fn);
    const f = SHARED.createChatPanelMockFactories(m, vi.fn);
    f.feedbackBridge.recordGuardVerdict({ guard: 'hallucination', passed: true });
    expect(typeof f.feedbackBridge.recordGuardVerdict).toBe('function');
  });
});
