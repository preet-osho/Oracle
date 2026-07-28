import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import {
  MOCK_GOD_MODE_METRICS,
  MOCK_GOD_MODE_MESSAGES,
  MOCK_GOD_MODE_METRICS_DISABLED,
} from './god-mode-test-helpers';
import type { GodModeMessageEntry } from '@/lib/god-mode-metrics';

// ─── Mocks ─────────────────────────────

vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: { initial: {}, animate: {} } },
  transitions: { smooth: {} },
  buttonTapProps: {},
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(
    (...args: unknown[]) => { /* noop */ },
    { error: (...args: unknown[]) => { /* noop */ }, success: (...args: unknown[]) => { /* noop */ } },
  ),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-container">{children}</div>,
  PieChart: () => <div data-testid="pie-chart" />,
  Pie: () => null,
  Cell: () => null,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => null,
  RadarChart: () => <div data-testid="radar-chart" />,
  Radar: () => null,
  PolarGrid: () => null,
  PolarAngleAxis: () => null,
  PolarRadiusAxis: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

vi.mock('@/lib/agents/training-scenarios-library', () => ({
  TRAINING_SCENARIOS: [
    { id: 'test-1', name: 'Test Scenario 1', agentNames: ['researcher'], difficulty: 'easy', isCritical: true },
    { id: 'test-2', name: 'Test Scenario 2', agentNames: ['writer'], difficulty: 'medium', isCritical: false },
  ],
  getScenarioStats: () => ({ total: 2, criticalCount: 1, byDifficulty: { easy: 1, medium: 1, hard: 0, adversarial: 0 }, byAgent: {} }),
}));

vi.mock('@/lib/agents/training-scenario-runner', () => ({
  TrainingScenarioRunner: vi.fn().mockImplementation(() => ({
    runAll: vi.fn().mockResolvedValue({
      totalScenarios: 2,
      passedCount: 1,
      failedCount: 1,
      passRate: 50,
      averageScore: 75,
      executedAt: new Date().toISOString(),
      agentSummaries: {},
      results: [],
    }),
  })),
}));

vi.mock('@/lib/agents/real-agent-executor', () => ({
  createRealAgentExecutor: vi.fn().mockReturnValue(async () => 'mock result'),
}));

// ── GOD MODE metrics mocks ──
const { mockGetGodModeMetrics, mockGetGodModeCostAnalysis, mockGetGodModeMessageHistory } = vi.hoisted(() => ({
  mockGetGodModeMetrics: vi.fn(),
  mockGetGodModeCostAnalysis: vi.fn(),
  mockGetGodModeMessageHistory: vi.fn(),
}));

vi.mock('@/lib/god-mode-metrics', () => ({
  getGodModeMetrics: (...args: unknown[]) => mockGetGodModeMetrics(...args),
  getGodModeCostAnalysis: (...args: unknown[]) => mockGetGodModeCostAnalysis(...args),
  getGodModeMessageHistory: (...args: unknown[]) => mockGetGodModeMessageHistory(...args),
  QUALITY_BUCKET_COLORS: ['#ef4444', '#f59e0b', '#10b981', '#06b6d4'],
  QUALITY_BUCKET_LABELS: ['0-25%', '25-50%', '50-75%', '75-100%'],
}));

// ─── Direct import (no lazy loading in tests) ───
import { TrainingDashboard } from './TrainingDashboard';

function renderDashboard() {
  return render(<TrainingDashboard />);
}

// ─── Helper: create scored messages for sparkline ───

function createScoredMessages(scores: number[], agentType = 'researcher', provider = 'openai'): GodModeMessageEntry[] {
  return scores.map((score, i) => ({
    id: `scored-${i}`,
    timestamp: Date.now() - (scores.length - i) * 1000,
    agentType,
    provider,
    model: 'gpt-4o',
    tokensUsed: 1500,
    wasSuccessful: true,
    qualityScore: score / 100, // normalize to 0-1
  }));
}

// ─── Tests ─────────────────────────────

describe('TrainingDashboard GOD MODE visualizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGodModeMetrics.mockReturnValue(MOCK_GOD_MODE_METRICS_DISABLED);
    mockGetGodModeCostAnalysis.mockReturnValue({
      avgTokensGodMode: 0,
      avgTokensNormal: null,
      overheadPercent: null,
      totalGodModeTokens: 0,
      godModeMessageCount: 0,
    });
    mockGetGodModeMessageHistory.mockReturnValue([]);
  });

  // ── Empty State ──

  it('hides sparkline when fewer than 2 scored messages exist', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 1,
      totalMessages: 1,
      totalTokens: 1500,
      scoredMessages: [{ id: 'only-one', timestamp: Date.now(), agentType: 'researcher', provider: 'openai', model: 'gpt-4o', tokensUsed: 1500, wasSuccessful: true, qualityScore: 0.85 }],
      qualityDistribution: [
        { range: '0-25%', count: 0 },
        { range: '25-50%', count: 0 },
        { range: '50-75%', count: 0 },
        { range: '75-100%', count: 1 },
      ],
      agentQualityDistribution: {},
      providerQualityDistribution: {},
    });
    mockGetGodModeMessageHistory.mockReturnValue([{ ...MOCK_GOD_MODE_MESSAGES[0], qualityScore: 0.85 }]);

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    expect(screen.queryByText('📈 Quality Trend')).toBeNull();
  });

  it('hides histogram when all qualityDistribution buckets have zero counts', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 1,
      totalMessages: 1,
      totalTokens: 1500,
      scoredMessages: [],
      qualityDistribution: [
        { range: '0-25%', count: 0 },
        { range: '25-50%', count: 0 },
        { range: '50-75%', count: 0 },
        { range: '75-100%', count: 0 },
      ],
      agentQualityDistribution: {},
      providerQualityDistribution: {},
    });
    mockGetGodModeMessageHistory.mockReturnValue([{ ...MOCK_GOD_MODE_MESSAGES[0], qualityScore: undefined }]);

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    expect(screen.queryByText('⭐ Quality Distribution')).toBeNull();
  });

  it('hides per-agent distribution when agentQualityDistribution is empty', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 1,
      totalMessages: 1,
      totalTokens: 1500,
      scoredMessages: [],
      qualityDistribution: [
        { range: '0-25%', count: 0 },
        { range: '25-50%', count: 0 },
        { range: '50-75%', count: 0 },
        { range: '75-100%', count: 0 },
      ],
      agentQualityDistribution: {},
      providerQualityDistribution: {},
    });
    mockGetGodModeMessageHistory.mockReturnValue([{ ...MOCK_GOD_MODE_MESSAGES[0], qualityScore: undefined }]);

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    expect(screen.queryByText('📋 Per-Agent Distribution')).toBeNull();
  });

  it('hides per-provider distribution when providerQualityDistribution is empty', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 1,
      totalMessages: 1,
      totalTokens: 1500,
      scoredMessages: [],
      qualityDistribution: [
        { range: '0-25%', count: 0 },
        { range: '25-50%', count: 0 },
        { range: '50-75%', count: 0 },
        { range: '75-100%', count: 0 },
      ],
      agentQualityDistribution: {},
      providerQualityDistribution: {},
    });
    mockGetGodModeMessageHistory.mockReturnValue([{ ...MOCK_GOD_MODE_MESSAGES[0], qualityScore: undefined }]);

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    expect(screen.queryByText('📡 Per-Provider Distribution')).toBeNull();
  });

  // ── Sparkline ──

  it('renders sparkline when >= 2 scored messages exist', async () => {
    const scoredMessages = createScoredMessages([85, 90, 80, 95, 88]);
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 3,
      totalMessages: 5,
      totalTokens: 7500,
      avgQuality: 0.88,
      scoredMessages,
      qualityDistribution: [
        { range: '0-25%', count: 0 },
        { range: '25-50%', count: 0 },
        { range: '50-75%', count: 0 },
        { range: '75-100%', count: 5 },
      ],
      agentQualityDistribution: { researcher: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 0 }, { range: '75-100%', count: 5 },
      ] },
      providerQualityDistribution: { openai: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 0 }, { range: '75-100%', count: 5 },
      ] },
    });
    mockGetGodModeMessageHistory.mockReturnValue(scoredMessages);

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    expect(screen.getByText('📈 Quality Trend')).toBeDefined();
    // SVG sparkline with aria-label containing "Quality trend"
    const svg = screen.getByRole('img', { name: /Quality trend/ });
    expect(svg).toBeDefined();
    expect(svg).toHaveAttribute('aria-roledescription', 'sparkline chart');
  });

  it('sparkline shows improving trend when recent scores are higher', async () => {
    // Lower scores first, higher scores later → improving trend
    const scoredMessages = createScoredMessages([60, 65, 70, 80, 90]);
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 3,
      totalMessages: 5,
      totalTokens: 7500,
      avgQuality: 0.73,
      scoredMessages,
      qualityDistribution: [
        { range: '0-25%', count: 0 },
        { range: '25-50%', count: 0 },
        { range: '50-75%', count: 3 },
        { range: '75-100%', count: 2 },
      ],
      agentQualityDistribution: { researcher: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 3 }, { range: '75-100%', count: 2 },
      ] },
      providerQualityDistribution: { openai: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 3 }, { range: '75-100%', count: 2 },
      ] },
    });
    mockGetGodModeMessageHistory.mockReturnValue(scoredMessages);

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    const svg = screen.getByRole('img', { name: /improving/ });
    expect(svg).toBeDefined();
  });

  it('sparkline shows declining trend when recent scores are lower', async () => {
    // Higher scores first, lower scores later → declining trend
    const scoredMessages = createScoredMessages([95, 90, 85, 70, 60]);
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 3,
      totalMessages: 5,
      totalTokens: 7500,
      avgQuality: 0.80,
      scoredMessages,
      qualityDistribution: [
        { range: '0-25%', count: 0 },
        { range: '25-50%', count: 0 },
        { range: '50-75%', count: 3 },
        { range: '75-100%', count: 2 },
      ],
      agentQualityDistribution: { researcher: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 3 }, { range: '75-100%', count: 2 },
      ] },
      providerQualityDistribution: { openai: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 3 }, { range: '75-100%', count: 2 },
      ] },
    });
    mockGetGodModeMessageHistory.mockReturnValue(scoredMessages);

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    const svg = screen.getByRole('img', { name: /declining/ });
    expect(svg).toBeDefined();
  });

  it('sparkline contains polyline and circle elements', async () => {
    const scoredMessages = createScoredMessages([80, 85, 90]);
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 2,
      totalMessages: 3,
      totalTokens: 4500,
      avgQuality: 0.85,
      scoredMessages,
      qualityDistribution: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 0 }, { range: '75-100%', count: 3 },
      ],
      agentQualityDistribution: { researcher: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 0 }, { range: '75-100%', count: 3 },
      ] },
      providerQualityDistribution: { openai: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 0 }, { range: '75-100%', count: 3 },
      ] },
    });
    mockGetGodModeMessageHistory.mockReturnValue(scoredMessages);

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    const svg = screen.getByRole('img', { name: /Quality trend/ });
    const polyline = svg.querySelector('polyline');
    const circle = svg.querySelector('circle');
    expect(polyline).toBeDefined();
    expect(circle).toBeDefined();
    // polyline should have points attribute
    expect(polyline!.getAttribute('points')).toBeTruthy();
  });

  // ── Histogram ──

  it('renders histogram when qualityDistribution has non-zero counts', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 3,
      totalMessages: 5,
      totalTokens: 7500,
      avgQuality: 0.85,
      scoredMessages: createScoredMessages([55, 65, 80, 90, 95]),
      qualityDistribution: [
        { range: '0-25%', count: 0 },
        { range: '25-50%', count: 0 },
        { range: '50-75%', count: 2 },
        { range: '75-100%', count: 3 },
      ],
      agentQualityDistribution: { researcher: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 2 }, { range: '75-100%', count: 3 },
      ] },
      providerQualityDistribution: { openai: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 2 }, { range: '75-100%', count: 3 },
      ] },
    });
    mockGetGodModeMessageHistory.mockReturnValue(createScoredMessages([55, 65, 80, 90, 95]));

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    expect(screen.getByText('⭐ Quality Distribution')).toBeDefined();
    // 4 histogram bars (one per bucket) — scope to histogram section only
    const histogramSection = screen.getByText('⭐ Quality Distribution').closest('.mt-4')!;
    const histogramBars = within(histogramSection).getAllByTestId('histogram-bar');
    expect(histogramBars.length).toBe(4);
  });

  it('histogram bars render with correct height percentages based on maxCount scaling', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 3,
      totalMessages: 5,
      totalTokens: 7500,
      avgQuality: 0.85,
      scoredMessages: createScoredMessages([55, 65, 80, 90, 95]),
      qualityDistribution: [
        { range: '0-25%', count: 0 },
        { range: '25-50%', count: 0 },
        { range: '50-75%', count: 2 },
        { range: '75-100%', count: 3 },
      ],
      agentQualityDistribution: {},
      providerQualityDistribution: {},
    });
    mockGetGodModeMessageHistory.mockReturnValue(createScoredMessages([55, 65, 80, 90, 95]));

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    const histogramSection = screen.getByText('⭐ Quality Distribution').closest('.mt-4')! as HTMLElement;
    const bars = within(histogramSection).getAllByTestId('histogram-bar');
    expect(bars.length).toBe(4);

    // maxCount = 3, so heights: 0/3=0%, 0/3=0%, 2/3=66.7%, 3/3=100%
    expect(bars[0].getAttribute('style')).toContain('height: 0%');
    expect(bars[1].getAttribute('style')).toContain('height: 0%');
    expect(bars[2].getAttribute('style')).toContain('height: 66.');
    expect(bars[3].getAttribute('style')).toContain('height: 100%');
  });

  it('histogram bars have the correct bucket colors from QUALITY_BUCKET_COLORS', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 2,
      totalMessages: 3,
      totalTokens: 4500,
      avgQuality: 0.80,
      scoredMessages: createScoredMessages([30, 60, 90]),
      qualityDistribution: [
        { range: '0-25%', count: 1 },
        { range: '25-50%', count: 0 },
        { range: '50-75%', count: 1 },
        { range: '75-100%', count: 1 },
      ],
      agentQualityDistribution: {},
      providerQualityDistribution: {},
    });
    mockGetGodModeMessageHistory.mockReturnValue(createScoredMessages([30, 60, 90]));

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    const histogramSection = screen.getByText('⭐ Quality Distribution').closest('.mt-4')! as HTMLElement;
    const bars = within(histogramSection).getAllByTestId('histogram-bar');

    // QUALITY_BUCKET_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4']
    // Note: jsdom converts hex to rgb, so check for both formats
    const style0 = bars[0].getAttribute('style')!;
    const style1 = bars[1].getAttribute('style')!;
    const style2 = bars[2].getAttribute('style')!;
    const style3 = bars[3].getAttribute('style')!;
    // #ef4444 = rgb(239, 68, 68)
    expect(style0).toMatch(/#ef4444|rgb\(239,\s*68,\s*68\)/);
    // #f59e0b = rgb(245, 158, 11)
    expect(style1).toMatch(/#f59e0b|rgb\(245,\s*158,\s*11\)/);
    // #10b981 = rgb(16, 185, 129)
    expect(style2).toMatch(/#10b981|rgb\(16,\s*185,\s*129\)/);
    // #06b6d4 = rgb(6, 182, 212)
    expect(style3).toMatch(/#06b6d4|rgb\(6,\s*182,\s*212\)/);
  });

  it('histogram bars have the transition-all duration-300 CSS class for smooth animations', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 1,
      totalMessages: 2,
      totalTokens: 3000,
      scoredMessages: createScoredMessages([80, 90]),
      qualityDistribution: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 0 }, { range: '75-100%', count: 2 },
      ],
      agentQualityDistribution: {},
      providerQualityDistribution: {},
    });
    mockGetGodModeMessageHistory.mockReturnValue(createScoredMessages([80, 90]));

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    const histogramSection = screen.getByText('⭐ Quality Distribution').closest('.mt-4')!;
    const histogramBars = within(histogramSection).getAllByTestId('histogram-bar');
    histogramBars.forEach((bar) => {
      expect(bar.className).toContain('transition-all');
      expect(bar.className).toContain('duration-300');
    });
  });

  it('histogram bars are equal width (w-full) for even distribution', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 1,
      totalMessages: 2,
      totalTokens: 3000,
      scoredMessages: createScoredMessages([80, 90]),
      qualityDistribution: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 1 }, { range: '75-100%', count: 1 },
      ],
      agentQualityDistribution: {},
      providerQualityDistribution: {},
    });
    mockGetGodModeMessageHistory.mockReturnValue(createScoredMessages([80, 90]));

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    const histogramSection = screen.getByText('⭐ Quality Distribution').closest('.mt-4')!;
    const histogramBars = within(histogramSection).getAllByTestId('histogram-bar');
    // Each bar fills its container width (w-full) - the parent div provides flex-1 for equal distribution
    histogramBars.forEach((bar) => {
      expect(bar.className).toContain('w-full');
    });
    // The parent columns use flex-1 for equal width distribution
    const histogramContainer = histogramSection.querySelector('[role="figure"]')!;
    const columns = histogramContainer.querySelectorAll('.flex-1');
    expect(columns.length).toBe(4);
  });

  it('histogram section has proper ARIA attributes (role=figure, aria-labelledby)', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 1,
      totalMessages: 2,
      totalTokens: 3000,
      scoredMessages: createScoredMessages([80, 90]),
      qualityDistribution: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 1 }, { range: '75-100%', count: 1 },
      ],
      agentQualityDistribution: {},
      providerQualityDistribution: {},
    });
    mockGetGodModeMessageHistory.mockReturnValue(createScoredMessages([80, 90]));

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    const heading = screen.getByText('⭐ Quality Distribution');
    const figureContainer = heading.closest('.mt-4')!.querySelector('[role="figure"]') as HTMLElement;
    expect(figureContainer).toBeDefined();
    expect(figureContainer).toHaveAttribute('role', 'figure');
    expect(figureContainer).toHaveAttribute('aria-labelledby', 'god-mode-training-quality-dist-heading');
  });

  it('histogram bars have role=img with aria-label for screen readers', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 1,
      totalMessages: 2,
      totalTokens: 3000,
      scoredMessages: createScoredMessages([80, 90]),
      qualityDistribution: [
        { range: '0-25%', count: 1 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 2 }, { range: '75-100%', count: 0 },
      ],
      agentQualityDistribution: {},
      providerQualityDistribution: {},
    });
    mockGetGodModeMessageHistory.mockReturnValue(createScoredMessages([30, 60, 70]));

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    const histogramSection = screen.getByText('⭐ Quality Distribution').closest('.mt-4')!;
    const histogramBars = within(histogramSection).getAllByTestId('histogram-bar');
    expect(histogramBars.length).toBe(4);
    // Bar 0: "0-25%: 1 score" (singular)
    expect(histogramBars[0]).toHaveAttribute('role', 'img');
    expect(histogramBars[0]).toHaveAttribute('aria-label', '0-25%: 1 score');
    // Bar 1: "25-50%: 0 scores"
    expect(histogramBars[1]).toHaveAttribute('aria-label', '25-50%: 0 scores');
    // Bar 2: "50-75%: 2 scores" (plural)
    expect(histogramBars[2]).toHaveAttribute('aria-label', '50-75%: 2 scores');
  });

  it('renders histogram bucket counts with correct values', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 2,
      totalMessages: 4,
      totalTokens: 6000,
      scoredMessages: createScoredMessages([30, 60, 80, 90]),
      qualityDistribution: [
        { range: '0-25%', count: 1 },
        { range: '25-50%', count: 0 },
        { range: '50-75%', count: 1 },
        { range: '75-100%', count: 2 },
      ],
      agentQualityDistribution: {},
      providerQualityDistribution: {},
    });
    mockGetGodModeMessageHistory.mockReturnValue(createScoredMessages([30, 60, 80, 90]));

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    // Check the histogram section has count text for non-zero buckets
    const histogramSection = screen.getByText('⭐ Quality Distribution').closest('.mt-4')!;
    const countTexts = within(histogramSection).getAllByText(/^\d+$/);
    // Counts displayed: 1, 0, 1, 2
    const counts = countTexts.map((el) => el.textContent);
    expect(counts).toContain('1');
    expect(counts).toContain('0');
    expect(counts).toContain('2');
  });

  it('histogram single bucket with non-zero count renders at 100% height (Math.max fallback to 1)', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 1,
      totalMessages: 1,
      totalTokens: 1500,
      scoredMessages: createScoredMessages([90]),
      qualityDistribution: [
        { range: '0-25%', count: 0 },
        { range: '25-50%', count: 0 },
        { range: '50-75%', count: 0 },
        { range: '75-100%', count: 1 },
      ],
      agentQualityDistribution: {},
      providerQualityDistribution: {},
    });
    mockGetGodModeMessageHistory.mockReturnValue(createScoredMessages([90]));

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    const histogramSection = screen.getByText('⭐ Quality Distribution').closest('.mt-4')!;
    const bars = within(histogramSection).getAllByTestId('histogram-bar');
    // Only the last bar (75-100%) has count=1, maxCount=1, so height = 100%
    expect(bars[3].getAttribute('style')).toContain('height: 100%');
    // Other bars have count=0, so height = 0%
    expect(bars[0].getAttribute('style')).toContain('height: 0%');
    expect(bars[1].getAttribute('style')).toContain('height: 0%');
    expect(bars[2].getAttribute('style')).toContain('height: 0%');
  });

  // ── Per-Agent Distribution ──

  it('renders per-agent quality distribution breakdown when agentQualityDistribution has data', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 3,
      totalMessages: 4,
      totalTokens: 6000,
      avgQuality: 0.82,
      scoredMessages: createScoredMessages([85, 90, 88, 92]),
      qualityDistribution: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 0 }, { range: '75-100%', count: 4 },
      ],
      agentQualityDistribution: {
        researcher: [
          { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 1 }, { range: '75-100%', count: 3 },
        ],
      },
      providerQualityDistribution: {},
    });
    mockGetGodModeMessageHistory.mockReturnValue(createScoredMessages([85, 90, 88, 92]));

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    expect(screen.getByText('📋 Per-Agent Distribution')).toBeDefined();
    // researcher should be listed in the per-agent section
    const agentSection = screen.getByText('📋 Per-Agent Distribution').closest('[role="figure"]')!;
    expect(within(agentSection).getByText('researcher')).toBeDefined();
  });

  it('per-agent distribution shows bucket counts for each agent', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 2,
      totalMessages: 3,
      totalTokens: 4500,
      scoredMessages: createScoredMessages([55, 85, 95]),
      qualityDistribution: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 1 }, { range: '75-100%', count: 2 },
      ],
      agentQualityDistribution: {
        researcher: [
          { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 1 }, { range: '75-100%', count: 2 },
        ],
      },
      providerQualityDistribution: {},
    });
    mockGetGodModeMessageHistory.mockReturnValue(createScoredMessages([55, 85, 95]));

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    const agentSection = screen.getByText('📋 Per-Agent Distribution').closest('[role="figure"]')!;
    const bucketCounts = within(agentSection).getAllByText('1');
    expect(bucketCounts.length).toBeGreaterThanOrEqual(1);
    const twoCounts = within(agentSection).getAllByText('2');
    expect(twoCounts.length).toBeGreaterThanOrEqual(1);
  });

  // ── Per-Provider Distribution ──

  it('renders per-provider quality distribution breakdown when providerQualityDistribution has data', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 3,
      totalMessages: 4,
      totalTokens: 6000,
      avgQuality: 0.82,
      scoredMessages: createScoredMessages([85, 90, 88, 92]),
      qualityDistribution: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 0 }, { range: '75-100%', count: 4 },
      ],
      agentQualityDistribution: {},
      providerQualityDistribution: {
        openai: [
          { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 1 }, { range: '75-100%', count: 3 },
        ],
      },
    });
    mockGetGodModeMessageHistory.mockReturnValue(createScoredMessages([85, 90, 88, 92]));

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    expect(screen.getByText('📡 Per-Provider Distribution')).toBeDefined();
    expect(screen.getByText('openai')).toBeDefined();
  });

  it('per-provider distribution shows bucket counts for each provider', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 2,
      totalMessages: 3,
      totalTokens: 4500,
      scoredMessages: createScoredMessages([55, 85, 95]),
      qualityDistribution: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 1 }, { range: '75-100%', count: 2 },
      ],
      agentQualityDistribution: {},
      providerQualityDistribution: {
        openai: [
          { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 1 }, { range: '75-100%', count: 2 },
        ],
      },
    });
    mockGetGodModeMessageHistory.mockReturnValue(createScoredMessages([55, 85, 95]));

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    const providerSection = screen.getByText('📡 Per-Provider Distribution').closest('[role="figure"]')!;
    const bucketCounts = within(providerSection).getAllByText('1');
    expect(bucketCounts.length).toBeGreaterThanOrEqual(1);
    const twoCounts = within(providerSection).getAllByText('2');
    expect(twoCounts.length).toBeGreaterThanOrEqual(1);
  });

  it('per-provider distribution has role=figure and aria-labelledby', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 1,
      totalMessages: 2,
      totalTokens: 3000,
      scoredMessages: createScoredMessages([80, 90]),
      qualityDistribution: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 0 }, { range: '75-100%', count: 2 },
      ],
      agentQualityDistribution: {},
      providerQualityDistribution: {
        openai: [
          { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 0 }, { range: '75-100%', count: 2 },
        ],
      },
    });
    mockGetGodModeMessageHistory.mockReturnValue(createScoredMessages([80, 90]));

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    const figure = screen.getByText('📡 Per-Provider Distribution').closest('[role="figure"]') as HTMLElement;
    expect(figure).toHaveAttribute('role', 'figure');
    expect(figure).toHaveAttribute('aria-labelledby');
  });

  // ── Full Integration ──

  it('renders all visualizations together when full data is present', async () => {
    mockGetGodModeMetrics.mockReturnValue(MOCK_GOD_MODE_METRICS);
    mockGetGodModeCostAnalysis.mockReturnValue({
      avgTokensGodMode: 4000,
      avgTokensNormal: 2500,
      overheadPercent: 60,
      totalGodModeTokens: 48000,
      godModeMessageCount: 12,
    });
    mockGetGodModeMessageHistory.mockReturnValue(MOCK_GOD_MODE_MESSAGES);

    renderDashboard();

    expect(await screen.findByText('⚡ GOD MODE Training Impact')).toBeDefined();
    // Sparkline
    expect(screen.getByText('📈 Quality Trend')).toBeDefined();
    expect(screen.getByRole('img', { name: /Quality trend/ })).toBeDefined();
    // Histogram
    expect(screen.getByText('⭐ Quality Distribution')).toBeDefined();
    const histogramSection = screen.getByText('⭐ Quality Distribution').closest('.mt-4')!;
    expect(within(histogramSection).getAllByTestId('histogram-bar').length).toBe(4);
    // Per-Agent
    expect(screen.getByText('📋 Per-Agent Distribution')).toBeDefined();
    // Per-Provider
    expect(screen.getByText('📡 Per-Provider Distribution')).toBeDefined();
    // Stats
    expect(screen.getByText('Avg Quality')).toBeDefined();
    expect(screen.getByText('How GOD MODE affects agent quality and token usage')).toBeDefined();
  });

  it('renders alongside training scenario content', async () => {
    mockGetGodModeMetrics.mockReturnValue({
      ...MOCK_GOD_MODE_METRICS_DISABLED,
      totalToggles: 3,
      totalMessages: 5,
      totalTokens: 10000,
      avgQuality: 0.85,
      scoredMessages: createScoredMessages([80, 85, 90]),
      qualityDistribution: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 0 }, { range: '75-100%', count: 3 },
      ],
      agentQualityDistribution: { researcher: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 0 }, { range: '75-100%', count: 3 },
      ] },
      providerQualityDistribution: { openai: [
        { range: '0-25%', count: 0 }, { range: '25-50%', count: 0 }, { range: '50-75%', count: 0 }, { range: '75-100%', count: 3 },
      ] },
    });
    mockGetGodModeMessageHistory.mockReturnValue(createScoredMessages([80, 85, 90]));

    renderDashboard();

    // Training dashboard header
    expect(await screen.findByText('🧪 Training Scenarios')).toBeDefined();
    // GOD MODE section with all visualizations
    expect(screen.getByText('⚡ GOD MODE Training Impact')).toBeDefined();
    expect(screen.getByText('📈 Quality Trend')).toBeDefined();
    expect(screen.getByText('⭐ Quality Distribution')).toBeDefined();
    expect(screen.getByText('📋 Per-Agent Distribution')).toBeDefined();
    expect(screen.getByText('📡 Per-Provider Distribution')).toBeDefined();
    // Run button
    expect(screen.getByText(/▶️ Run All Scenarios/)).toBeDefined();
  });
});
