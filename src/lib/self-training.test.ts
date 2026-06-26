import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordTask,
  getTrainingEntries,
  clearTrainingData,
  getTrainingSummary,
  generateLearningsMarkdown,
  type LearningEntry,
} from './self-training';

const TRAINING_KEY = 'oracle_self_training';

function makeEntry(overrides: Partial<LearningEntry> = {}): Omit<LearningEntry, 'id' | 'timestamp'> {
  return {
    taskType: 'seo-audit',
    domain: 'SEO',
    promptPreview: 'Audit this website',
    responsePreview: 'Here is the audit...',
    qualityScore: { completeness: 80, specificity: 70, actionability: 75, indiaContext: 60, clientReady: 85, total: 74, notes: '', scoredAt: Date.now() },
    confidence: 85,
    provider: 'groq',
    model: 'llama-3.3-70b',
    wasSuccessful: true,
    tags: ['seo', 'audit'],
    ...overrides,
  };
}

describe('recordTask', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores entry with id and timestamp', () => {
    recordTask(makeEntry());
    const entries = getTrainingEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].id).toBeTruthy();
    expect(entries[0].timestamp).toBeGreaterThan(0);
  });

  it('prepends newest entries', () => {
    recordTask(makeEntry({ taskType: 'first' }));
    recordTask(makeEntry({ taskType: 'second' }));
    const entries = getTrainingEntries();
    expect(entries[0].taskType).toBe('second');
    expect(entries[1].taskType).toBe('first');
  });

  it('caps storage at 500 entries', () => {
    for (let i = 0; i < 500; i++) {
      recordTask(makeEntry({ taskType: `task-${i}` }));
    }
    recordTask(makeEntry({ taskType: 'overflow' }));
    const entries = getTrainingEntries();
    expect(entries.length).toBe(500);
    expect(entries[0].taskType).toBe('overflow');
  });

  it('preserves entry fields', () => {
    recordTask(makeEntry({ domain: 'ads', provider: 'google', model: 'gemini-flash' }));
    const entry = getTrainingEntries()[0];
    expect(entry.domain).toBe('ads');
    expect(entry.provider).toBe('google');
    expect(entry.model).toBe('gemini-flash');
  });
});

describe('getTrainingEntries', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array when no data', () => {
    expect(getTrainingEntries()).toEqual([]);
  });

  it('returns stored entries', () => {
    recordTask(makeEntry());
    recordTask(makeEntry());
    expect(getTrainingEntries().length).toBe(2);
  });
});

describe('clearTrainingData', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes all training data', () => {
    recordTask(makeEntry());
    recordTask(makeEntry());
    clearTrainingData();
    expect(getTrainingEntries()).toEqual([]);
  });
});

describe('getTrainingSummary', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty summary for no data', () => {
    const summary = getTrainingSummary([]);
    expect(summary.totalTasks).toBe(0);
    expect(summary.successRate).toBe(0);
    expect(summary.avgQuality).toBe(0);
    expect(summary.avgConfidence).toBe(0);
    expect(summary.topPatterns).toEqual([]);
    expect(summary.recentTrend).toBe('stable');
  });

  it('calculates success rate', () => {
    const entries = [
      { ...makeEntry(), wasSuccessful: true, id: '1', timestamp: 1 },
      { ...makeEntry(), wasSuccessful: true, id: '2', timestamp: 2 },
      { ...makeEntry(), wasSuccessful: false, id: '3', timestamp: 3 },
    ];
    const summary = getTrainingSummary(entries);
    expect(summary.totalTasks).toBe(3);
    expect(summary.successRate).toBe(67);
  });

  it('calculates average quality', () => {
    const entries = [
      { ...makeEntry(), qualityScore: { completeness: 80, specificity: 80, actionability: 80, indiaContext: 80, clientReady: 80, total: 80, notes: '', scoredAt: 1 }, id: '1', timestamp: 1 },
      { ...makeEntry(),      qualityScore: { completeness: 60, specificity: 60, actionability: 60, indiaContext: 60, clientReady: 60, total: 60, notes: '', scoredAt: 1 }, id: '2', timestamp: 2 },
    ];
    const summary = getTrainingSummary(entries);
    expect(summary.avgQuality).toBe(70);
  });

  it('calculates average confidence', () => {
    const entries = [
      { ...makeEntry(), confidence: 90, id: '1', timestamp: 1 },
      { ...makeEntry(), confidence: 70, id: '2', timestamp: 2 },
    ];
    const summary = getTrainingSummary(entries);
    expect(summary.avgConfidence).toBe(80);
  });

  it('groups domain performance', () => {
    const entries = [
      { ...makeEntry(), domain: 'SEO', qualityScore: { completeness: 80, specificity: 80, actionability: 80, indiaContext: 80, clientReady: 80, total: 80, notes: '', scoredAt: 1 }, id: '1', timestamp: 1 },
      { ...makeEntry(), domain: 'SEO',      qualityScore: { completeness: 60, specificity: 60, actionability: 60, indiaContext: 60, clientReady: 60, total: 60, notes: '', scoredAt: 1 }, id: '2', timestamp: 2 },
      { ...makeEntry(), domain: 'Ads',      qualityScore: { completeness: 90, specificity: 90, actionability: 90, indiaContext: 90, clientReady: 90, total: 90, notes: '', scoredAt: 1 }, id: '3', timestamp: 3 },
    ];
    const summary = getTrainingSummary(entries);
    expect(summary.domainPerformance['SEO'].count).toBe(2);
    expect(summary.domainPerformance['SEO'].avgQuality).toBe(70);
    expect(summary.domainPerformance['Ads'].count).toBe(1);
    expect(summary.domainPerformance['Ads'].avgQuality).toBe(90);
  });

  it('groups model performance', () => {
    const entries = [
      { ...makeEntry(), provider: 'groq', model: 'llama-3.3', qualityScore: { completeness: 80, specificity: 80, actionability: 80, indiaContext: 80, clientReady: 80, total: 80, notes: '', scoredAt: 1 }, id: '1', timestamp: 1 },
      { ...makeEntry(), provider: 'google', model: 'gemini',      qualityScore: { completeness: 90, specificity: 90, actionability: 90, indiaContext: 90, clientReady: 90, total: 90, notes: '', scoredAt: 1 }, id: '2', timestamp: 2 },
    ];
    const summary = getTrainingSummary(entries);
    expect(summary.modelPerformance['groq/llama-3.3'].count).toBe(1);
    expect(summary.modelPerformance['google/gemini'].count).toBe(1);
  });

  it('detects top patterns from tags', () => {
    const entries = [
      { ...makeEntry(), tags: ['seo', 'audit'], qualityScore: { completeness: 80, specificity: 80, actionability: 80, indiaContext: 80, clientReady: 80, total: 80, notes: '', scoredAt: 1 }, id: '1', timestamp: 1 },
      { ...makeEntry(), tags: ['seo', 'technical'],      qualityScore: { completeness: 70, specificity: 70, actionability: 70, indiaContext: 70, clientReady: 70, total: 70, notes: '', scoredAt: 1 }, id: '2', timestamp: 2 },
      { ...makeEntry(), tags: ['seo'],      qualityScore: { completeness: 90, specificity: 90, actionability: 90, indiaContext: 90, clientReady: 90, total: 90, notes: '', scoredAt: 1 }, id: '3', timestamp: 3 },
    ];
    const summary = getTrainingSummary(entries);
    expect(summary.topPatterns.length).toBeGreaterThan(0);
    expect(summary.topPatterns[0].pattern).toBe('seo');
    expect(summary.topPatterns[0].count).toBe(3);
  });

  it('detects improving trend', () => {
    // Older entries (lower quality) come later in array, newer (higher) first
    const entries = Array.from({ length: 10 }, (_, i) => ({
      ...makeEntry(),
      qualityScore: { completeness: 50 + (i < 5 ? 30 : 0), specificity: 50 + (i < 5 ? 30 : 0), actionability: 50 + (i < 5 ? 30 : 0), indiaContext: 50 + (i < 5 ? 30 : 0), clientReady: 50 + (i < 5 ? 30 : 0), total: 50 + (i < 5 ? 30 : 0), notes: '', scoredAt: i },
      id: `${i}`,
      timestamp: i,
    }));
    const summary = getTrainingSummary(entries);
    expect(summary.recentTrend).toBe('improving');
  });

  it('detects declining trend', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      ...makeEntry(),
      qualityScore: { completeness: 80 - (i < 5 ? 30 : 0), specificity: 80 - (i < 5 ? 30 : 0), actionability: 80 - (i < 5 ? 30 : 0), indiaContext: 80 - (i < 5 ? 30 : 0), clientReady: 80 - (i < 5 ? 30 : 0), total: 80 - (i < 5 ? 30 : 0), notes: '', scoredAt: i },
      id: `${i}`,
      timestamp: i,
    }));
    const summary = getTrainingSummary(entries);
    expect(summary.recentTrend).toBe('declining');
  });

  it('returns stable trend for fewer than 6 entries', () => {
    const entries = Array.from({ length: 3 }, (_, i) => ({
      ...makeEntry(),
      qualityScore: { completeness: 80, specificity: 80, actionability: 80, indiaContext: 80, clientReady: 80, total: 80, notes: '', scoredAt: 1 },
      id: `${i}`,
      timestamp: i,
    }));
    const summary = getTrainingSummary(entries);
    expect(summary.recentTrend).toBe('stable');
  });
});

describe('generateLearningsMarkdown', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns no-data message when empty', () => {
    const md = generateLearningsMarkdown();
    expect(md).toContain('No data yet');
  });

  it('generates markdown with summary', () => {
    recordTask(makeEntry({ wasSuccessful: true, qualityScore: { completeness: 80, specificity: 80, actionability: 80, indiaContext: 80, clientReady: 80, total: 80, notes: '', scoredAt: 1 }, confidence: 90 }));
    const md = generateLearningsMarkdown();
    expect(md).toContain('# ORACLE Learnings');
    expect(md).toContain('Success rate:');
    expect(md).toContain('Average quality:');
    expect(md).toContain('Average confidence:');
  });

  it('includes domain performance section', () => {
    recordTask(makeEntry({ domain: 'SEO', qualityScore: { completeness: 80, specificity: 80, actionability: 80, indiaContext: 80, clientReady: 80, total: 80, notes: '', scoredAt: 1 } }));
    const md = generateLearningsMarkdown();
    expect(md).toContain('## Domain Performance');
    expect(md).toContain('SEO');
  });

  it('includes model performance section', () => {
    recordTask(makeEntry({ provider: 'groq', model: 'llama', qualityScore: { completeness: 80, specificity: 80, actionability: 80, indiaContext: 80, clientReady: 80, total: 80, notes: '', scoredAt: 1 } }));
    const md = generateLearningsMarkdown();
    expect(md).toContain('## Model Performance');
    expect(md).toContain('groq/llama');
  });

  it('includes common patterns section', () => {
    recordTask(makeEntry({ tags: ['seo', 'audit'], qualityScore: { completeness: 80, specificity: 80, actionability: 80, indiaContext: 80, clientReady: 80, total: 80, notes: '', scoredAt: 1 } }));
    const md = generateLearningsMarkdown();
    expect(md).toContain('## Common Patterns');
  });

  it('includes footer', () => {
    recordTask(makeEntry());
    const md = generateLearningsMarkdown();
    expect(md).toContain('auto-updated');
  });
});
