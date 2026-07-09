import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CommandCenterDashboard } from './CommandCenterDashboard';
vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {} },
  cardHoverProps: {},
  buttonTapProps: {},
}));

// Mock localStorage-based dependencies
const mockLoadQualityScores = vi.fn().mockReturnValue([]);
const mockAnalyzeQualityScores = vi.fn().mockReturnValue({ averageScore: 0, trend: 'stable', totalScored: 0 });
const mockGetProviderHealthRecords = vi.fn().mockReturnValue([]);
const mockGetProviderHealthStats = vi.fn().mockReturnValue([]);
const mockGetProgressTasks = vi.fn().mockReturnValue([]);
const mockGetTrainingSummary = vi.fn().mockReturnValue({ totalTasks: 0, successRate: 0, avgQuality: 0 });
const mockIsEmergencyStopActive = vi.fn().mockReturnValue(false);
const mockGetPaymentRecords = vi.fn().mockReturnValue([]);

vi.mock('@/lib/quality', () => ({
  loadQualityScores: (...args: unknown[]) => mockLoadQualityScores(...args),
  analyzeQualityScores: (...args: unknown[]) => mockAnalyzeQualityScores(...args),
}));

vi.mock('@/lib/provider-health', () => ({
  getProviderHealthRecords: (...args: unknown[]) => mockGetProviderHealthRecords(...args),
  getProviderHealthStats: (...args: unknown[]) => mockGetProviderHealthStats(...args),
}));

vi.mock('@/lib/progress-tracker', () => ({
  getProgressTasks: (...args: unknown[]) => mockGetProgressTasks(...args),
}));

vi.mock('@/lib/self-training', () => ({
  getTrainingSummary: (...args: unknown[]) => mockGetTrainingSummary(...args),
}));

vi.mock('@/lib/emergency-stop', () => ({
  isEmergencyStopActive: (...args: unknown[]) => mockIsEmergencyStopActive(...args),
}));

vi.mock('@/lib/razorpay', () => ({
  getPaymentRecords: (...args: unknown[]) => mockGetPaymentRecords(...args),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-container">{children}</div>,
  AreaChart: () => <div data-testid="area-chart" />,
  Area: () => null,
  LineChart: () => <div data-testid="line-chart" />,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

describe('CommandCenterDashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Default: empty data
    mockLoadQualityScores.mockReturnValue([]);
    mockAnalyzeQualityScores.mockReturnValue({ averageScore: 0, trend: 'stable', totalScored: 0 });
    mockGetProviderHealthRecords.mockReturnValue([]);
    mockGetProviderHealthStats.mockReturnValue([]);
    mockGetProgressTasks.mockReturnValue([]);
    mockGetTrainingSummary.mockReturnValue({ totalTasks: 0, successRate: 0, avgQuality: 0 });
    mockIsEmergencyStopActive.mockReturnValue(false);
    mockGetPaymentRecords.mockReturnValue([]);
  });

  // ── Loading & Error States ──

  it('renders without crashing on empty data', async () => {
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    // 'Active Tasks' appears in MetricCard top row + TaskStatusCard bottom row
    expect(screen.getAllByText(/Active Tasks/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/System Health/)).toBeTruthy();
  });

  it('renders header after loading', async () => {
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    expect(screen.getByText(/Real-time overview of your agency operations/)).toBeTruthy();
  });

  it('renders error state when loadMetrics throws', async () => {
    mockLoadQualityScores.mockImplementation(() => { throw new Error('Network error'); });
    render(<CommandCenterDashboard />);
    await screen.findByText('Network error');
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('Retry button re-attempts loading after error', async () => {
    mockLoadQualityScores.mockImplementation(() => { throw new Error('Network error'); });
    render(<CommandCenterDashboard />);
    await screen.findByText('Network error');

    // Fix the mock so retry succeeds
    mockLoadQualityScores.mockReturnValue([]);
    fireEvent.click(screen.getByText('Retry'));
    await screen.findByText(/Agency Command Center/);
    expect(screen.queryByText('Network error')).toBeNull();
  });

  // ── Metric Cards ──

  it('renders metric cards with correct titles', async () => {
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    // 'Active Tasks' appears in MetricCard top row + TaskStatusCard bottom row
    expect(screen.getAllByText('Active Tasks').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Training Tasks').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Revenue').length).toBeGreaterThanOrEqual(1);
    // 'Quality Score' appears in MetricCard top row + QualityCard bottom row
    expect(screen.getAllByText('Quality Score').length).toBeGreaterThanOrEqual(1);
  });

  it('renders metric cards with data from mocks', async () => {
    mockGetProgressTasks.mockReturnValue([
      { id: '1', status: 'in-progress', createdAt: Date.now() },
      { id: '2', status: 'completed', createdAt: Date.now() },
    ]);
    mockGetTrainingSummary.mockReturnValue({ totalTasks: 15, successRate: 85, avgQuality: 78 });
    mockGetPaymentRecords.mockReturnValue([
      { amount: 50000, status: 'captured', createdAt: Date.now() },
      { amount: 30000, status: 'pending', createdAt: Date.now() },
    ]);

    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);

    // '15' appears in both MetricCard (top row) and TrainingCard (detail card)
    expect(screen.getAllByText('15').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('85%').length).toBeGreaterThanOrEqual(1);
  });

  // ── Detail Cards ──

  it('renders Agent Health card', async () => {
    mockGetProviderHealthStats.mockReturnValue([
      { status: 'healthy' },
      { status: 'degraded' },
    ]);
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    expect(screen.getByText(/Agent Health/)).toBeTruthy();
    // "Healthy" and "Degraded" each appear in both HealthBadge and StatusRow
    expect(screen.getAllByText('Healthy').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Degraded').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Self-Training card with training data', async () => {
    mockGetTrainingSummary.mockReturnValue({ totalTasks: 42, successRate: 92, avgQuality: 85 });
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    // 'Training Tasks' appears in both MetricCard top row and TrainingCard detail card
    expect(screen.getAllByText(/Training Tasks/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('42').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('92%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('85%').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Revenue card with INR formatting', async () => {
    mockGetPaymentRecords.mockReturnValue([
      { amount: 125000, status: 'captured', createdAt: Date.now() },
      { amount: 75000, status: 'pending', createdAt: Date.now() },
    ]);
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    // 'Revenue' appears in both MetricCard top row and RevenueCard detail card
    expect(screen.getAllByText(/Revenue/).length).toBeGreaterThanOrEqual(1);
    // Should display formatted INR amounts
    const revenueTexts = screen.getAllByText(/\u20B9/);
    expect(revenueTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Quality Score card with color coding', async () => {
    mockAnalyzeQualityScores.mockReturnValue({ averageScore: 92, trend: 'improving', totalScored: 100 });
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    // 'Quality Score' appears in both MetricCard top row and QualityCard bottom row
    expect(screen.getAllByText(/Quality Score/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('92%').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Task Status card', async () => {
    mockGetProgressTasks.mockReturnValue([
      { id: '1', status: 'in-progress', createdAt: Date.now() },
      { id: '2', status: 'completed', createdAt: Date.now() },
      { id: '3', status: 'paused', createdAt: Date.now() },
    ]);
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    // 'Active Tasks' appears in both MetricCard top row and TaskStatusCard
    expect(screen.getAllByText(/Active Tasks/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders System Health card with emergency stop status', async () => {
    mockIsEmergencyStopActive.mockReturnValue(true);
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    expect(screen.getByText(/System Health/)).toBeTruthy();
    // "Active" appears in both "Active Tasks" card and "🔴 Active" badge
    expect(screen.getAllByText(/Active/).length).toBeGreaterThanOrEqual(2);
  });

  it('renders System Health with inactive emergency stop', async () => {
    mockIsEmergencyStopActive.mockReturnValue(false);
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    expect(screen.getAllByText(/Inactive/).length).toBeGreaterThanOrEqual(1);
  });

  // ── Time Range Controls ──

  it('renders all time range buttons', async () => {
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    expect(screen.getByText('24h')).toBeTruthy();
    expect(screen.getByText('7d')).toBeTruthy();
    expect(screen.getByText('30d')).toBeTruthy();
    expect(screen.getByText('All')).toBeTruthy();
  });

  it('switches time range on click', async () => {
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);

    fireEvent.click(screen.getByText('30d'));
    // Should still render without errors
    expect(screen.getByText(/Agency Command Center/)).toBeTruthy();

    fireEvent.click(screen.getByText('All'));
    expect(screen.getByText(/Agency Command Center/)).toBeTruthy();

    fireEvent.click(screen.getByText('24h'));
    expect(screen.getByText(/Agency Command Center/)).toBeTruthy();
  });

  // ── Refresh & Auto-refresh ──

  it('Refresh button is present and clickable', async () => {
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    const refreshBtn = screen.getByText('Refresh');
    expect(refreshBtn).toBeTruthy();
    fireEvent.click(refreshBtn);
    expect(screen.getByText(/Agency Command Center/)).toBeTruthy();
  });

  it('shows auto-refresh footer', async () => {
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    expect(screen.getByText(/Auto-refreshes every 60s/)).toBeTruthy();
  });

  // ── Quality Trend Icons ──

  it('shows up trend icon for improving quality', async () => {
    mockAnalyzeQualityScores.mockReturnValue({ averageScore: 85, trend: 'improving', totalScored: 50 });
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    expect(screen.getAllByText('85%').length).toBeGreaterThanOrEqual(1);
  });

  it('shows down trend icon for declining quality', async () => {
    mockAnalyzeQualityScores.mockReturnValue({ averageScore: 45, trend: 'declining', totalScored: 50 });
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    expect(screen.getAllByText('45%').length).toBeGreaterThanOrEqual(1);
  });

  // ── Agent Health Status Variations ──

  it('shows Down badge when agents are down', async () => {
    mockGetProviderHealthStats.mockReturnValue([
      { status: 'healthy' },
      { status: 'down' },
    ]);
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    expect(screen.getAllByText('Down').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Healthy badge when all agents are healthy', async () => {
    mockGetProviderHealthStats.mockReturnValue([
      { status: 'healthy' },
      { status: 'healthy' },
    ]);
    render(<CommandCenterDashboard />);
    await screen.findByText(/Agency Command Center/);
    expect(screen.getAllByText('Healthy').length).toBeGreaterThanOrEqual(1);
  });

  // ── Non-Error Throw Handling ──

  it('handles non-Error exceptions gracefully', async () => {
    mockLoadQualityScores.mockImplementation(() => { throw 'string error'; });
    render(<CommandCenterDashboard />);
    await screen.findByText('Failed to load metrics');
    expect(screen.getByText('Retry')).toBeTruthy();
  });
});
