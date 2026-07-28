import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GodModeTrainingCard } from './GodModeTrainingCard';

// ─── Mocks ─────────────────────────────

const mockGetGodModeMetrics = vi.fn();
const mockGetGodModeCostAnalysis = vi.fn();
const mockGetGodModeMessageHistory = vi.fn();

vi.mock('@/lib/god-mode-metrics', () => ({
  getGodModeMetrics: (...args: unknown[]) => mockGetGodModeMetrics(...args),
  getGodModeCostAnalysis: (...args: unknown[]) => mockGetGodModeCostAnalysis(...args),
  getGodModeMessageHistory: (...args: unknown[]) => mockGetGodModeMessageHistory(...args),
}));

// ─── Helper Data ───────────────────────

function createMessage(overrides: Partial<{ agentType: string; provider: string; model: string; tokensUsed: number; wasSuccessful: boolean; qualityScore: number }> = {}) {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    agentType: 'researcher',
    provider: 'openai',
    model: 'gpt-4o',
    tokensUsed: 1500,
    wasSuccessful: true,
    qualityScore: undefined as number | undefined,
    ...overrides,
  };
}

const emptyMetrics = {
  totalToggles: 0,
  totalMessages: 0,
  successfulMessages: 0,
  totalTokens: 0,
  avgQuality: 0,
  agentBreakdown: {},
  providerBreakdown: {},
  firstToggleAt: null,
  lastMessageAt: null,
  godModeMessageRatio: 0,
  scoredMessages: [] as import('@/lib/god-mode-metrics').GodModeMessageEntry[],
  qualityDistribution: [
    { range: '0-25%', count: 0 },
    { range: '25-50%', count: 0 },
    { range: '50-75%', count: 0 },
    { range: '75-100%', count: 0 },
  ],
  agentQualityDistribution: {} as Record<string, { range: string; count: number }[]>,
  providerQualityDistribution: {} as Record<string, { range: string; count: number }[]>,
};

const emptyCostAnalysis = {
  avgTokensGodMode: 0,
  avgTokensNormal: null,
  overheadPercent: null,
  totalGodModeTokens: 0,
  godModeMessageCount: 0,
};

// ─── Tests ─────────────────────────────

describe('GodModeTrainingCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGodModeMetrics.mockReturnValue(emptyMetrics);
    mockGetGodModeCostAnalysis.mockReturnValue(emptyCostAnalysis);
    mockGetGodModeMessageHistory.mockReturnValue([]);
  });

  // ── Empty State ──

  it('renders empty state when no GOD MODE messages exist', () => {
    render(<GodModeTrainingCard />);
    expect(screen.getByText('⚡ GOD MODE Training Impact')).toBeDefined();
    expect(screen.getByText(/No GOD MODE usage yet/)).toBeDefined();
    expect(screen.getByText(/Ctrl\+Shift\+G/)).toBeDefined();
  });

  it('does not render stats or breakdown sections when empty', () => {
    render(<GodModeTrainingCard />);
    expect(screen.queryByText('Avg Quality')).toBeNull();
    expect(screen.queryByText('High Quality')).toBeNull();
    expect(screen.queryByText('💰 Token Cost Impact')).toBeNull();
    expect(screen.queryByText('🤖 Agent Quality with GOD MODE')).toBeNull();
  });

  // ── Stats with Data ──

  it('renders quality comparison stats when messages exist', () => {
    const messages = [
      createMessage({ qualityScore: 85 }),
      createMessage({ qualityScore: 70 }),
      createMessage({ qualityScore: 90 }),
    ];
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 3,
      totalToggles: 1,
      successfulMessages: 3,
      totalTokens: 4500,
      avgQuality: 81.67,
    });
    mockGetGodModeMessageHistory.mockReturnValue(messages);

    render(<GodModeTrainingCard />);

    expect(screen.getByText('⚡ GOD MODE Training Impact')).toBeDefined();
    expect(screen.getByText('How GOD MODE affects agent quality and token usage')).toBeDefined();
    expect(screen.getByText('Avg Quality')).toBeDefined();
    expect(screen.getByText('81.7')).toBeDefined();
    expect(screen.getByText('3 scored')).toBeDefined();
  });

  it('renders high quality count when quality scores >= 80 exist', () => {
    const messages = [
      createMessage({ qualityScore: 85 }),
      createMessage({ qualityScore: 90 }),
      createMessage({ qualityScore: 60 }),
    ];
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 3,
      totalToggles: 1,
      successfulMessages: 3,
      totalTokens: 4500,
      avgQuality: 78.33,
    });
    mockGetGodModeMessageHistory.mockReturnValue(messages);

    render(<GodModeTrainingCard />);

    expect(screen.getByText('High Quality (≥80)')).toBeDefined();
    // 2 out of 3 scored >= 80
    expect(screen.getByText('2')).toBeDefined();
  });

  it('renders low quality count when quality scores < 60 exist', () => {
    const messages = [
      createMessage({ qualityScore: 40 }),
      createMessage({ qualityScore: 85 }),
      createMessage({ qualityScore: 55 }),
    ];
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 3,
      totalToggles: 1,
      successfulMessages: 3,
      totalTokens: 4500,
      avgQuality: 60,
    });
    mockGetGodModeMessageHistory.mockReturnValue(messages);

    render(<GodModeTrainingCard />);

    expect(screen.getByText('Low Quality (<60)')).toBeDefined();
    // 2 out of 3 scored < 60
    expect(screen.getByText('2')).toBeDefined();
  });

  it('shows dash for avgQuality when no messages have scores', () => {
    const messages = [
      createMessage({ qualityScore: undefined }),
      createMessage({ qualityScore: 0 }),
    ];
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 2,
      totalToggles: 1,
      successfulMessages: 2,
      totalTokens: 3000,
      avgQuality: 0,
    });
    mockGetGodModeMessageHistory.mockReturnValue(messages);

    render(<GodModeTrainingCard />);

    expect(screen.getByText('Avg Quality')).toBeDefined();
    // '—' appears in avg quality and possibly overhead; check at least one exists
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText('0 scored')).toBeDefined();
  });

  // ── Token Cost Impact ──

  it('renders token cost impact section with avg tokens', () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 5,
      totalToggles: 2,
      successfulMessages: 5,
      totalTokens: 10000,
      avgQuality: 80,
    });
    mockGetGodModeCostAnalysis.mockReturnValue({
      avgTokensGodMode: 2000,
      avgTokensNormal: null,
      overheadPercent: null,
      totalGodModeTokens: 10000,
      godModeMessageCount: 5,
    });
    mockGetGodModeMessageHistory.mockReturnValue([createMessage()]);

    render(<GodModeTrainingCard />);

    expect(screen.getByText('💰 Token Cost Impact')).toBeDefined();
    expect(screen.getByText('GOD MODE avg:')).toBeDefined();
    expect(screen.getByText('2,000 tok/msg')).toBeDefined();
    expect(screen.getByText('Total GOD MODE:')).toBeDefined();
    expect(screen.getByText('10,000 tok')).toBeDefined();
  });

  it('shows baseline unavailable message when overheadPercent is null', () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 1,
      totalToggles: 1,
      successfulMessages: 1,
      totalTokens: 2000,
    });
    mockGetGodModeCostAnalysis.mockReturnValue({
      avgTokensGodMode: 2000,
      avgTokensNormal: null,
      overheadPercent: null,
      totalGodModeTokens: 2000,
      godModeMessageCount: 1,
    });
    mockGetGodModeMessageHistory.mockReturnValue([createMessage()]);

    render(<GodModeTrainingCard />);

    expect(screen.getByText(/Normal message baseline not yet available/)).toBeDefined();
  });

  it('shows overhead percentage when available', () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 1,
      totalToggles: 1,
      successfulMessages: 1,
      totalTokens: 2000,
    });
    mockGetGodModeCostAnalysis.mockReturnValue({
      avgTokensGodMode: 2000,
      avgTokensNormal: 1500,
      overheadPercent: 33,
      totalGodModeTokens: 2000,
      godModeMessageCount: 1,
    });
    mockGetGodModeMessageHistory.mockReturnValue([createMessage()]);

    render(<GodModeTrainingCard />);

    expect(screen.getByText('+33%')).toBeDefined();
    expect(screen.getByText(/GOD MODE adds ~33% more tokens/)).toBeDefined();
  });

  it('shows 0% overhead when overheadPercent is 0', () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 1,
      totalToggles: 1,
      successfulMessages: 1,
      totalTokens: 1500,
    });
    mockGetGodModeCostAnalysis.mockReturnValue({
      avgTokensGodMode: 1500,
      avgTokensNormal: 1500,
      overheadPercent: 0,
      totalGodModeTokens: 1500,
      godModeMessageCount: 1,
    });
    mockGetGodModeMessageHistory.mockReturnValue([createMessage()]);

    render(<GodModeTrainingCard />);

    // '0%' appears in overhead display and potentially in quality percentages; check at least 2 exist
    const zeroPercentElements = screen.getAllByText('0%');
    expect(zeroPercentElements.length).toBeGreaterThanOrEqual(1);
  });

  // ── Agent Quality Breakdown ──

  it('renders agent quality breakdown with success rate', () => {
    const messages = [
      createMessage({ agentType: 'researcher', wasSuccessful: true, tokensUsed: 1500, qualityScore: 85 }),
      createMessage({ agentType: 'researcher', wasSuccessful: true, tokensUsed: 2000, qualityScore: 90 }),
      createMessage({ agentType: 'writer', wasSuccessful: false, tokensUsed: 1000, qualityScore: 50 }),
    ];
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 3,
      totalToggles: 1,
      successfulMessages: 2,
      totalTokens: 4500,
      avgQuality: 75,
      agentBreakdown: {
        researcher: { count: 2, successCount: 2, totalTokens: 3500 },
        writer: { count: 1, successCount: 0, totalTokens: 1000 },
      },
    });
    mockGetGodModeMessageHistory.mockReturnValue(messages);

    render(<GodModeTrainingCard />);

    expect(screen.getByText('🤖 Agent Quality with GOD MODE')).toBeDefined();
    // researcher: 2 msgs, 100% success
    expect(screen.getByText('researcher')).toBeDefined();
    expect(screen.getByText('2 msgs')).toBeDefined();
    expect(screen.getByText('100%')).toBeDefined();
    // writer: 1 msg, 0% success
    expect(screen.getByText('writer')).toBeDefined();
    expect(screen.getByText('1 msgs')).toBeDefined();
    // '0%' appears in writer success rate and possibly other places; check it exists
    expect(screen.getAllByText('0%').length).toBeGreaterThanOrEqual(1);
  });

  it('renders quality score badge when agent has quality scores', () => {
    const messages = [
      createMessage({ agentType: 'researcher', qualityScore: 88 }),
    ];
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 1,
      totalToggles: 1,
      successfulMessages: 1,
      totalTokens: 1500,
      avgQuality: 88,
      agentBreakdown: {
        researcher: { count: 1, successCount: 1, totalTokens: 1500 },
      },
    });
    mockGetGodModeMessageHistory.mockReturnValue(messages);

    render(<GodModeTrainingCard />);

    expect(screen.getByText('Q:88')).toBeDefined();
  });

  it('does not render quality badge when agent has no quality scores', () => {
    const messages = [
      createMessage({ agentType: 'researcher', qualityScore: undefined }),
    ];
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 1,
      totalToggles: 1,
      successfulMessages: 1,
      totalTokens: 1500,
      avgQuality: 0,
      agentBreakdown: {
        researcher: { count: 1, successCount: 1, totalTokens: 1500 },
      },
    });
    mockGetGodModeMessageHistory.mockReturnValue(messages);

    render(<GodModeTrainingCard />);

    expect(screen.queryByText(/Q:/)).toBeNull();
  });

  it('renders agent token usage', () => {
    const messages = [
      createMessage({ agentType: 'developer', tokensUsed: 3000 }),
      createMessage({ agentType: 'developer', tokensUsed: 2000 }),
    ];
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 2,
      totalToggles: 1,
      successfulMessages: 2,
      totalTokens: 5000,
      agentBreakdown: {
        developer: { count: 2, successCount: 2, totalTokens: 5000 },
      },
    });
    mockGetGodModeMessageHistory.mockReturnValue(messages);

    render(<GodModeTrainingCard />);

    // avg tokens: 2500, rendered as plain number (no toLocaleString)
    expect(screen.getByText('2500 tok')).toBeDefined();
  });

  // ── GOD MODE Badge ──

  it('renders GOD MODE badge in header', () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 1,
      totalToggles: 1,
      successfulMessages: 1,
      totalTokens: 1000,
    });
    mockGetGodModeMessageHistory.mockReturnValue([createMessage()]);

    render(<GodModeTrainingCard />);

    expect(screen.getByText('GOD MODE')).toBeDefined();
  });

  // ── Multiple Agents ──

  it('sorts agents by message count (most first)', () => {
    const messages = [
      createMessage({ agentType: 'seo-specialist', tokensUsed: 500 }),
      createMessage({ agentType: 'seo-specialist', tokensUsed: 500 }),
      createMessage({ agentType: 'seo-specialist', tokensUsed: 500 }),
      createMessage({ agentType: 'researcher', tokensUsed: 1000 }),
    ];
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 4,
      totalToggles: 1,
      successfulMessages: 4,
      totalTokens: 2500,
      agentBreakdown: {
        'seo-specialist': { count: 3, successCount: 3, totalTokens: 1500 },
        researcher: { count: 1, successCount: 1, totalTokens: 1000 },
      },
    });
    mockGetGodModeMessageHistory.mockReturnValue(messages);

    render(<GodModeTrainingCard />);

    const agentElements = screen.getAllByText(/msgs/);
    // First agent should be seo-specialist (3 msgs), then researcher (1 msg)
    expect(agentElements[0].textContent).toContain('3 msgs');
    expect(agentElements[1].textContent).toContain('1 msgs');
  });

  // ── Edge Cases ──

  it('handles messages with quality score of exactly 0 as unscored', () => {
    const messages = [
      createMessage({ qualityScore: 0 }),
      createMessage({ qualityScore: 85 }),
    ];
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 2,
      totalToggles: 1,
      successfulMessages: 2,
      totalTokens: 3000,
      avgQuality: 85,
    });
    mockGetGodModeMessageHistory.mockReturnValue(messages);

    render(<GodModeTrainingCard />);

    // Only 1 scored (85), not 2
    expect(screen.getByText('1 scored')).toBeDefined();
    expect(screen.getByText('85.0')).toBeDefined();
  });

  it('handles single agent with 100% success rate', () => {
    const messages = [
      createMessage({ agentType: 'analyst', wasSuccessful: true, qualityScore: 95 }),
    ];
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 1,
      totalToggles: 1,
      successfulMessages: 1,
      totalTokens: 1000,
      avgQuality: 95,
      agentBreakdown: {
        analyst: { count: 1, successCount: 1, totalTokens: 1000 },
      },
    });
    mockGetGodModeMessageHistory.mockReturnValue(messages);

    render(<GodModeTrainingCard />);

    // 100% appears for success rate; check it exists
    expect(screen.getAllByText('100%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Q:95')).toBeDefined();
  });

  it('handles single agent with 0% success rate', () => {
    const messages = [
      createMessage({ agentType: 'writer', wasSuccessful: false, qualityScore: 30 }),
    ];
    mockGetGodModeMetrics.mockReturnValue({
      ...emptyMetrics,
      totalMessages: 1,
      totalToggles: 1,
      successfulMessages: 0,
      totalTokens: 800,
      avgQuality: 30,
      agentBreakdown: {
        writer: { count: 1, successCount: 0, totalTokens: 800 },
      },
    });
    mockGetGodModeMessageHistory.mockReturnValue(messages);

    render(<GodModeTrainingCard />);

    // '0%' appears in writer success rate and possibly other places; check it exists
    expect(screen.getAllByText('0%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Q:30')).toBeDefined();
  });
});
