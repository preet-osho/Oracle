import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  attachQualityToTraining,
  recordMessageFeedback,
  recordGuardVerdict,
  getFeedbackSummary,
  getRecommendedModel,
  flagDomainForPromptReview,
} from './feedback-bridge';

// ─── Mocks ───

const mockLogAgentPerformance = vi.fn();
const mockGetBestPerformingModel = vi.fn();
vi.mock('@/lib/model-selector', () => ({
  logAgentPerformance: (...args: unknown[]) => mockLogAgentPerformance(...args),
  getBestPerformingModel: (...args: unknown[]) => mockGetBestPerformingModel(...args),
}));

const mockGetLearningEntries = vi.fn();
vi.mock('@/lib/hallucination-guard', () => ({
  getLearningEntries: (...args: unknown[]) => mockGetLearningEntries(...args),
  getLearningInsights: vi.fn().mockReturnValue([]),
}));

const mockGetTrainingEntries = vi.fn();
vi.mock('@/lib/self-training', () => ({
  recordTask: vi.fn(),
  getTrainingEntries: (...args: unknown[]) => mockGetTrainingEntries(...args),
}));

const mockGetVersions = vi.fn();
const mockSaveVersions = vi.fn();
vi.mock('@/lib/prompt-versioning', () => ({
  PromptRegistry: {
    getVersions: (...args: unknown[]) => mockGetVersions(...args),
    saveVersions: (...args: unknown[]) => mockSaveVersions(...args),
  },
}));

// ─── Tests ───

describe('feedback-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLearningEntries.mockReturnValue([]);
    mockGetTrainingEntries.mockReturnValue([]);
    mockGetBestPerformingModel.mockReturnValue(null);
    mockGetVersions.mockReturnValue([]);
  });

  describe('attachQualityToTraining', () => {
    it('calls logAgentPerformance with quality score', () => {
      const qualityScore = { total: 75, checks: [], assessment: 'good' };
      attachQualityToTraining('openai', 'gpt-4o', 'researcher', qualityScore as never);
      expect(mockLogAgentPerformance).toHaveBeenCalledWith(
        'researcher', 'gpt-4o', 'openai', true, 0.75,
        undefined, undefined, undefined
      );
    });

    it('marks as not successful when quality < 60', () => {
      const qualityScore = { total: 40, checks: [], assessment: 'poor' };
      attachQualityToTraining('groq', 'llama', 'writer', qualityScore as never);
      expect(mockLogAgentPerformance).toHaveBeenCalledWith(
        'writer', 'llama', 'groq', false, 0.4,
        undefined, undefined, undefined
      );
    });

    it('does not throw on error', () => {
      mockLogAgentPerformance.mockImplementation(() => { throw new Error('fail'); });
      expect(() => {
        attachQualityToTraining('openai', 'gpt-4o', 'analyst', { total: 50 } as never);
      }).not.toThrow();
    });
  });

  describe('recordMessageFeedback', () => {
    it('records good verdict with quality score', () => {
      const qualityScore = { total: 85, checks: [], assessment: 'excellent' };
      recordMessageFeedback('anthropic', 'claude', 'developer', qualityScore as never, 'good');
      expect(mockLogAgentPerformance).toHaveBeenCalledWith(
        'developer', 'claude', 'anthropic', true, 0.85,
        undefined, undefined, undefined
      );
    });

    it('records bad verdict with quality score', () => {
      const qualityScore = { total: 30, checks: [], assessment: 'poor' };
      recordMessageFeedback('openai', 'gpt-4o', 'writer', qualityScore as never, 'bad');
      expect(mockLogAgentPerformance).toHaveBeenCalledWith(
        'writer', 'gpt-4o', 'openai', false, 0.3,
        undefined, undefined, undefined
      );
    });

    it('uses default quality when no qualityScore provided (good)', () => {
      recordMessageFeedback('groq', 'llama', 'analyst', undefined, 'good');
      expect(mockLogAgentPerformance).toHaveBeenCalledWith(
        'analyst', 'llama', 'groq', true, 0.7,
        undefined, undefined, undefined
      );
    });

    it('uses default quality when no qualityScore provided (bad)', () => {
      recordMessageFeedback('groq', 'llama', 'analyst', undefined, 'bad');
      expect(mockLogAgentPerformance).toHaveBeenCalledWith(
        'analyst', 'llama', 'groq', false, 0.3,
        undefined, undefined, undefined
      );
    });

    it('does not throw on error', () => {
      mockLogAgentPerformance.mockImplementation(() => { throw new Error('fail'); });
      expect(() => {
        recordMessageFeedback('openai', 'gpt-4o', 'analyst', undefined, 'good');
      }).not.toThrow();
    });
  });

  describe('recordGuardVerdict', () => {
    it('records accepted verdict with confidence', () => {
      recordGuardVerdict('openai', 'gpt-4o', 'writer', 'output text', 'accepted', 80, 'seo');
      expect(mockLogAgentPerformance).toHaveBeenCalledWith(
        'writer', 'gpt-4o', 'openai', true, 0.8,
        undefined, undefined, undefined
      );
    });

    it('records rejected verdict with adjusted confidence', () => {
      recordGuardVerdict('anthropic', 'claude', 'analyst', 'output', 'rejected', 60, 'general');
      expect(mockLogAgentPerformance).toHaveBeenCalledWith(
        'analyst', 'claude', 'anthropic', false, 0.3,
        undefined, undefined, undefined
      );
    });

    it('does not throw on error', () => {
      mockLogAgentPerformance.mockImplementation(() => { throw new Error('fail'); });
      expect(() => {
        recordGuardVerdict('openai', 'gpt-4o', 'writer', 'output', 'accepted', 80);
      }).not.toThrow();
    });
  });

  describe('getFeedbackSummary', () => {
    it('returns zero summary when no data', () => {
      const summary = getFeedbackSummary();
      expect(summary.totalVerdicts).toBe(0);
      expect(summary.acceptanceRate).toBe(0);
      expect(summary.worstDomains).toHaveLength(0);
      expect(summary.bestModels).toHaveLength(0);
      expect(summary.promptRecommendation).toBeNull();
    });

    it('calculates acceptance rate from guard entries', () => {
      mockGetLearningEntries.mockReturnValue([
        { userVerdict: 'accepted', confidenceAtCheck: 80, domain: 'seo' },
        { userVerdict: 'accepted', confidenceAtCheck: 70, domain: 'seo' },
        { userVerdict: 'rejected', confidenceAtCheck: 40, domain: 'web' },
      ]);
      const summary = getFeedbackSummary();
      expect(summary.totalVerdicts).toBe(3);
      expect(summary.acceptanceRate).toBe(67);
    });

    it('identifies worst domains with >= 3 data points', () => {
      mockGetLearningEntries.mockReturnValue([
        { userVerdict: 'rejected', confidenceAtCheck: 30, domain: 'seo' },
        { userVerdict: 'rejected', confidenceAtCheck: 40, domain: 'seo' },
        { userVerdict: 'rejected', confidenceAtCheck: 35, domain: 'seo' },
        { userVerdict: 'accepted', confidenceAtCheck: 80, domain: 'web' },
      ]);
      const summary = getFeedbackSummary();
      expect(summary.worstDomains.length).toBe(1);
      expect(summary.worstDomains[0].domain).toBe('seo');
      expect(summary.worstDomains[0].rejectionRate).toBe(100);
    });

    it('filters domains with < 3 data points', () => {
      mockGetLearningEntries.mockReturnValue([
        { userVerdict: 'rejected', confidenceAtCheck: 30, domain: 'niche' },
        { userVerdict: 'rejected', confidenceAtCheck: 40, domain: 'niche' },
      ]);
      const summary = getFeedbackSummary();
      expect(summary.worstDomains).toHaveLength(0);
    });

    it('identifies best models from training entries', () => {
      mockGetTrainingEntries.mockReturnValue([
        { provider: 'openai', model: 'gpt-4o', wasSuccessful: true, qualityScore: { total: 85 } },
        { provider: 'openai', model: 'gpt-4o', wasSuccessful: true, qualityScore: { total: 90 } },
        { provider: 'openai', model: 'gpt-4o', wasSuccessful: false, qualityScore: { total: 40 } },
      ]);
      const summary = getFeedbackSummary();
      expect(summary.bestModels.length).toBe(1);
      expect(summary.bestModels[0].model).toBe('openai/gpt-4o');
      expect(summary.bestModels[0].acceptanceRate).toBe(67);
    });

    it('generates prompt recommendation for high rejection domain', () => {
      mockGetLearningEntries.mockReturnValue([
        { userVerdict: 'rejected', confidenceAtCheck: 20, domain: 'finance' },
        { userVerdict: 'rejected', confidenceAtCheck: 25, domain: 'finance' },
        { userVerdict: 'rejected', confidenceAtCheck: 30, domain: 'finance' },
        { userVerdict: 'accepted', confidenceAtCheck: 70, domain: 'finance' },
      ]);
      const summary = getFeedbackSummary();
      expect(summary.promptRecommendation).toContain('finance');
      expect(summary.promptRecommendation).toContain('rejection rate');
    });

    it('generates prompt recommendation for low overall acceptance', () => {
      // Spread across different domains so no single domain has >= 3 entries
      mockGetLearningEntries.mockReturnValue([
        { userVerdict: 'rejected', confidenceAtCheck: 30, domain: 'seo' },
        { userVerdict: 'rejected', confidenceAtCheck: 35, domain: 'web' },
        { userVerdict: 'rejected', confidenceAtCheck: 25, domain: 'ads' },
        { userVerdict: 'accepted', confidenceAtCheck: 60, domain: 'social' },
        { userVerdict: 'rejected', confidenceAtCheck: 40, domain: 'email' },
      ]);
      const summary = getFeedbackSummary();
      // 20% acceptance rate across 5 verdicts, no domain has >= 3 entries
      expect(summary.acceptanceRate).toBe(20);
      expect(summary.promptRecommendation).toContain('acceptance rate');
    });
  });

  describe('getRecommendedModel', () => {
    it('returns learned model when available and in providers list', () => {
      mockGetBestPerformingModel.mockReturnValue({
        providerId: 'openai',
        modelId: 'gpt-4o',
      });
      const result = getRecommendedModel('researcher', 'standard', ['openai', 'groq']);
      expect(result).not.toBeNull();
      expect(result!.providerId).toBe('openai');
      expect(result!.modelId).toBe('gpt-4o');
      expect(result!.reason).toContain('Learned');
    });

    it('returns null when learned model is not in available providers', () => {
      mockGetBestPerformingModel.mockReturnValue({
        providerId: 'anthropic',
        modelId: 'claude',
      });
      const result = getRecommendedModel('writer', 'standard', ['openai', 'groq']);
      expect(result).toBeNull();
    });

    it('returns null when no learned model exists', () => {
      mockGetBestPerformingModel.mockReturnValue(null);
      const result = getRecommendedModel('analyst', 'standard', ['openai']);
      expect(result).toBeNull();
    });
  });

  describe('flagDomainForPromptReview', () => {
    it('does nothing when rejection rate < 60%', () => {
      flagDomainForPromptReview('seo', 40);
      expect(mockGetVersions).not.toHaveBeenCalled();
    });

    it('does nothing when no versions exist', () => {
      mockGetVersions.mockReturnValue([]);
      flagDomainForPromptReview('seo', 80);
      expect(mockSaveVersions).not.toHaveBeenCalled();
    });

    it('tags current version when not already tagged', () => {
      mockGetVersions.mockReturnValue([
        { id: 'v1', tags: [], content: 'test' },
      ]);
      flagDomainForPromptReview('finance', 75);
      expect(mockSaveVersions).toHaveBeenCalled();
      const savedVersions = mockSaveVersions.mock.calls[0][0];
      expect(savedVersions[0].tags).toContain('needs-review:finance');
    });

    it('does not double-tag already flagged version', () => {
      mockGetVersions.mockReturnValue([
        { id: 'v1', tags: ['needs-review:seo'], content: 'test' },
      ]);
      flagDomainForPromptReview('seo', 80);
      expect(mockSaveVersions).not.toHaveBeenCalled();
    });

    it('does not throw on error', () => {
      mockGetVersions.mockImplementation(() => { throw new Error('fail'); });
      expect(() => flagDomainForPromptReview('seo', 80)).not.toThrow();
    });
  });
});
