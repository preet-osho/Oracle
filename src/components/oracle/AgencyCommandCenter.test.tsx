import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgencyCommandCenter } from './AgencyCommandCenter';
import { KeyboardShortcutsProvider } from '@/hooks/keyboard-shortcuts-context';

// Mock framer-motion to avoid animation issues in tests
function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
  const domProps: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (key === 'children' || key.startsWith('on') || key === 'className' || key === 'style' || key === 'data-testid' || key === 'key' || key === 'role' || key === 'title' || key === 'type' || key === 'disabled' || key === 'value' || key === 'placeholder' || key === 'id' || key === 'htmlFor') {
      domProps[key] = props[key];
    }
  }
  return domProps;
}

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...filterDomProps(props)}>{children}</div>,
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <button {...filterDomProps(props)}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock recharts to avoid DOM size issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Bar: () => null,
  Line: () => null,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
}));

// ─── Mocks ────────────────────────────

const mockGenerateMetrics = vi.fn();
vi.mock('@/lib/command-center', () => ({
  generateDashboardMetrics: (...args: unknown[]) => mockGenerateMetrics(...args),
  DATE_RANGE_OPTIONS: [
    { value: 'today', label: 'Today', icon: '📅' },
    { value: 'week', label: 'Week', icon: '📆' },
    { value: 'month', label: 'Month', icon: '🗓️' },
    { value: 'quarter', label: 'Quarter', icon: '📊' },
    { value: 'year', label: 'Year', icon: '📈' },
  ],
}));

const mockExportToCSV = vi.fn();
const mockExportToPDF = vi.fn();
vi.mock('@/lib/export-utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/export-utils')>('@/lib/export-utils');
  return {
    ...actual,
    exportToCSV: (...args: unknown[]) => mockExportToCSV(...args),
    exportToPDF: (...args: unknown[]) => mockExportToPDF(...args),
  };
});

// Note: vi.mock is hoisted, so we need to access the mock via the imported module
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockMetrics = {
  timestamp: Date.now(),
  revenue: {
    mrr: 150000,
    arr: 1800000,
    totalRevenue: 500000,
    revenueGrowth: 15,
    averageDealSize: 50000,
    ltv: 150000,
    cac: 10000,
    ltvCacRatio: 15,
  },
  pipeline: {
    totalValue: 1200000,
    weightedValue: 720000,
    dealCount: 24,
    averageProbability: 60,
    conversionRate: 35,
    averageSalesCycle: 45,
    forecast: {
      totalPipeline: 1200000,
      weightedPipeline: 720000,
      closedWon: 500000,
      closedLost: 200000,
      winRate: 35,
      avgDealSize: 50000,
      avgSalesCycleDays: 45,
      forecastByStage: [],
      monthlyForecast: [
        { month: 'Jul 2026', forecast: 200000, actual: 180000 },
        { month: 'Aug 2026', forecast: 250000, actual: 0 },
        { month: 'Sep 2026', forecast: 300000, actual: 0 },
      ],
    },
    stageBreakdown: [
      { stage: 'lead', count: 10, totalValue: 300000, weightedValue: 60000, avgProbability: 20 },
      { stage: 'qualified', count: 8, totalValue: 400000, weightedValue: 200000, avgProbability: 50 },
      { stage: 'proposal', count: 4, totalValue: 300000, weightedValue: 210000, avgProbability: 70 },
      { stage: 'negotiation', count: 2, totalValue: 200000, weightedValue: 160000, avgProbability: 80 },
      { stage: 'closed-won', count: 0, totalValue: 0, weightedValue: 0, avgProbability: 0 },
      { stage: 'closed-lost', count: 0, totalValue: 0, weightedValue: 0, avgProbability: 0 },
    ],
  },
  leads: {
    totalLeads: 50,
    newLeadsThisMonth: 12,
    leadsBySource: { 'Google Maps': 5, LinkedIn: 8, Website: 12, Referral: 3 },
    leadsByStatus: { New: 20, Qualified: 15, Client: 10 },
    conversionRate: 25,
    averageResponseTime: 4.5,
  },
  deals: {
    activeDeals: 24,
    closedWon: 10,
    closedLost: 5,
    winRate: 35,
    averageDealSize: 50000,
    dealsClosingThisMonth: 8,
    overdueDeals: 2,
  },
  activities: {
    totalActivities: 100,
    activitiesThisWeek: 15,
    callsMade: 8,
    emailsSent: 12,
    meetingsHeld: 4,
    tasksCompleted: 10,
    pendingTasks: 5,
  },
  agentHealth: {
    totalAgents: 15,
    activeAgents: 12,
    averageSuccessRate: 85,
    averageResponseTime: 1200,
    totalTokensUsed: 1000000,
    totalCostUsd: 50,
    topPerformingAgent: 'seo',
    worstPerformingAgent: 'designer',
  },
  costTracking: {
    totalCostUsd: 50,
    totalCostInr: 4200,
    costByProvider: { openai: 30, anthropic: 20 },
    costByAgent: { seo: 15, writer: 10 },
    budgetUtilization: 45,
    costTrend: [
      { date: '2026-07-04', cost: 7 },
      { date: '2026-07-05', cost: 8 },
      { date: '2026-07-06', cost: 6 },
      { date: '2026-07-07', cost: 9 },
      { date: '2026-07-08', cost: 7 },
      { date: '2026-07-09', cost: 8 },
      { date: '2026-07-10', cost: 5 },
    ],
  },
  learning: {
    totalTasksCompleted: 150,
    averageQualityScore: 78,
    improvementRate: 12,
    learningEntries: 150,
    patternMatches: 45,
    accuracyRate: 78,
  },
};

// ─── Helper ───────────────────────────

/** Assert at least one element matching the text exists. Handles duplicate text and text split across elements. */
function expectTextInTheDocument(text: string | RegExp) {
  const elements = screen.queryAllByText(text);
  expect(elements.length).toBeGreaterThan(0);
}

async function renderAndWait() {
  const result = render(<KeyboardShortcutsProvider><AgencyCommandCenter /></KeyboardShortcutsProvider>);
  await waitFor(() => {
    expectTextInTheDocument(/Agency Command Center/);
  }, { timeout: 5000 });
  return result;
}

// ─── Tests ────────────────────────────

describe('AgencyCommandCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateMetrics.mockResolvedValue(mockMetrics);
  });

  it('renders the dashboard header', async () => {
    await renderAndWait();
    expectTextInTheDocument(/Agency Command Center/);
    expectTextInTheDocument('Real-time overview of your agency operations');
  });

  it('displays MRR revenue metric', async () => {
    await renderAndWait();
    expectTextInTheDocument('MRR');
    expectTextInTheDocument('₹1,50,000');
  });

  it('displays pipeline total value', async () => {
    await renderAndWait();
    expectTextInTheDocument('₹12,00,000');
  });

  it('displays active deals count', async () => {
    await renderAndWait();
    expectTextInTheDocument('Active Deals');
    expectTextInTheDocument('24');
  });

  it('displays total leads count', async () => {
    await renderAndWait();
    expectTextInTheDocument('Total Leads');
    expectTextInTheDocument('50');
  });

  it('displays agent success rate', async () => {
    await renderAndWait();
    expectTextInTheDocument('Agent Success');
    expectTextInTheDocument('85%');
  });

  it('displays total cost in USD', async () => {
    await renderAndWait();
    expectTextInTheDocument('Total Cost');
    expectTextInTheDocument('$50.00');
  });

  it('displays pipeline stage chart section', async () => {
    await renderAndWait();
    // Text may be split across elements or inside emoji prefix
    const allText = document.body.textContent || '';
    expect(allText).toContain('Pipeline by Stage');
  });

  it('displays revenue forecast chart section', async () => {
    await renderAndWait();
    // Text may be split across elements or inside emoji prefix
    const allText = document.body.textContent || '';
    expect(allText).toContain('Revenue Forecast');
  });

  it('displays cost trend chart section', async () => {
    await renderAndWait();
    // Cost Trend text may be split across elements
    const allText = document.body.textContent || '';
    expect(allText).toContain('Cost Trend');
  });

  it('shows error state when metrics fail to load', async () => {
    mockGenerateMetrics.mockRejectedValueOnce(new Error('Failed to load'));
    render(<KeyboardShortcutsProvider><AgencyCommandCenter /></KeyboardShortcutsProvider>);

    await waitFor(() => {
      expectTextInTheDocument('Failed to load');
    }, { timeout: 5000 });
  });

  it('has a refresh button', async () => {
    await renderAndWait();
    expectTextInTheDocument(/Refresh/);
  });

  it('displays learning quality score', async () => {
    await renderAndWait();
    // Quality Score and 78/100 appear in both top cards and Learning card
    const allText = document.body.textContent || '';
    expect(allText).toContain('Quality Score');
    expect(allText).toContain('78/100');
  });

  it('exports CSV with all dashboard metrics when Export CSV button is clicked', async () => {
    await renderAndWait();

    // Click the Export CSV button
    const exportButton = screen.getByText(/Export CSV/);
    fireEvent.click(exportButton);

    // Verify exportToCSV was called
    expect(mockExportToCSV).toHaveBeenCalledTimes(1);

    // Verify the export call structure
    const exportCall = mockExportToCSV.mock.calls[0][0];
    expect(exportCall.headers).toEqual(['Metric', 'Value']);
    expect(exportCall.fileName).toBe('agency-command-center');
    expect(exportCall.rows).toBeInstanceOf(Array);

    // Verify key metrics are included in the export
    const rows = exportCall.rows as string[][];
    const flatValues = rows.map((r) => r.join(' ')).join(' ');
    expect(flatValues).toContain('MRR');
    expect(flatValues).toContain('Total Leads');
    expect(flatValues).toContain('Win Rate');
    expect(flatValues).toContain('Avg Success Rate');
    expect(flatValues).toContain('Quality Score');
  });

  it('has an Export CSV button in the header', async () => {
    await renderAndWait();
    expectTextInTheDocument(/Export CSV/);
  });

  it('shows loading state before data loads', async () => {
    // Create a promise that we control to keep the component in loading state
    let resolveMetrics: (value: typeof mockMetrics) => void;
    mockGenerateMetrics.mockImplementation(() =>
      new Promise((resolve) => {
        resolveMetrics = resolve;
      })
    );

    render(<KeyboardShortcutsProvider><AgencyCommandCenter /></KeyboardShortcutsProvider>);

    // Immediately check for loading state
    expect(screen.queryByText('Loading Agency Command Center...')).toBeInTheDocument();

    // Resolve the promise to complete loading
    await waitFor(() => {
      resolveMetrics!(mockMetrics);
    });

    // Wait for dashboard to appear
    await waitFor(() => {
      expectTextInTheDocument(/Agency Command Center/);
    }, { timeout: 5000 });

    // Loading state should be gone
    expect(screen.queryByText('Loading Agency Command Center...')).not.toBeInTheDocument();
  });

  it('retry button triggers new load attempt', async () => {
    // First load fails
    mockGenerateMetrics.mockRejectedValueOnce(new Error('Network error'));

    render(<KeyboardShortcutsProvider><AgencyCommandCenter /></KeyboardShortcutsProvider>);

    // Wait for error state
    await waitFor(() => {
      expectTextInTheDocument('Network error');
    }, { timeout: 5000 });

    // Verify retry button exists
    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeInTheDocument();

    // Second load succeeds
    mockGenerateMetrics.mockResolvedValueOnce(mockMetrics);

    // Click retry
    fireEvent.click(retryButton);

    // Wait for dashboard to appear (success state)
    await waitFor(() => {
      expectTextInTheDocument(/Agency Command Center/);
    }, { timeout: 5000 });

    // Error should be gone
    expect(screen.queryByText('Network error')).not.toBeInTheDocument();

    // Verify generateDashboardMetrics was called twice (initial + retry)
    expect(mockGenerateMetrics).toHaveBeenCalledTimes(2);
  });

  it('exports PDF via preview modal when Download PDF is clicked', async () => {
    await renderAndWait();

    // Click the Export PDF button to open preview modal
    const exportPDFButton = screen.getByText(/Export PDF/);
    fireEvent.click(exportPDFButton);

    // Wait for the preview modal to appear using data-testid
    await waitFor(() => {
      expect(screen.getByTestId('pdf-preview-modal')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Click the Download PDF button in the modal
    const downloadButton = screen.getByText(/Download PDF/);
    fireEvent.click(downloadButton);

    // Verify exportToPDF was called
    await waitFor(() => {
      expect(mockExportToPDF).toHaveBeenCalledTimes(1);
    }, { timeout: 5000 });

    // Verify the export call structure
    const exportCall = mockExportToPDF.mock.calls[0][0];
    expect(exportCall.title).toBe('Agency Command Center');
    expect(exportCall.showBranding).toBe(true);
  });

  it('opens PDF preview modal when Export PDF button is clicked', async () => {
    await renderAndWait();

    // Click the Export PDF button
    const exportPDFButton = screen.getByText(/Export PDF/);
    fireEvent.click(exportPDFButton);

    // Verify the modal opens using data-testid
    await waitFor(() => {
      expect(screen.getByTestId('pdf-preview-modal')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify Download and Cancel buttons exist
    expect(screen.getByText(/Download PDF/)).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('closes PDF preview modal when Cancel is clicked', async () => {
    await renderAndWait();

    // Open the modal
    const exportPDFButton = screen.getByText(/Export PDF/);
    fireEvent.click(exportPDFButton);

    // Wait for modal to open using data-testid
    await waitFor(() => {
      expect(screen.getByTestId('pdf-preview-modal')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Click Cancel to close the modal
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Verify modal is closed
    await waitFor(() => {
      expect(screen.queryByTestId('pdf-preview-modal')).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('has an Export PDF button in the header', async () => {
    await renderAndWait();
    expectTextInTheDocument(/Export PDF/);
  });

  it('does not export PDF when metrics are null', async () => {
    // Set up to return null metrics
    mockGenerateMetrics.mockResolvedValueOnce(null);

    render(<KeyboardShortcutsProvider><AgencyCommandCenter /></KeyboardShortcutsProvider>);

    // Wait for component to attempt load and show error state
    await waitFor(() => {
      expect(mockGenerateMetrics).toHaveBeenCalled();
    }, { timeout: 5000 });

    // Wait a bit for error state to render
    await waitFor(() => {
      // Verify export button is not rendered when there's no data
      const exportButton = screen.queryByText(/Export PDF/);
      expect(exportButton).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify exportToPDF was NOT called since metrics are null
    expect(mockExportToPDF).not.toHaveBeenCalled();
  });

  it('does not export CSV when metrics are null', async () => {
    // Set up to return null metrics
    mockGenerateMetrics.mockResolvedValueOnce(null);

    render(<KeyboardShortcutsProvider><AgencyCommandCenter /></KeyboardShortcutsProvider>);

    // Wait for component to attempt load and show error state
    await waitFor(() => {
      expect(mockGenerateMetrics).toHaveBeenCalled();
    }, { timeout: 5000 });

    // Wait a bit for error state to render
    await waitFor(() => {
      // Verify export button is not rendered when there's no data
      const exportButton = screen.queryByText(/Export CSV/);
      expect(exportButton).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify exportToCSV was NOT called since metrics are null
    expect(mockExportToCSV).not.toHaveBeenCalled();
  });

  // ─── Keyboard Shortcuts Help Modal Tests ───

  it('opens shortcuts help modal when ? key is pressed', async () => {
    await renderAndWait();

    // Press ? key
    fireEvent.keyDown(document, { key: '?', shiftKey: true });

    // Verify the modal opens using data-testid
    await waitFor(() => {
      expect(screen.getByTestId('shortcuts-help-modal')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify modal content is present in the DOM
    const allText = document.body.textContent || '';
    expect(allText).toContain('Keyboard Shortcuts');
    expect(allText).toContain('Open PDF preview & export');
    expect(allText).toContain('Export as Word document');
    expect(allText).toContain('Export as CSV file');
  });

  it('closes shortcuts help modal when ? key is pressed again (toggle)', async () => {
    await renderAndWait();

    // Open the modal
    fireEvent.keyDown(document, { key: '?', shiftKey: true });

    await waitFor(() => {
      expect(screen.getByTestId('shortcuts-help-modal')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Press ? key again to close
    fireEvent.keyDown(document, { key: '?', shiftKey: true });

    // Verify the modal is closed
    await waitFor(() => {
      expect(screen.queryByTestId('shortcuts-help-modal')).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('closes shortcuts help modal when Escape key is pressed', async () => {
    await renderAndWait();

    // Open the modal
    fireEvent.keyDown(document, { key: '?', shiftKey: true });

    await waitFor(() => {
      expect(screen.getByTestId('shortcuts-help-modal')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Press Escape to close
    fireEvent.keyDown(document, { key: 'Escape' });

    // Verify the modal is closed
    await waitFor(() => {
      expect(screen.queryByTestId('shortcuts-help-modal')).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('closes shortcuts help modal when backdrop is clicked', async () => {
    await renderAndWait();

    // Open the modal
    fireEvent.keyDown(document, { key: '?', shiftKey: true });

    await waitFor(() => {
      expect(screen.getByTestId('shortcuts-help-modal')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Click the backdrop (the modal container's parent which has onClick={onClose})
    const modal = screen.getByTestId('shortcuts-help-modal');
    // The backdrop is the direct parent of the modal content
    const backdrop = modal.closest('[class*="fixed"]');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    // Verify the modal is closed
    await waitFor(() => {
      expect(screen.queryByTestId('shortcuts-help-modal')).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('displays all keyboard shortcuts in the help modal', async () => {
    await renderAndWait();

    // Open the modal
    fireEvent.keyDown(document, { key: '?', shiftKey: true });

    await waitFor(() => {
      expect(screen.getByTestId('shortcuts-help-modal')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify all shortcuts are displayed
    expectTextInTheDocument('Open PDF preview & export');
    expectTextInTheDocument('Export as Word document');
    expectTextInTheDocument('Export as CSV file');
    expectTextInTheDocument('Show this shortcuts panel');
    expectTextInTheDocument('Close modal / panel');

    // Verify kbd elements exist
    expect(screen.getAllByText('Ctrl+P').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ctrl+Shift+W').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ctrl+S').length).toBeGreaterThan(0);
  });

  it('does not open shortcuts help when typing in an input', async () => {
    await renderAndWait();

    // Create an input element and focus it
    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    document.body.appendChild(input);
    input.focus();

    // Press ? key while input is focused
    fireEvent.keyDown(input, { key: '?', shiftKey: true });

    // Verify the modal does NOT open
    await waitFor(() => {
      expect(screen.queryByTestId('shortcuts-help-modal')).not.toBeInTheDocument();
    }, { timeout: 2000 });

    // Cleanup
    document.body.removeChild(input);
  });

  it('does not open shortcuts help when PDF preview is open', async () => {
    await renderAndWait();

    // Open PDF preview modal
    const exportPDFButton = screen.getByText(/Export PDF/);
    fireEvent.click(exportPDFButton);

    await waitFor(() => {
      expect(screen.getByTestId('pdf-preview-modal')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Press ? key while PDF preview is open
    fireEvent.keyDown(document, { key: '?', shiftKey: true });

    // Verify shortcuts help modal does NOT open (no stacking)
    await waitFor(() => {
      expect(screen.queryByTestId('shortcuts-help-modal')).not.toBeInTheDocument();
    }, { timeout: 2000 });

    // PDF preview should still be open
    expect(screen.getByTestId('pdf-preview-modal')).toBeInTheDocument();
  });
});
