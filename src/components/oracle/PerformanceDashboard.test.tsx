import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { PerformanceDashboard } from './PerformanceDashboard';

// ─── Mocks ─────────────────────────────

vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: { initial: {}, animate: {} } },
  transitions: { smooth: {} },
  buttonTapProps: {},
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-container">{children}</div>,
  PieChart: () => <div data-testid="pie-chart" />,
  Pie: () => null,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => null,
  LineChart: () => <div data-testid="line-chart" />,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
}));

const mockPerformance = [
  {
    agent: 'researcher',
    model: 'gpt-4o',
    provider: 'openai',
    successCount: 15,
    failCount: 2,
    avgQuality: 0.88,
    avgLatency: 1200,
    totalTokens: 50000,
    totalCostUsd: 0.05,
    lastUsed: Date.now() - 3600000,
  },
  {
    agent: 'writer',
    model: 'claude-sonnet',
    provider: 'anthropic',
    successCount: 20,
    failCount: 1,
    avgQuality: 0.92,
    avgLatency: 800,
    totalTokens: 80000,
    totalCostUsd: 0.08,
    lastUsed: Date.now() - 7200000,
  },
];

const mockBudget = {
  dailyLimit: 1000000,
  usedToday: 130000,
};

const mockHistory = [
  { agent: 'researcher', quality: 0.85, latencyMs: 1100, costUsd: 0.01, success: true, timestamp: Date.now() - 86400000 },
  { agent: 'writer', quality: 0.90, latencyMs: 750, costUsd: 0.02, success: true, timestamp: Date.now() - 43200000 },
];

vi.mock('@/lib/model-selector', () => ({
  getAgentPerformance: vi.fn(() => mockPerformance),
  getTokenBudget: vi.fn(() => mockBudget),
  getPerformanceHistory: vi.fn(() => mockHistory),
  setBudgetDailyLimit: vi.fn(),
  MODEL_TIERS: {
    free: { maxCostPer1k: 0 },
    budget: { maxCostPer1k: 0.001 },
    standard: { maxCostPer1k: 0.01 },
    premium: { maxCostPer1k: 0.03 },
    elite: { maxCostPer1k: Infinity },
  },
}));

vi.mock('@/data/providers', () => ({
  PROVIDERS: [
    { id: 'openai', name: 'OpenAI', logo: '🟢', models: [{ id: 'gpt-4o', costPer1k: { output: 0.01 }, isFree: false }] },
    { id: 'anthropic', name: 'Anthropic', logo: '🟤', models: [{ id: 'claude-sonnet', costPer1k: { output: 0.015 }, isFree: false }] },
  ],
}));

vi.mock('@/lib/export-utils', () => ({
  exportToCSV: vi.fn(),
}));

// ─── Tests ─────────────────────────────

describe('PerformanceDashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ── Header ──

  it('renders the header with title', async () => {
    render(<PerformanceDashboard />);
    // 'Agent Performance' appears in header and in agent table section
    expect(screen.getAllByText(/Agent Performance/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Monitor agent success rates/)).toBeTruthy();
  });

  it('shows last updated time', async () => {
    render(<PerformanceDashboard />);
    expect(screen.getByText(/Last updated:/)).toBeTruthy();
  });

  // ── Time Range ──

  it('renders time range buttons', async () => {
    render(<PerformanceDashboard />);
    expect(screen.getByText('24 Hours')).toBeTruthy();
    expect(screen.getByText('7 Days')).toBeTruthy();
    expect(screen.getByText('30 Days')).toBeTruthy();
    expect(screen.getByText('All Time')).toBeTruthy();
  });

  it('switches time range on click', async () => {
    render(<PerformanceDashboard />);
    fireEvent.click(screen.getByText('7 Days'));
    expect(screen.getAllByText(/Agent Performance/).length).toBeGreaterThanOrEqual(1);
  });

  // ── Controls ──

  it('renders auto-refresh toggle', async () => {
    render(<PerformanceDashboard />);
    expect(screen.getByText('Auto')).toBeTruthy();
  });

  it('renders Export CSV button', async () => {
    render(<PerformanceDashboard />);
    expect(screen.getByText(/📥 Export CSV/)).toBeTruthy();
  });

  it('renders Refresh button', async () => {
    render(<PerformanceDashboard />);
    expect(screen.getByText(/🔄 Refresh/)).toBeTruthy();
  });

  // ── Stat Cards ──

  it('renders stat cards', async () => {
    render(<PerformanceDashboard />);
    expect(screen.getByText('Active Agents')).toBeTruthy();
    expect(screen.getByText('Success Rate')).toBeTruthy();
    expect(screen.getByText('Total Tokens')).toBeTruthy();
    expect(screen.getByText('Total Cost')).toBeTruthy();
  });

  it('shows correct agent count', async () => {
    render(<PerformanceDashboard />);
    expect(screen.getByText('2')).toBeTruthy(); // 2 unique agents
  });

  it('shows success rate percentage', async () => {
    render(<PerformanceDashboard />);
    // (15+20)/(15+2+20+1) = 35/38 = 92.1%
    expect(screen.getByText(/92\.1%/)).toBeTruthy();
  });

  // ── Token Budget ──

  it('renders token budget section', async () => {
    render(<PerformanceDashboard />);
    expect(screen.getAllByText(/Token Budget/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows budget percentage', async () => {
    render(<PerformanceDashboard />);
    expect(screen.getByText(/13\.0% used/)).toBeTruthy();
  });

  // ── Agent Performance Table ──

  it('renders agent performance table', async () => {
    render(<PerformanceDashboard />);
    expect(screen.getAllByText(/Agent Performance/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/researcher/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/writer/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows success rates for agents', async () => {
    render(<PerformanceDashboard />);
    expect(screen.getAllByText(/88% success/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/95% success/).length).toBeGreaterThanOrEqual(1);
  });

  it('expands agent details on click', async () => {
    render(<PerformanceDashboard />);
    const researcherBtn = screen.getByLabelText(/Toggle details for researcher/);
    fireEvent.click(researcherBtn);
    await waitFor(() => {
      expect(screen.getAllByText('gpt-4o').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Compare Agents ──

  it('shows compare checkbox for agents', async () => {
    render(<PerformanceDashboard />);
    const checkboxes = screen.getAllByLabelText(/Select .* for comparison/);
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it('shows comparison chart when 2+ agents selected', async () => {
    render(<PerformanceDashboard />);
    const checkboxes = screen.getAllByLabelText(/Select .* for comparison/);
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    await waitFor(() => {
      expect(screen.getAllByText(/Agent Comparison/).length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Budget Limit Editor ──

  it('opens budget limit editor on click', async () => {
    render(<PerformanceDashboard />);
    const editButton = screen.getByLabelText(/Click to edit daily token budget limit/);
    fireEvent.click(editButton);
    expect(screen.getByLabelText(/Edit daily token budget limit/)).toBeTruthy();
  });

  // ── Empty State ──

  it('shows empty state when no performance data', async () => {
    const { getAgentPerformance } = await import('@/lib/model-selector');
    vi.mocked(getAgentPerformance).mockReturnValue([]);
    render(<PerformanceDashboard />);
    expect(screen.getByText(/No Performance Data/)).toBeTruthy();
  });

  // ── Export ──

  it('export button is clickable and enabled', async () => {
    render(<PerformanceDashboard />);
    const exportBtn = screen.getByText(/📥 Export CSV/).closest('button')!;
    expect(exportBtn).toBeTruthy();
    expect(exportBtn).toHaveProperty('disabled', false);
    fireEvent.click(exportBtn);
    // Button should remain enabled after click
    expect(exportBtn).toHaveProperty('disabled', false);
  });
});
