import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { EnhancedAnalyticsDashboard } from './EnhancedAnalyticsDashboard';

// ─── Mocks ─────────────────────────────

const mockToast = vi.fn();
vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(
    (...args: unknown[]) => mockToast(...args),
    { success: (...args: unknown[]) => mockToast(...args), error: (...args: unknown[]) => mockToast(...args) }
  ) as any,
}));

const mockUsageHistory = [
  { provider: 'openai', model: 'gpt-4', inputTokens: 1000, outputTokens: 500, costINR: 0.05, costUsd: 0.0006, timestamp: Date.now() - 3600000, agent: 'writer' },
  { provider: 'anthropic', model: 'claude-3', inputTokens: 800, outputTokens: 400, costINR: 0.03, costUsd: 0.0004, timestamp: Date.now() - 7200000, agent: 'developer' },
  { provider: 'openai', model: 'gpt-4', inputTokens: 600, outputTokens: 300, costINR: 0.02, costUsd: 0.0003, timestamp: Date.now() - 86400000, agent: 'writer' },
];

const mockAgentPerformance = [
  { agent: 'writer', totalTokens: 1500, totalCostUsd: 0.0009, successCount: 10, failCount: 1, avgQuality: 0.85, avgLatency: 1200, lastUsed: Date.now() - 3600000 },
  { agent: 'developer', totalTokens: 1200, totalCostUsd: 0.0007, successCount: 8, failCount: 2, avgQuality: 0.78, avgLatency: 2000, lastUsed: Date.now() - 7200000 },
];

const mockGodModeMetrics = {
  totalTokens: 5000,
  totalToggles: 15,
  totalMessages: 20,
  successfulMessages: 18,
  avgQuality: 0.82,
  scoredMessages: [
    { timestamp: Date.now() - 3600000, qualityScore: 0.85 },
    { timestamp: Date.now() - 7200000, qualityScore: 0.78 },
    { timestamp: Date.now() - 86400000, qualityScore: 0.90 },
  ],
  qualityDistribution: [
    { range: '0-20%', count: 2 },
    { range: '20-40%', count: 3 },
    { range: '40-60%', count: 5 },
    { range: '60-80%', count: 8 },
    { range: '80-100%', count: 12 },
  ],
};

const mockGodModeCost = {
  overheadPercent: 12.5,
  baseTokens: 4000,
  godModeTokens: 5000,
};

vi.mock('@/stores/router.store', () => ({
  useRouterStore: vi.fn(() => ({
    usageHistory: mockUsageHistory,
    totalCostINR: 0.10,
  })),
}));

vi.mock('@/lib/model-selector', () => ({
  getAgentPerformance: vi.fn(() => mockAgentPerformance),
}));

vi.mock('@/lib/god-mode-metrics', () => ({
  getGodModeMetrics: vi.fn(() => mockGodModeMetrics),
  getGodModeCostAnalysis: vi.fn(() => mockGodModeCost),
}));

const mockExportToCSV = vi.fn();
vi.mock('@/lib/export-utils', () => ({
  exportToCSV: (...args: unknown[]) => mockExportToCSV(...args),
}));

vi.mock('@/data/providers', () => ({
  PROVIDERS: [
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic' },
  ],
}));

// ─── Tests ─────────────────────────────

describe('EnhancedAnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──
  describe('rendering', () => {
    it('renders the header', async () => {
      await act(async () => { render(<EnhancedAnalyticsDashboard />); });
      expect(screen.getByText('📊 Analytics Dashboard')).toBeDefined();
      expect(screen.getByText('Agent performance, cost breakdowns, and quality trends')).toBeDefined();
    });

    it('renders view mode buttons', async () => {
      await act(async () => { render(<EnhancedAnalyticsDashboard />); });
      expect(screen.getByText(/📋 Overview/)).toBeDefined();
      expect(screen.getByText(/🤖 Agents/)).toBeDefined();
      expect(screen.getByText(/💰 Costs/)).toBeDefined();
      expect(screen.getByText(/⭐ Quality/)).toBeDefined();
    });

    it('renders time range buttons', async () => {
      await act(async () => { render(<EnhancedAnalyticsDashboard />); });
      expect(screen.getByText('24h')).toBeDefined();
      expect(screen.getByText('7D')).toBeDefined();
      expect(screen.getByText('30D')).toBeDefined();
      expect(screen.getByText('All')).toBeDefined();
    });

    it('renders export button', async () => {
      await act(async () => { render(<EnhancedAnalyticsDashboard />); });
      expect(screen.getByText(/📥 Export/)).toBeDefined();
    });
  });

  // ── Summary Stats ──
  describe('summary stats', () => {
    it('renders all 6 stat cards', async () => {
      await act(async () => { render(<EnhancedAnalyticsDashboard />); });
      expect(screen.getByText('📨')).toBeDefined();
      expect(screen.getByText('🔤')).toBeDefined();
      expect(screen.getByText('💰')).toBeDefined();
      expect(screen.getByText('🤖')).toBeDefined();
      expect(screen.getByText('⭐')).toBeDefined();
      expect(screen.getByText('✅')).toBeDefined();
    });

    it('shows request count', async () => {
      await act(async () => { render(<EnhancedAnalyticsDashboard />); });
      // 3 usage records
      expect(screen.getByText('3')).toBeDefined();
    });

    it('shows unique agents count', async () => {
      await act(async () => { render(<EnhancedAnalyticsDashboard />); });
      expect(screen.getByText('2')).toBeDefined();
    });

    it('shows cost in INR', async () => {
      await act(async () => { render(<EnhancedAnalyticsDashboard />); });
      expect(screen.getByText(/₹0\.10/)).toBeDefined();
    });

    it('shows average quality percentage', async () => {
      await act(async () => { render(<EnhancedAnalyticsDashboard />); });
      expect(screen.getByText('82%')).toBeDefined();
    });

    it('shows success rate percentage', async () => {
      await act(async () => { render(<EnhancedAnalyticsDashboard />); });
      expect(screen.getByText('90%')).toBeDefined();
    });
  });

  // ── Overview View ──
  describe('overview view', () => {
    it('renders overview charts by default', async () => {
      await act(async () => { render(<EnhancedAnalyticsDashboard />); });
      expect(screen.getByText('Cost Trend')).toBeDefined();
      expect(screen.getByText('Token Usage by Provider')).toBeDefined();
    });

    it('shows cost trend subtitle', async () => {
      await act(async () => { render(<EnhancedAnalyticsDashboard />); });
      expect(screen.getByText('Daily and cumulative spend')).toBeDefined();
    });

    it('shows provider token subtitle', async () => {
      await act(async () => { render(<EnhancedAnalyticsDashboard />); });
      expect(screen.getByText('Input vs Output tokens')).toBeDefined();
    });
  });

  // ── Agents View ──
  describe('agents view', () => {
    it('switches to agents view', async () => {
      const user = userEvent.setup();
      render(<EnhancedAnalyticsDashboard />);
      await waitFor(() => { expect(screen.getByText('📊 Analytics Dashboard')).toBeDefined(); });

      await user.click(screen.getByText(/🤖 Agents/));

      await waitFor(() => {
        expect(screen.getByText('Agent Performance')).toBeDefined();
        expect(screen.getByText('Cost by Agent')).toBeDefined();
        expect(screen.getByText('Agent Details')).toBeDefined();
      });
    });

    it('shows agent stats table', async () => {
      const user = userEvent.setup();
      render(<EnhancedAnalyticsDashboard />);
      await waitFor(() => { expect(screen.getByText('📊 Analytics Dashboard')).toBeDefined(); });

      await user.click(screen.getByText(/🤖 Agents/));

      await waitFor(() => {
        expect(screen.getByText('writer')).toBeDefined();
        expect(screen.getByText('developer')).toBeDefined();
      });
    });
  });

  // ── Costs View ──
  describe('costs view', () => {
    it('switches to costs view', async () => {
      const user = userEvent.setup();
      render(<EnhancedAnalyticsDashboard />);
      await waitFor(() => { expect(screen.getByText('📊 Analytics Dashboard')).toBeDefined(); });

      await user.click(screen.getByText(/💰 Costs/));

      await waitFor(() => {
        expect(screen.getByText('Cost by Provider')).toBeDefined();
        expect(screen.getByText('GOD MODE Cost Analysis')).toBeDefined();
      });
    });

    it('shows GOD MODE metrics', async () => {
      const user = userEvent.setup();
      render(<EnhancedAnalyticsDashboard />);
      await waitFor(() => { expect(screen.getByText('📊 Analytics Dashboard')).toBeDefined(); });

      await user.click(screen.getByText(/💰 Costs/));

      await waitFor(() => {
        expect(screen.getByText('GOD MODE Tokens')).toBeDefined();
        expect(screen.getByText('Overhead')).toBeDefined();
        expect(screen.getByText('Total Toggles')).toBeDefined();
        expect(screen.getByText('Messages')).toBeDefined();
      });
    });
  });

  // ── Quality View ──
  describe('quality view', () => {
    it('switches to quality view', async () => {
      const user = userEvent.setup();
      render(<EnhancedAnalyticsDashboard />);
      await waitFor(() => { expect(screen.getByText('📊 Analytics Dashboard')).toBeDefined(); });

      await user.click(screen.getByText(/⭐ Quality/));

      await waitFor(() => {
        expect(screen.getByText('Quality Trend')).toBeDefined();
        expect(screen.getByText('Quality Distribution')).toBeDefined();
      });
    });

    it('shows quality distribution buckets', async () => {
      const user = userEvent.setup();
      render(<EnhancedAnalyticsDashboard />);
      await waitFor(() => { expect(screen.getByText('📊 Analytics Dashboard')).toBeDefined(); });

      await user.click(screen.getByText(/⭐ Quality/));

      await waitFor(() => {
        expect(screen.getByText('0-20%')).toBeDefined();
        expect(screen.getByText('80-100%')).toBeDefined();
      });
    });
  });

  // ── Time Range ──
  describe('time range', () => {
    it('highlights active time range', async () => {
      const user = userEvent.setup();
      render(<EnhancedAnalyticsDashboard />);
      await waitFor(() => { expect(screen.getByText('📊 Analytics Dashboard')).toBeDefined(); });

      // 7D is default
      const sevenD = screen.getByText('7D');
      expect(sevenD.className).toContain('text-[var(--oracle-primary-l)]');

      // Switch to 24h
      await user.click(screen.getByText('24h'));
      const h24 = screen.getByText('24h');
      expect(h24.className).toContain('text-[var(--oracle-primary-l)]');
    });

    it('switches time range', async () => {
      const user = userEvent.setup();
      render(<EnhancedAnalyticsDashboard />);
      await waitFor(() => { expect(screen.getByText('📊 Analytics Dashboard')).toBeDefined(); });

      await user.click(screen.getByText('30D'));

      await waitFor(() => {
        const h30 = screen.getByText('30D');
        expect(h30.className).toContain('text-[var(--oracle-primary-l)]');
      });
    });
  });

  // ── Export ──
  describe('export', () => {
    it('calls exportToCSV when export button is clicked', async () => {
      const user = userEvent.setup();
      render(<EnhancedAnalyticsDashboard />);
      await waitFor(() => { expect(screen.getByText('📊 Analytics Dashboard')).toBeDefined(); });

      await user.click(screen.getByText(/📥 Export/));

      await waitFor(() => {
        expect(mockExportToCSV).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('exported'));
      });
    });
  });

  // ── Empty State ──
  describe('empty state', () => {
    it('renders without crashing when data is empty', async () => {
      const { useRouterStore } = await import('@/stores/router.store');
      (useRouterStore as ReturnType<typeof vi.fn>).mockReturnValue({
        usageHistory: [],
        totalCostINR: 0,
      });
      const { getAgentPerformance } = await import('@/lib/model-selector');
      (getAgentPerformance as ReturnType<typeof vi.fn>).mockReturnValue([]);
      const { getGodModeMetrics } = await import('@/lib/god-mode-metrics');
      (getGodModeMetrics as ReturnType<typeof vi.fn>).mockReturnValue({
        totalTokens: 0, totalToggles: 0, totalMessages: 0, successfulMessages: 0, avgQuality: 0,
        scoredMessages: [], qualityDistribution: [],
      });

      await act(async () => { render(<EnhancedAnalyticsDashboard />); });
      expect(screen.getByText('📊 Analytics Dashboard')).toBeDefined();
      // Should show N/A for quality and success when no data
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThanOrEqual(1);
    });
  });
});
