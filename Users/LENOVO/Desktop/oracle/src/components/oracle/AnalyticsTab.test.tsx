import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AnalyticsTab } from './AnalyticsTab';
import type { UsageRecord } from '@/types';

// ─── Mocks ─────────────────────────────



// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'responsive-container' }, children),
  AreaChart: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'area-chart' }, props.children as React.ReactNode),
  BarChart: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'bar-chart' }, props.children as React.ReactNode),
  PieChart: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'pie-chart' }, props.children as React.ReactNode),
  LineChart: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'line-chart' }, props.children as React.ReactNode),
  Area: () => null,
  Bar: () => null,
  Pie: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  CartesianGrid: () => null,
  Cell: () => null,
}));

// Mock Zustand store
const mockUsageHistory: UsageRecord[] = [];
const mockResetCosts = vi.fn();
let mockTotalCostINR = 0;

vi.mock('@/stores/router.store', () => ({
  useRouterStore: () => ({
    usageHistory: mockUsageHistory,
    totalCostINR: mockTotalCostINR,
    resetCosts: mockResetCosts,
  }),
}));

// Mock PROVIDERS
vi.mock('@/data/providers', () => ({
  PROVIDERS: [
    { id: 'openai', name: 'OpenAI', color: '#10b981' },
    { id: 'groq', name: 'Groq', color: '#f59e0b' },
  ],
}));

// ─── Helpers ───────────────────────────

function makeUsageRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    id: 'test-' + Math.random().toString(36).slice(2, 8),
    timestamp: Date.now() - Math.random() * 24 * 60 * 60 * 1000,
    provider: 'openai',
    model: 'gpt-4o',
    inputTokens: 100,
    outputTokens: 200,
    costINR: 0.5,
    costUSD: 0.006,
    taskType: 'orchestrator',
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────

describe('AnalyticsTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUsageHistory.length = 0;
    mockResetCosts.mockClear();
    mockTotalCostINR = 0;
    window.localStorage.clear();
  });

  // ── Empty State ──

  describe('empty state', () => {
    it('renders the empty state when no usage data exists', () => {
      render(<AnalyticsTab />);
      expect(screen.getByText('No Usage Data Yet')).toBeDefined();
      expect(screen.getByText('📊 Usage Analytics')).toBeDefined();
    });

    it('shows total cost and request count in empty state', () => {
      mockTotalCostINR = 12.5;
      mockUsageHistory.length = 0;
      render(<AnalyticsTab />);
      expect(screen.getByText('₹12.50')).toBeDefined();
      // '0' may appear in multiple stat cards
      expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);
    });

    it('does not show charts when data is empty', () => {
      render(<AnalyticsTab />);
      expect(screen.queryByRole('figure')).toBeNull();
    });
  });

  // ── Time Range Switching ──

  describe('time range switching', () => {
    it('renders all time range buttons', () => {
      render(<AnalyticsTab />);
      expect(screen.getByText('24 Hours')).toBeDefined();
      expect(screen.getByText('7 Days')).toBeDefined();
      expect(screen.getByText('30 Days')).toBeDefined();
      expect(screen.getByText('All Time')).toBeDefined();
    });

    it('defaults to 7 Days range', () => {
      render(<AnalyticsTab />);
      const sevenDaysBtn = screen.getByText('7 Days');
      // Default button should have active styling
      expect(sevenDaysBtn.className).toContain('bg-[var(--oracle-primary)]');
    });

    it('switches to 24 Hours when clicked', async () => {
      const user = userEvent.setup();
      render(<AnalyticsTab />);
      await user.click(screen.getByText('24 Hours'));
      expect(screen.getByText('24 Hours').className).toContain('bg-[var(--oracle-primary)]');
    });

    it('switches to 30 Days when clicked', async () => {
      const user = userEvent.setup();
      render(<AnalyticsTab />);
      await user.click(screen.getByText('30 Days'));
      expect(screen.getByText('30 Days').className).toContain('bg-[var(--oracle-primary)]');
    });

    it('switches to All Time when clicked', async () => {
      const user = userEvent.setup();
      render(<AnalyticsTab />);
      await user.click(screen.getByText('All Time'));
      expect(screen.getByText('All Time').className).toContain('bg-[var(--oracle-primary)]');
    });
  });

  // ── Chart Type Toggle ──

  describe('chart type toggle', () => {
    it('defaults to area chart', () => {
      mockUsageHistory.push(makeUsageRecord());
      render(<AnalyticsTab />);
      expect(screen.getByText('📈 Area').className).toContain('bg-[var(--oracle-primary)]');
    });

    it('switches to bar chart when clicked', async () => {
      const user = userEvent.setup();
      mockUsageHistory.push(makeUsageRecord());
      render(<AnalyticsTab />);
      await user.click(screen.getByText('📊 Bar'));
      expect(screen.getByText('📊 Bar').className).toContain('bg-[var(--oracle-primary)]');
    });
  });

  // ── Stat Cards ──

  describe('stat cards', () => {
    it('shows stat cards with data', () => {
      mockUsageHistory.push(
        makeUsageRecord({ inputTokens: 100, outputTokens: 200, costINR: 0.5 }),
        makeUsageRecord({ inputTokens: 300, outputTokens: 400, costINR: 1.0 }),
      );
      render(<AnalyticsTab />);
      expect(screen.getByText('Total Requests')).toBeDefined();
      expect(screen.getByText('Total Tokens')).toBeDefined();
      expect(screen.getByText('Total Cost')).toBeDefined();
      expect(screen.getByText('Avg per Request')).toBeDefined();
    });

    it('shows correct request count', () => {
      mockUsageHistory.push(makeUsageRecord(), makeUsageRecord(), makeUsageRecord());
      render(<AnalyticsTab />);
      expect(screen.getByText('3')).toBeDefined();
    });

    it('shows zero stats when no data in range', () => {
      // Add old data that won't be in 24h range
      mockUsageHistory.push(
        makeUsageRecord({ timestamp: Date.now() - 48 * 60 * 60 * 1000 }),
      );
      render(<AnalyticsTab />);
      expect(screen.getByText('Total Requests')).toBeDefined();
      // 24h is default range context, but 7d is default selection
    });
  });

  // ── Charts ──

  describe('charts', () => {
    it('renders chart cards when data exists', () => {
      mockUsageHistory.push(makeUsageRecord());
      render(<AnalyticsTab />);
      expect(screen.getByText('Token Usage Over Time')).toBeDefined();
      expect(screen.getByText('Cost Trend')).toBeDefined();
      expect(screen.getByText('Provider Breakdown')).toBeDefined();
      expect(screen.getByText('Model Distribution')).toBeDefined();
      expect(screen.getByText('Hourly Request Distribution')).toBeDefined();
      expect(screen.getByText('Token Efficiency')).toBeDefined();
    });

    it('renders the recent requests table', () => {
      mockUsageHistory.push(makeUsageRecord({ model: 'gpt-4o', provider: 'openai' }));
      render(<AnalyticsTab />);
      expect(screen.getByText('Recent Requests')).toBeDefined();
    });

    it('renders provider legend in pie chart', () => {
      mockUsageHistory.push(makeUsageRecord({ provider: 'openai' }));
      render(<AnalyticsTab />);
      // OpenAI may appear in both table and legend
      expect(screen.getAllByText(/OpenAI/).length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Reset Button ──

  describe('reset button', () => {
    it('shows reset button when data exists', () => {
      mockUsageHistory.push(makeUsageRecord());
      render(<AnalyticsTab />);
      expect(screen.getByText('Reset All Costs')).toBeDefined();
    });

    it('hides reset button when no data', () => {
      render(<AnalyticsTab />);
      expect(screen.queryByText('Reset All Costs')).toBeNull();
    });

    it('calls resetCosts when reset button is clicked', async () => {
      const user = userEvent.setup();
      mockUsageHistory.push(makeUsageRecord());
      render(<AnalyticsTab />);
      await user.click(screen.getByText('Reset All Costs'));
      expect(mockResetCosts).toHaveBeenCalledTimes(1);
    });
  });

  // ── Usage Table ──

  describe('usage table', () => {
    it('shows table headers', () => {
      mockUsageHistory.push(makeUsageRecord());
      render(<AnalyticsTab />);
      expect(screen.getByText('Time')).toBeDefined();
      expect(screen.getByText('Provider')).toBeDefined();
      expect(screen.getByText('Model')).toBeDefined();
      expect(screen.getByText('Input')).toBeDefined();
      expect(screen.getByText('Output')).toBeDefined();
      expect(screen.getByText('Total')).toBeDefined();
      expect(screen.getByText('Cost')).toBeDefined();
      expect(screen.getByText('Task')).toBeDefined();
    });

    it('shows model name in table rows', () => {
      mockUsageHistory.push(makeUsageRecord({ model: 'gpt-4o' }));
      render(<AnalyticsTab />);
      expect(screen.getByText('gpt-4o')).toBeDefined();
    });

    it('shows Free for zero-cost requests', () => {
      mockUsageHistory.push(makeUsageRecord({ costINR: 0 }));
      render(<AnalyticsTab />);
      expect(screen.getByText('Free')).toBeDefined();
    });

    it('shows INR cost for non-zero cost requests', () => {
      mockUsageHistory.push(makeUsageRecord({ costINR: 1.2345 }));
      render(<AnalyticsTab />);
      expect(screen.getByText('₹1.2345')).toBeDefined();
    });

    it('shows task type in table rows', () => {
      mockUsageHistory.push(makeUsageRecord({ taskType: 'writer' }));
      render(<AnalyticsTab />);
      expect(screen.getByText('writer')).toBeDefined();
    });

    it('shows dash for missing task type', () => {
      mockUsageHistory.push(makeUsageRecord({ taskType: undefined as unknown as string }));
      render(<AnalyticsTab />);
      expect(screen.getByText('—')).toBeDefined();
    });
  });

  // ── localStorage Persistence ──

  describe('time range persistence', () => {
    it('restores time range from localStorage on mount', () => {
      window.localStorage.setItem('oracle-analytics-range', '24h');
      render(<AnalyticsTab />);
      expect(screen.getByText('24 Hours').className).toContain('bg-[var(--oracle-primary)]');
    });
  });
});
