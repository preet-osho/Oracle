import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordGodModeToggle,
  recordGodModeMessage,
  updateGodModeMessageQuality,
  getGodModeMetrics,
  getGodModeCostAnalysis,
  getGodModeTimelineData,
  recordNormalMessageTokens,
  clearGodModeMetrics,
  type GodModeMessageEntry,
} from './god-mode-metrics';

const GOD_MODE_METRICS_KEY = 'oracle_god_mode_metrics';
const GOD_MODE_HISTORY_KEY = 'oracle_god_mode_history';

function makeToggle(overrides?: Partial<{ enabled: boolean; agentType: string }>) {
  return {
    enabled: overrides?.enabled ?? true,
    agentType: overrides?.agentType ?? 'researcher',
  };
}

function makeMessage(overrides?: Partial<Omit<GodModeMessageEntry, 'id' | 'timestamp'>>): Omit<GodModeMessageEntry, 'id' | 'timestamp'> {
  return {
    agentType: overrides?.agentType ?? 'researcher',
    provider: overrides?.provider ?? 'groq',
    model: overrides?.model ?? 'llama-3.3',
    tokensUsed: overrides?.tokensUsed ?? 150,
    wasSuccessful: overrides?.wasSuccessful ?? true,
    qualityScore: overrides?.qualityScore,
  };
}

describe('recordGodModeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores toggle entry with id and timestamp', () => {
    recordGodModeToggle(true, 'researcher');
    const raw = localStorage.getItem(GOD_MODE_METRICS_KEY);
    expect(raw).toBeTruthy();
    const entries = JSON.parse(raw!);
    expect(entries.length).toBe(1);
    expect(entries[0].id).toBeDefined();
    expect(entries[0].timestamp).toBeGreaterThan(0);
    expect(entries[0].enabled).toBe(true);
    expect(entries[0].agentType).toBe('researcher');
  });

  it('records disable toggle as well', () => {
    recordGodModeToggle(false, 'writer');
    const entries = JSON.parse(localStorage.getItem(GOD_MODE_METRICS_KEY)!);
    expect(entries[0].enabled).toBe(false);
  });

  it('appends multiple toggles', () => {
    recordGodModeToggle(true, 'researcher');
    recordGodModeToggle(false, 'writer');
    recordGodModeToggle(true, 'developer');
    const entries = JSON.parse(localStorage.getItem(GOD_MODE_METRICS_KEY)!);
    expect(entries.length).toBe(3);
    expect(entries[0].agentType).toBe('researcher');
    expect(entries[1].agentType).toBe('writer');
    expect(entries[2].agentType).toBe('developer');
  });

  it('caps storage at 200 entries', () => {
    for (let i = 0; i < 210; i++) {
      recordGodModeToggle(i % 2 === 0, `agent-${i}`);
    }
    const entries = JSON.parse(localStorage.getItem(GOD_MODE_METRICS_KEY)!);
    expect(entries.length).toBe(200);
    expect(entries[0].agentType).toBe('agent-10');
  });
});

describe('recordGodModeMessage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns a string id', () => {
    const id = recordGodModeMessage(makeMessage());
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('stores message entry with id and timestamp', () => {
    const id = recordGodModeMessage(makeMessage());
    const entries = JSON.parse(localStorage.getItem(GOD_MODE_HISTORY_KEY)!);
    expect(entries.length).toBe(1);
    expect(entries[0].id).toBe(id);
    expect(entries[0].timestamp).toBeGreaterThan(0);
    expect(entries[0].agentType).toBe('researcher');
    expect(entries[0].provider).toBe('groq');
    expect(entries[0].model).toBe('llama-3.3');
    expect(entries[0].tokensUsed).toBe(150);
    expect(entries[0].wasSuccessful).toBe(true);
  });

  it('stores quality score when provided', () => {
    recordGodModeMessage(makeMessage({ qualityScore: 85 }));
    const entries = JSON.parse(localStorage.getItem(GOD_MODE_HISTORY_KEY)!);
    expect(entries[0].qualityScore).toBe(85);
  });

  it('appends multiple messages', () => {
    recordGodModeMessage(makeMessage({ agentType: 'researcher' }));
    recordGodModeMessage(makeMessage({ agentType: 'writer' }));
    recordGodModeMessage(makeMessage({ agentType: 'developer' }));
    const entries = JSON.parse(localStorage.getItem(GOD_MODE_HISTORY_KEY)!);
    expect(entries.length).toBe(3);
  });

  it('caps storage at 500 entries', () => {
    for (let i = 0; i < 510; i++) {
      recordGodModeMessage(makeMessage({ agentType: `agent-${i}` }));
    }
    const entries = JSON.parse(localStorage.getItem(GOD_MODE_HISTORY_KEY)!);
    expect(entries.length).toBe(500);
    expect(entries[0].agentType).toBe('agent-10');
  });
});

describe('updateGodModeMessageQuality', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('updates quality score for an existing message', () => {
    const id = recordGodModeMessage(makeMessage());
    updateGodModeMessageQuality(id, 92);
    const entries = JSON.parse(localStorage.getItem(GOD_MODE_HISTORY_KEY)!);
    expect(entries[0].qualityScore).toBe(92);
  });

  it('does nothing for non-existent message id', () => {
    recordGodModeMessage(makeMessage());
    updateGodModeMessageQuality('non-existent-id', 92);
    const entries = JSON.parse(localStorage.getItem(GOD_MODE_HISTORY_KEY)!);
    expect(entries[0].qualityScore).toBeUndefined();
  });

  it('only updates the targeted message', () => {
    const id1 = recordGodModeMessage(makeMessage({ agentType: 'researcher' }));
    const id2 = recordGodModeMessage(makeMessage({ agentType: 'writer' }));
    updateGodModeMessageQuality(id1, 92);
    const entries = JSON.parse(localStorage.getItem(GOD_MODE_HISTORY_KEY)!);
    const entry1 = entries.find((e: GodModeMessageEntry) => e.id === id1);
    const entry2 = entries.find((e: GodModeMessageEntry) => e.id === id2);
    expect(entry1.qualityScore).toBe(92);
    expect(entry2.qualityScore).toBeUndefined();
  });
});

describe('getGodModeMetrics', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty metrics when no data', () => {
    const metrics = getGodModeMetrics();
    expect(metrics.totalToggles).toBe(0);
    expect(metrics.totalMessages).toBe(0);
    expect(metrics.successfulMessages).toBe(0);
    expect(metrics.totalTokens).toBe(0);
    expect(metrics.avgQuality).toBe(0);
    expect(metrics.firstToggleAt).toBeNull();
    expect(metrics.lastMessageAt).toBeNull();
    expect(metrics.godModeMessageRatio).toBe(0);
    expect(Object.keys(metrics.agentBreakdown)).toHaveLength(0);
    expect(Object.keys(metrics.providerBreakdown)).toHaveLength(0);
  });

  it('counts only enabled toggles', () => {
    recordGodModeToggle(true, 'researcher');
    recordGodModeToggle(false, 'writer');
    recordGodModeToggle(true, 'developer');
    const metrics = getGodModeMetrics();
    expect(metrics.totalToggles).toBe(2);
  });

  it('tracks agent breakdown correctly', () => {
    recordGodModeMessage(makeMessage({ agentType: 'researcher', tokensUsed: 100, wasSuccessful: true }));
    recordGodModeMessage(makeMessage({ agentType: 'researcher', tokensUsed: 200, wasSuccessful: true }));
    recordGodModeMessage(makeMessage({ agentType: 'writer', tokensUsed: 150, wasSuccessful: false }));
    const metrics = getGodModeMetrics();
    expect(metrics.agentBreakdown['researcher'].count).toBe(2);
    expect(metrics.agentBreakdown['researcher'].successCount).toBe(2);
    expect(metrics.agentBreakdown['researcher'].totalTokens).toBe(300);
    expect(metrics.agentBreakdown['writer'].count).toBe(1);
    expect(metrics.agentBreakdown['writer'].successCount).toBe(0);
    expect(metrics.agentBreakdown['writer'].totalTokens).toBe(150);
  });

  it('tracks provider breakdown correctly', () => {
    recordGodModeMessage(makeMessage({ provider: 'groq', tokensUsed: 100 }));
    recordGodModeMessage(makeMessage({ provider: 'google', tokensUsed: 200 }));
    const metrics = getGodModeMetrics();
    expect(metrics.providerBreakdown['groq'].count).toBe(1);
    expect(metrics.providerBreakdown['google'].count).toBe(1);
  });

  it('calculates avgQuality from scored messages only', () => {
    recordGodModeMessage(makeMessage({ qualityScore: 80 }));
    recordGodModeMessage(makeMessage({ qualityScore: 100 }));
    recordGodModeMessage(makeMessage());
    const metrics = getGodModeMetrics();
    expect(metrics.avgQuality).toBe(90);
  });

  it('returns avgQuality 0 when no scores exist', () => {
    recordGodModeMessage(makeMessage());
    recordGodModeMessage(makeMessage());
    const metrics = getGodModeMetrics();
    expect(metrics.avgQuality).toBe(0);
  });

  it('calculates totalTokens correctly', () => {
    recordGodModeMessage(makeMessage({ tokensUsed: 100 }));
    recordGodModeMessage(makeMessage({ tokensUsed: 250 }));
    const metrics = getGodModeMetrics();
    expect(metrics.totalTokens).toBe(350);
  });

  it('calculates successfulMessages correctly', () => {
    recordGodModeMessage(makeMessage({ wasSuccessful: true }));
    recordGodModeMessage(makeMessage({ wasSuccessful: true }));
    recordGodModeMessage(makeMessage({ wasSuccessful: false }));
    const metrics = getGodModeMetrics();
    expect(metrics.successfulMessages).toBe(2);
    expect(metrics.totalMessages).toBe(3);
  });

  it('records firstToggleAt and lastMessageAt timestamps', () => {
    const before = Date.now();
    recordGodModeToggle(true, 'researcher');
    recordGodModeMessage(makeMessage());
    const after = Date.now();
    const metrics = getGodModeMetrics();
    expect(metrics.firstToggleAt).toBeGreaterThanOrEqual(before);
    expect(metrics.firstToggleAt).toBeLessThanOrEqual(after);
    expect(metrics.lastMessageAt).toBeGreaterThanOrEqual(before);
    expect(metrics.lastMessageAt).toBeLessThanOrEqual(after);
  });

  it('handles mixed success rates in agent breakdown', () => {
    recordGodModeMessage(makeMessage({ agentType: 'researcher', wasSuccessful: true }));
    recordGodModeMessage(makeMessage({ agentType: 'researcher', wasSuccessful: false }));
    recordGodModeMessage(makeMessage({ agentType: 'researcher', wasSuccessful: true }));
    const metrics = getGodModeMetrics();
    expect(metrics.agentBreakdown['researcher'].count).toBe(3);
    expect(metrics.agentBreakdown['researcher'].successCount).toBe(2);
  });
});

describe('recordNormalMessageTokens', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores normal message entry', () => {
    recordNormalMessageTokens(200, 'researcher', true);
    const raw = localStorage.getItem('oracle_normal_msg_history');
    expect(raw).toBeTruthy();
    const entries = JSON.parse(raw!);
    expect(entries.length).toBe(1);
    expect(entries[0].tokensUsed).toBe(200);
    expect(entries[0].agentType).toBe('researcher');
    expect(entries[0].wasSuccessful).toBe(true);
  });

  it('appends multiple entries', () => {
    recordNormalMessageTokens(100, 'researcher', true);
    recordNormalMessageTokens(150, 'writer', false);
    recordNormalMessageTokens(200, 'developer', true);
    const entries = JSON.parse(localStorage.getItem('oracle_normal_msg_history')!);
    expect(entries.length).toBe(3);
  });

  it('caps storage at 500 entries', () => {
    for (let i = 0; i < 510; i++) {
      recordNormalMessageTokens(100, 'researcher', true);
    }
    const entries = JSON.parse(localStorage.getItem('oracle_normal_msg_history')!);
    expect(entries.length).toBe(500);
  });
});

describe('getGodModeCostAnalysis', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns zero values when no data exists', () => {
    const analysis = getGodModeCostAnalysis();
    expect(analysis.avgTokensGodMode).toBe(0);
    expect(analysis.avgTokensNormal).toBeNull();
    expect(analysis.overheadPercent).toBeNull();
    expect(analysis.totalGodModeTokens).toBe(0);
    expect(analysis.godModeMessageCount).toBe(0);
  });

  it('returns null baseline when no normal messages recorded', () => {
    recordGodModeMessage(makeMessage({ tokensUsed: 200 }));
    recordGodModeMessage(makeMessage({ tokensUsed: 300 }));
    const analysis = getGodModeCostAnalysis();
    expect(analysis.avgTokensGodMode).toBe(250);
    expect(analysis.avgTokensNormal).toBeNull();
    expect(analysis.overheadPercent).toBeNull();
    expect(analysis.totalGodModeTokens).toBe(500);
    expect(analysis.godModeMessageCount).toBe(2);
  });

  it('calculates overhead when normal messages exist', () => {
    recordGodModeMessage(makeMessage({ tokensUsed: 300 }));
    recordNormalMessageTokens(200, 'researcher', true);
    const analysis = getGodModeCostAnalysis();
    expect(analysis.avgTokensGodMode).toBe(300);
    expect(analysis.avgTokensNormal).toBe(200);
    expect(analysis.overheadPercent).toBe(50);
  });

  it('shows 0% overhead when GOD MODE uses same tokens as normal', () => {
    recordGodModeMessage(makeMessage({ tokensUsed: 200 }));
    recordNormalMessageTokens(200, 'researcher', true);
    const analysis = getGodModeCostAnalysis();
    expect(analysis.overheadPercent).toBe(0);
  });

  it('clamps negative overhead to 0% when GOD MODE is more efficient', () => {
    recordGodModeMessage(makeMessage({ tokensUsed: 100 }));
    recordNormalMessageTokens(200, 'researcher', true);
    const analysis = getGodModeCostAnalysis();
    expect(analysis.overheadPercent).toBe(0);
  });

  it('calculates average across multiple normal messages', () => {
    recordGodModeMessage(makeMessage({ tokensUsed: 400 }));
    recordNormalMessageTokens(100, 'researcher', true);
    recordNormalMessageTokens(300, 'writer', true);
    const analysis = getGodModeCostAnalysis();
    expect(analysis.avgTokensNormal).toBe(200);
    expect(analysis.overheadPercent).toBe(100);
  });
});

describe('clearGodModeMetrics', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes all toggle and message data', () => {
    recordGodModeToggle(true, 'researcher');
    recordGodModeMessage(makeMessage());
    recordNormalMessageTokens(100, 'researcher', true);
    expect(localStorage.getItem(GOD_MODE_METRICS_KEY)).toBeTruthy();
    expect(localStorage.getItem(GOD_MODE_HISTORY_KEY)).toBeTruthy();
    expect(localStorage.getItem('oracle_normal_msg_history')).toBeTruthy();
    clearGodModeMetrics();
    expect(localStorage.getItem(GOD_MODE_METRICS_KEY)).toBeNull();
    expect(localStorage.getItem(GOD_MODE_HISTORY_KEY)).toBeNull();
    expect(localStorage.getItem('oracle_normal_msg_history')).toBeNull();
  });

  it('metrics return to empty after clear', () => {
    recordGodModeToggle(true, 'researcher');
    recordGodModeMessage(makeMessage({ tokensUsed: 500 }));
    recordNormalMessageTokens(100, 'researcher', true);
    clearGodModeMetrics();
    const metrics = getGodModeMetrics();
    expect(metrics.totalToggles).toBe(0);
    expect(metrics.totalMessages).toBe(0);
    expect(metrics.totalTokens).toBe(0);
    const analysis = getGodModeCostAnalysis();
    expect(analysis.avgTokensNormal).toBeNull();
    expect(analysis.overheadPercent).toBeNull();
  });
});

describe('getGodModeTimelineData', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array when no data exists', () => {
    const data = getGodModeTimelineData();
    expect(data).toHaveLength(0);
  });

  it('groups GOD MODE messages by day', () => {
    const now = Date.now();
    const godModeEntries = [
      { id: 'g1', timestamp: now, agentType: 'researcher', provider: 'groq', model: 'llama-3.3', tokensUsed: 100, wasSuccessful: true },
      { id: 'g2', timestamp: now, agentType: 'writer', provider: 'groq', model: 'llama-3.3', tokensUsed: 200, wasSuccessful: true },
    ];
    localStorage.setItem('oracle_god_mode_history', JSON.stringify(godModeEntries));

    const data = getGodModeTimelineData();
    expect(data.length).toBe(1);
    expect(data[0].godModeMessages).toBe(2);
    expect(data[0].godModeTokens).toBe(300);
    expect(data[0].normalMessages).toBe(0);
    expect(data[0].normalTokens).toBe(0);
  });

  it('groups normal messages by day', () => {
    const now = Date.now();
    const normalEntries = [
      { id: 'n1', timestamp: now, tokensUsed: 150, agentType: 'researcher', wasSuccessful: true },
      { id: 'n2', timestamp: now, tokensUsed: 250, agentType: 'writer', wasSuccessful: true },
    ];
    localStorage.setItem('oracle_normal_msg_history', JSON.stringify(normalEntries));

    const data = getGodModeTimelineData();
    expect(data.length).toBe(1);
    expect(data[0].normalMessages).toBe(2);
    expect(data[0].normalTokens).toBe(400);
    expect(data[0].godModeMessages).toBe(0);
  });

  it('combines GOD MODE and normal messages on same day', () => {
    const now = Date.now();
    const godModeEntries = [
      { id: 'g1', timestamp: now, agentType: 'researcher', provider: 'groq', model: 'llama-3.3', tokensUsed: 100, wasSuccessful: true },
    ];
    const normalEntries = [
      { id: 'n1', timestamp: now, tokensUsed: 200, agentType: 'writer', wasSuccessful: true },
    ];
    localStorage.setItem('oracle_god_mode_history', JSON.stringify(godModeEntries));
    localStorage.setItem('oracle_normal_msg_history', JSON.stringify(normalEntries));

    const data = getGodModeTimelineData();
    expect(data.length).toBe(1);
    expect(data[0].godModeMessages).toBe(1);
    expect(data[0].godModeTokens).toBe(100);
    expect(data[0].normalMessages).toBe(1);
    expect(data[0].normalTokens).toBe(200);
  });

  it('counts enabled toggles but not disabled toggles', () => {
    const now = Date.now();
    const toggleEntries = [
      { id: 't1', timestamp: now, enabled: true, agentType: 'researcher' },
      { id: 't2', timestamp: now, enabled: false, agentType: 'writer' },
      { id: 't3', timestamp: now, enabled: true, agentType: 'developer' },
    ];
    localStorage.setItem('oracle_god_mode_metrics', JSON.stringify(toggleEntries));

    const data = getGodModeTimelineData();
    expect(data.length).toBe(1);
    expect(data[0].toggles).toBe(2);
  });

  it('limits to maxDays parameter', () => {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const entries = [];
    for (let i = 0; i < 10; i++) {
      entries.push({
        id: `g${i}`,
        timestamp: now - i * DAY_MS,
        agentType: 'researcher',
        provider: 'groq',
        model: 'llama-3.3',
        tokensUsed: 100,
        wasSuccessful: true,
      });
    }
    localStorage.setItem('oracle_god_mode_history', JSON.stringify(entries));

    const data3 = getGodModeTimelineData(3);
    expect(data3.length).toBe(3);

    const dataAll = getGodModeTimelineData(10);
    expect(dataAll.length).toBe(10);
  });

  it('returns empty when only disabled toggles exist', () => {
    const now = Date.now();
    const toggleEntries = [
      { id: 't1', timestamp: now, enabled: false, agentType: 'researcher' },
    ];
    localStorage.setItem('oracle_god_mode_metrics', JSON.stringify(toggleEntries));

    const data = getGodModeTimelineData();
    expect(data).toHaveLength(0);
  });
});

describe('edge cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(GOD_MODE_METRICS_KEY, 'not-json');
    localStorage.setItem(GOD_MODE_HISTORY_KEY, 'not-json');
    localStorage.setItem('oracle_normal_msg_history', 'not-json');
    const metrics = getGodModeMetrics();
    expect(metrics.totalToggles).toBe(0);
    expect(metrics.totalMessages).toBe(0);
  });

  it('handles empty localStorage strings', () => {
    localStorage.setItem(GOD_MODE_METRICS_KEY, '');
    localStorage.setItem(GOD_MODE_HISTORY_KEY, '');
    localStorage.setItem('oracle_normal_msg_history', '');
    const metrics = getGodModeMetrics();
    expect(metrics.totalToggles).toBe(0);
    expect(metrics.totalMessages).toBe(0);
  });

  it('preserves existing localStorage data when recording', () => {
    localStorage.setItem('oracle_other_key', 'keep-me');
    recordGodModeToggle(true, 'researcher');
    expect(localStorage.getItem('oracle_other_key')).toBe('keep-me');
  });

  it('handles very large token counts', () => {
    recordGodModeMessage(makeMessage({ tokensUsed: 999999 }));
    const metrics = getGodModeMetrics();
    expect(metrics.totalTokens).toBe(999999);
  });

  it('handles quality score of 0 correctly', () => {
    recordGodModeMessage(makeMessage({ qualityScore: 0 }));
    const metrics = getGodModeMetrics();
    expect(metrics.avgQuality).toBe(0);
  });

  it('does not crash in SSR environment', () => {
    const metrics = getGodModeMetrics();
    expect(metrics).toBeDefined();
  });
});
