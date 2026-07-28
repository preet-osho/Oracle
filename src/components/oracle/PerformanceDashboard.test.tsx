import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GodModeMessageEntry, GodModeToggleEntry, NormalMessageEntry } from '@/lib/god-mode-metrics';
import { MOCK_GOD_MODE_METRICS, MOCK_GOD_MODE_METRICS_DISABLED, MOCK_GOD_MODE_COST_ANALYSIS, MOCK_GOD_MODE_TIMELINE_DATA, MOCK_GOD_MODE_MESSAGES, MOCK_NORMAL_MESSAGES } from './__tests__';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
  AreaChart: () => <div data-testid="area-chart" />,
  Area: () => null,
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

// Hoisted mock references for targeted clearing
const { mockGetAgentPerformance, mockGetTokenBudget, mockGetPerformanceHistory, mockSetBudgetDailyLimit, mockExportToCSV } = vi.hoisted(() => ({
  mockGetAgentPerformance: vi.fn(() => mockPerformance),
  mockGetTokenBudget: vi.fn(() => mockBudget),
  mockGetPerformanceHistory: vi.fn(() => mockHistory),
  mockSetBudgetDailyLimit: vi.fn(),
  mockExportToCSV: vi.fn(),
}));

const mockHistory = [
  { agent: 'researcher', quality: 0.85, latencyMs: 1100, costUsd: 0.01, success: true, timestamp: Date.now() - 86400000 },
  { agent: 'writer', quality: 0.90, latencyMs: 750, costUsd: 0.02, success: true, timestamp: Date.now() - 43200000 },
];

vi.mock('@/lib/model-selector', () => ({
  getAgentPerformance: (...args: unknown[]) => mockGetAgentPerformance(...args as Parameters<typeof mockGetAgentPerformance>),
  getTokenBudget: (...args: unknown[]) => mockGetTokenBudget(...args as Parameters<typeof mockGetTokenBudget>),
  getPerformanceHistory: (...args: unknown[]) => mockGetPerformanceHistory(...args as Parameters<typeof mockGetPerformanceHistory>),
  setBudgetDailyLimit: (...args: unknown[]) => mockSetBudgetDailyLimit(...args as Parameters<typeof mockSetBudgetDailyLimit>),
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

const { mockExportTableToCSV } = vi.hoisted(() => ({
  mockExportTableToCSV: vi.fn(),
}));

vi.mock('@/lib/export-utils', () => ({
  exportToCSV: (...args: unknown[]) => mockExportToCSV(...args),
  exportTableToCSV: (...args: unknown[]) => mockExportTableToCSV(...args),
}));

// ── Mock html2canvas & jsPDF for chart export tests ──
const { mockHtml2canvas, mockCanvas, mockPdfSave, mockPdfText, mockPdfLine, mockPdfAddImage, mockPdfSetFontSize, mockPdfSetFont, mockPdfSetTextColor, mockPdfSetDrawColor, mockPdfSetLineWidth, mockPdfGetWidth, mockPdfGetHeight, mockToBlob, mockToDataURL, MockJsPdfConstructor } = vi.hoisted(() => {
  const mockToBlob = vi.fn((cb: (blob: Blob | null) => void) => {
    cb(new Blob(['fake-png'], { type: 'image/png' }));
  });
  const mockToDataURL = vi.fn(() => 'data:image/png;base64,fakebase64');
  const mockCanvas = { toBlob: mockToBlob, toDataURL: mockToDataURL, width: 800, height: 400 };
  const mockHtml2canvas = vi.fn(() => Promise.resolve(mockCanvas));
  const mockPdfSave = vi.fn();
  const mockPdfText = vi.fn();
  const mockPdfLine = vi.fn();
  const mockPdfAddImage = vi.fn();
  const mockPdfSetFontSize = vi.fn();
  const mockPdfSetFont = vi.fn();
  const mockPdfSetTextColor = vi.fn();
  const mockPdfSetDrawColor = vi.fn();
  const mockPdfSetLineWidth = vi.fn();
  const mockPdfGetWidth = vi.fn(() => 297);
  const mockPdfGetHeight = vi.fn(() => 210);
  const MockJsPdfConstructor = vi.fn(function () {
    return {
      save: mockPdfSave,
      text: mockPdfText,
      line: mockPdfLine,
      addImage: mockPdfAddImage,
      setFontSize: mockPdfSetFontSize,
      setFont: mockPdfSetFont,
      setTextColor: mockPdfSetTextColor,
      setDrawColor: mockPdfSetDrawColor,
      setLineWidth: mockPdfSetLineWidth,
      internal: {
        pageSize: {
          getWidth: mockPdfGetWidth,
          getHeight: mockPdfGetHeight,
        },
      },
    };
  });
  return { mockHtml2canvas, mockCanvas, mockPdfSave, mockPdfText, mockPdfLine, mockPdfAddImage, mockPdfSetFontSize, mockPdfSetFont, mockPdfSetTextColor, mockPdfSetDrawColor, mockPdfSetLineWidth, mockPdfGetWidth, mockPdfGetHeight, mockToBlob, mockToDataURL, MockJsPdfConstructor };
});

vi.mock('html2canvas', () => ({
  default: mockHtml2canvas,
}));

vi.mock('jspdf', () => ({
  default: MockJsPdfConstructor,
}));

const mockDownloadBlob = vi.fn();
vi.mock('@/lib/download-blob', () => ({
  downloadBlob: (...args: unknown[]) => mockDownloadBlob(...args),
}));

// ── Mock GOD MODE metrics so the Analytics section renders ──
const mockGodModeMetrics = MOCK_GOD_MODE_METRICS;
const mockGodModeCostAnalysis = MOCK_GOD_MODE_COST_ANALYSIS;
const { mockGetGodModeMetrics, mockClearGodModeMetrics, mockGetGodModeMessageHistory, mockGetGodModeToggleHistory, mockGetGodModeCostAnalysis, mockGetNormalMessageHistory, mockGetGodModeTimelineData } = vi.hoisted(() => ({
  mockGetGodModeMetrics: vi.fn(() => mockGodModeMetrics),
  mockClearGodModeMetrics: vi.fn(),
  mockGetGodModeMessageHistory: vi.fn((): GodModeMessageEntry[] => []),
  mockGetGodModeToggleHistory: vi.fn((): GodModeToggleEntry[] => []),
  mockGetGodModeCostAnalysis: vi.fn(() => mockGodModeCostAnalysis),
  mockGetNormalMessageHistory: vi.fn((): NormalMessageEntry[] => []),
  mockGetGodModeTimelineData: vi.fn(() => [
    { date: '07/20', godModeTokens: 8000, normalTokens: 4000, godModeMessages: 2, normalMessages: 3 },
    { date: '07/21', godModeTokens: 12000, normalTokens: 6000, godModeMessages: 3, normalMessages: 4 },
  ]),
}));

vi.mock('@/lib/god-mode-metrics', () => ({
  getGodModeMetrics: (...args: unknown[]) => mockGetGodModeMetrics(...args as Parameters<typeof mockGetGodModeMetrics>),
  clearGodModeMetrics: (...args: unknown[]) => mockClearGodModeMetrics(...args as Parameters<typeof mockClearGodModeMetrics>),
  getGodModeMessageHistory: (...args: unknown[]) => mockGetGodModeMessageHistory(...args as Parameters<typeof mockGetGodModeMessageHistory>),
  getGodModeToggleHistory: (...args: unknown[]) => mockGetGodModeToggleHistory(...args as Parameters<typeof mockGetGodModeToggleHistory>),
  getGodModeCostAnalysis: (...args: unknown[]) => mockGetGodModeCostAnalysis(...args as Parameters<typeof mockGetGodModeCostAnalysis>),
  getNormalMessageHistory: (...args: unknown[]) => mockGetNormalMessageHistory(...args as Parameters<typeof mockGetNormalMessageHistory>),
  getGodModeTimelineData: (...args: unknown[]) => mockGetGodModeTimelineData(...args as Parameters<typeof mockGetGodModeTimelineData>),
  QUALITY_BUCKET_COLORS: ['#ef4444', '#f59e0b', '#10b981', '#06b6d4'],
  QUALITY_BUCKET_LABELS: ['0-25%', '25-50%', '50-75%', '75-100%'],
  QUALITY_BUCKET_RANGES: [[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1.01]],
}));

// ─── Tests ─────────────────────────────

describe('PerformanceDashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetAgentPerformance.mockClear();
    mockGetTokenBudget.mockClear();
    mockGetPerformanceHistory.mockClear();
    mockSetBudgetDailyLimit.mockClear();
    mockExportToCSV.mockClear();
    mockGetGodModeMetrics.mockClear();
    mockClearGodModeMetrics.mockClear();
    mockGetGodModeMessageHistory.mockClear();
    mockGetGodModeToggleHistory.mockClear();
    mockGetGodModeCostAnalysis.mockClear();
    mockGetNormalMessageHistory.mockClear();
    mockGetGodModeTimelineData.mockClear();
    mockHtml2canvas.mockClear();
    mockDownloadBlob.mockClear();
    mockPdfSave.mockClear();
    mockPdfText.mockClear();
    mockPdfAddImage.mockClear();
    // Restore default return values after clear
    mockGetAgentPerformance.mockReturnValue(mockPerformance);
    mockGetTokenBudget.mockReturnValue(mockBudget);
    mockGetPerformanceHistory.mockReturnValue(mockHistory);
    // Default: GOD MODE section hidden (totalToggles: 0) to avoid fragile duplicate-text issues
    mockGetGodModeMetrics.mockReturnValue({ ...mockGodModeMetrics, totalToggles: 0 });
    mockGetGodModeCostAnalysis.mockReturnValue(mockGodModeCostAnalysis);
    mockGetGodModeTimelineData.mockReturnValue([
      { date: '07/20', godModeTokens: 8000, normalTokens: 4000, godModeMessages: 2, normalMessages: 3 },
      { date: '07/21', godModeTokens: 12000, normalTokens: 6000, godModeMessages: 3, normalMessages: 4 },
    ]);
    mockHtml2canvas.mockResolvedValue(mockCanvas);
    mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
      cb(new Blob(['fake-png'], { type: 'image/png' }));
    });
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
    // GOD MODE section is hidden by default (totalToggles: 0), so these are unique
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

  it('shows empty state when no performance data', () => {
    mockGetAgentPerformance.mockReturnValue([]);
    render(<PerformanceDashboard />);
    expect(screen.getByText(/No Performance Data/)).toBeTruthy();
  });

  // ── Export ──

  it('calls exportToCSV on export click', async () => {
    render(<PerformanceDashboard />);
    const exportBtn = screen.getByText(/📥 Export CSV/).closest('button')!;
    fireEvent.click(exportBtn);
    await waitFor(() => {
      expect(mockExportToCSV).toHaveBeenCalled();
    });
  });

  // ── GOD MODE Chart Export Handlers ──

  describe('GOD MODE Chart Export', () => {
    beforeEach(() => {
      // Enable GOD MODE section for export tests
      mockGetGodModeMetrics.mockReturnValue(mockGodModeMetrics);
      mockGetGodModeCostAnalysis.mockReturnValue(mockGodModeCostAnalysis);
      mockGetGodModeTimelineData.mockReturnValue([
        { date: '07/20', godModeTokens: 8000, normalTokens: 4000, godModeMessages: 2, normalMessages: 3 },
        { date: '07/21', godModeTokens: 12000, normalTokens: 6000, godModeMessages: 3, normalMessages: 4 },
      ]);
      mockToBlob.mockClear();
      mockToDataURL.mockClear();
      mockPdfText.mockClear();
      mockPdfAddImage.mockClear();
      mockPdfSetFont.mockClear();
      mockPdfSetFontSize.mockClear();
      mockPdfSetTextColor.mockClear();
      mockPdfSetDrawColor.mockClear();
      mockPdfSetLineWidth.mockClear();
      mockPdfLine.mockClear();
    });

    it('renders PNG and PDF export buttons', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      expect(screen.getByText(/🖼️ PNG/)).toBeTruthy();
      expect(screen.getByText(/📄 PDF/)).toBeTruthy();
    });

    it('calls html2canvas when PNG export is clicked', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const pngBtn = screen.getByText(/🖼️ PNG/).closest('button')!;
      fireEvent.click(pngBtn);
      await waitFor(() => {
        expect(mockHtml2canvas).toHaveBeenCalled();
      });
    });

    it('calls downloadBlob after PNG export succeeds', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const pngBtn = screen.getByText(/🖼️ PNG/).closest('button')!;
      fireEvent.click(pngBtn);
      await waitFor(() => {
        expect(mockDownloadBlob).toHaveBeenCalledWith(
          expect.any(Blob),
          expect.stringContaining('god-mode-comparison-'),
          'image/png',
        );
      });
    });

    it('calls html2canvas when PDF export is clicked', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const pdfBtn = screen.getByText(/📄 PDF/).closest('button')!;
      fireEvent.click(pdfBtn);
      await waitFor(() => {
        expect(mockHtml2canvas).toHaveBeenCalled();
      });
    });

    it('creates and saves PDF after PDF export succeeds', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const pdfBtn = screen.getByText(/📄 PDF/).closest('button')!;
      fireEvent.click(pdfBtn);
      await waitFor(() => {
        expect(mockPdfSave).toHaveBeenCalledWith(
          expect.stringContaining('god-mode-report-'),
        );
      });
    });

    it('includes ORACLE branding in PDF', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const pdfBtn = screen.getByText(/📄 PDF/).closest('button')!;
      fireEvent.click(pdfBtn);
      await waitFor(() => {
        expect(mockPdfText).toHaveBeenCalledWith('ORACLE', 15, 15);
        expect(mockPdfText).toHaveBeenCalledWith('GOD MODE Usage Report', 15, 32);
      });
    });

    it('shows loading state while exporting', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      // Make html2canvas take a while
      let resolveCanvas: (v: typeof mockCanvas) => void;
      mockHtml2canvas.mockReturnValue(new Promise((r) => { resolveCanvas = r; }));
      render(<PerformanceDashboard />);
      const pngBtn = screen.getByText(/🖼️ PNG/).closest('button')!;
      fireEvent.click(pngBtn);
      await waitFor(() => {
        expect(pngBtn).toBeDisabled();
      });
      // Resolve to clean up
      resolveCanvas!(mockCanvas);
    });

    it('re-enables export buttons after export completes', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const pngBtn = screen.getByText(/🖼️ PNG/).closest('button')!;
      fireEvent.click(pngBtn);
      await waitFor(() => {
        expect(pngBtn).not.toBeDisabled();
      });
    });

    it('handles html2canvas failure gracefully', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      mockHtml2canvas.mockRejectedValue(new Error('canvas failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<PerformanceDashboard />);
      const pngBtn = screen.getByText(/🖼️ PNG/).closest('button')!;
      fireEvent.click(pngBtn);
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Chart export failed:', expect.any(Error));
      });
      consoleSpy.mockRestore();
    });

    // ── JSON Export ──

    it('renders JSON export button', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      expect(screen.getByText(/📥 JSON/)).toBeTruthy();
    });

    it('calls downloadBlob with JSON data when JSON export is clicked', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const jsonBtn = screen.getByText(/📥 JSON/).closest('button')!;
      fireEvent.click(jsonBtn);
      await waitFor(() => {
        expect(mockDownloadBlob).toHaveBeenCalledTimes(1);
        const [data, filename, mimeType] = mockDownloadBlob.mock.calls[0];
        expect(typeof data).toBe('string');
        const parsed = JSON.parse(data);
        expect(parsed).toHaveProperty('summary');
        expect(parsed).toHaveProperty('costAnalysis');
        expect(parsed).toHaveProperty('godModeMessages');
        expect(parsed).toHaveProperty('normalMessages');
        expect(filename).toMatch(/^god-mode-metrics-.*\.json$/);
        expect(mimeType).toBe('application/json');
      });
    });

    it('includes GOD MODE metrics summary in JSON export', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const jsonBtn = screen.getByText(/📥 JSON/).closest('button')!;
      fireEvent.click(jsonBtn);
      await waitFor(() => {
        expect(mockDownloadBlob).toHaveBeenCalledTimes(1);
        const parsed = JSON.parse(mockDownloadBlob.mock.calls[0][0]);
        expect(parsed.summary.totalToggles).toBe(5);
        expect(parsed.summary.totalMessages).toBe(12);
        expect(parsed.costAnalysis.overheadPercent).toBe(60);
      });
    });

    // ── CSV Export ──

    it('renders CSV export button', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      expect(screen.getByText(/📥 CSV/)).toBeTruthy();
    });

    it('calls exportTableToCSV for GOD MODE messages when CSV export is clicked', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      mockGetGodModeMessageHistory.mockReturnValue([MOCK_GOD_MODE_MESSAGES[0]]);
      mockGetNormalMessageHistory.mockReturnValue([]);
      mockExportTableToCSV.mockClear();
      render(<PerformanceDashboard />);
      const csvBtn = screen.getByText(/📥 CSV/).closest('button')!;
      fireEvent.click(csvBtn);
      await waitFor(() => {
        expect(mockExportTableToCSV).toHaveBeenCalledTimes(1);
        expect(mockGetGodModeMessageHistory).toHaveBeenCalled();
      });
    });

    it('calls exportTableToCSV for both GOD MODE and normal messages', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      mockGetGodModeMessageHistory.mockReturnValue([MOCK_GOD_MODE_MESSAGES[0]]);
      mockGetNormalMessageHistory.mockReturnValue([MOCK_NORMAL_MESSAGES[0]]);
      mockExportTableToCSV.mockClear();
      render(<PerformanceDashboard />);
      const csvBtn = screen.getByText(/📥 CSV/).closest('button')!;
      fireEvent.click(csvBtn);
      await waitFor(() => {
        expect(mockExportTableToCSV).toHaveBeenCalledTimes(2);
        expect(mockGetGodModeMessageHistory).toHaveBeenCalled();
        expect(mockGetNormalMessageHistory).toHaveBeenCalled();
      });
    });

    it('skips CSV export when no message history exists', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      mockGetGodModeMessageHistory.mockReturnValue([]);
      mockGetNormalMessageHistory.mockReturnValue([]);
      mockExportTableToCSV.mockClear();
      render(<PerformanceDashboard />);
      const csvBtn = screen.getByText(/📥 CSV/).closest('button')!;
      fireEvent.click(csvBtn);
      await waitFor(() => {
        expect(mockGetGodModeMessageHistory).toHaveBeenCalled();
        expect(mockGetNormalMessageHistory).toHaveBeenCalled();
        expect(mockExportTableToCSV).not.toHaveBeenCalled();
      });
    });

    // ── Agent & Provider Breakdown ──

    it('displays agent breakdown when agentBreakdown has data', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      expect(screen.getByText('Agent Usage')).toBeTruthy();
      expect(screen.getAllByText('researcher').length).toBeGreaterThanOrEqual(1);
      // '8 msgs' and '7 ok' appear in both agent and provider breakdowns
      expect(screen.getAllByText('8 msgs').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('7 ok').length).toBeGreaterThanOrEqual(1);
    });

    it('displays provider breakdown when providerBreakdown has data', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      expect(screen.getByText('Provider Usage')).toBeTruthy();
      expect(screen.getAllByText('openai').length).toBeGreaterThanOrEqual(1);
    });

    it('hides breakdown sections when breakdowns are empty', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      mockGetGodModeMetrics.mockReturnValue({ ...MOCK_GOD_MODE_METRICS, agentBreakdown: {}, providerBreakdown: {} });
      render(<PerformanceDashboard />);
      expect(screen.queryByText('Agent Usage')).toBeNull();
      expect(screen.queryByText('Provider Usage')).toBeNull();
    });

    // ── Per-Agent & Per-Provider Distribution Visibility ──

    it('renders per-agent quality distribution when agentQualityDistribution has data', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      expect(screen.getByText(/Per-Agent Distribution/)).toBeTruthy();
      expect(screen.getAllByText('researcher').length).toBeGreaterThanOrEqual(1);
    });

    it('hides per-agent quality distribution when agentQualityDistribution is empty', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      mockGetGodModeMetrics.mockReturnValue({
        ...MOCK_GOD_MODE_METRICS,
        agentQualityDistribution: {} as unknown as typeof MOCK_GOD_MODE_METRICS.agentQualityDistribution,
      });
      render(<PerformanceDashboard />);
      expect(screen.queryByText(/Per-Agent Distribution/)).toBeNull();
    });

    it('renders per-provider quality distribution when providerQualityDistribution has data', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      expect(screen.getByText(/Per-Provider Distribution/)).toBeTruthy();
      expect(screen.getAllByText('openai').length).toBeGreaterThanOrEqual(1);
    });

    it('hides per-provider quality distribution when providerQualityDistribution is empty', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      mockGetGodModeMetrics.mockReturnValue({
        ...MOCK_GOD_MODE_METRICS,
        providerQualityDistribution: {} as unknown as typeof MOCK_GOD_MODE_METRICS.providerQualityDistribution,
      });
      render(<PerformanceDashboard />);
      expect(screen.queryByText(/Per-Provider Distribution/)).toBeNull();
    });

    it('renders per-agent distribution bucket counts (researcher: 50-75%=1, 75-100%=1)', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const agentSection = screen.getByText(/Per-Agent Distribution/).closest('div.mt-4')! as HTMLElement;
      // researcher total count = 2 (0+0+1+1)
      expect(agentSection.textContent).toContain('2');
      // Individual bucket counts: 50-75% has count 1, 75-100% has count 1
      // Use within() scoped to section + data-testid for robust, non-fragile assertion
      const bucketCounts = within(agentSection).getAllByTestId('bucket-count');
      // researcher has 2 non-zero buckets (50-75% and 75-100%), each renders a bucket-count span
      expect(bucketCounts.length).toBe(2);
      expect(bucketCounts[0]).toHaveTextContent('1');
      expect(bucketCounts[1]).toHaveTextContent('1');
    });

    it('renders per-provider distribution bucket counts (openai: 50-75%=1, anthropic: 75-100%=1)', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const providerSection = screen.getByText(/Per-Provider Distribution/).closest('div.mt-4')! as HTMLElement;
      expect(providerSection.textContent).toContain('openai');
      expect(providerSection.textContent).toContain('anthropic');
      // openai total=1 (0+0+1+0), anthropic total=1 (0+0+0+1)
      // Individual bucket counts: openai has count 1 in 50-75%, anthropic has count 1 in 75-100%
      // Use within() scoped to section + data-testid for robust, non-fragile assertion
      const bucketCounts = within(providerSection).getAllByTestId('bucket-count');
      // openai has 1 non-zero bucket (50-75%), anthropic has 1 non-zero bucket (75-100%)
      expect(bucketCounts.length).toBe(2);
      expect(bucketCounts[0]).toHaveTextContent('1');
      expect(bucketCounts[1]).toHaveTextContent('1');
    });

    it('has role=figure and aria-labelledby on QualityDistributionBreakdown containers', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      // The per-agent and per-provider distribution sections should have role=figure and aria-labelledby
      const agentFigure = screen.getByText(/Per-Agent Distribution/).closest('[role="figure"]');
      const providerFigure = screen.getByText(/Per-Provider Distribution/).closest('[role="figure"]');
      expect(agentFigure).not.toBeNull();
      expect(providerFigure).not.toBeNull();
      // Verify aria-labelledby points to a valid heading
      const agentAriaLabelledBy = agentFigure!.getAttribute('aria-labelledby');
      const providerAriaLabelledBy = providerFigure!.getAttribute('aria-labelledby');
      expect(agentAriaLabelledBy).toBeTruthy();
      expect(providerAriaLabelledBy).toBeTruthy();
      // Verify the referenced heading elements exist
      const agentHeading = document.getElementById(agentAriaLabelledBy!);
      const providerHeading = document.getElementById(providerAriaLabelledBy!);
      expect(agentHeading).not.toBeNull();
      expect(providerHeading).not.toBeNull();
      expect(agentHeading!.textContent).toContain('Per-Agent Distribution');
      expect(providerHeading!.textContent).toContain('Per-Provider Distribution');
    });

    it('has proper ARIA attributes on the quality trend sparkline SVG', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      // The sparkline SVG should have role=img, aria-label, aria-roledescription, and a <title>
      const sparkline = document.querySelector('svg[aria-roledescription="sparkline chart"]');
      expect(sparkline).not.toBeNull();
      expect(sparkline!.getAttribute('role')).toBe('img');
      expect(sparkline!.getAttribute('aria-label')).toContain('Quality trend');
      expect(sparkline!.getAttribute('aria-label')).toContain('current');
      // Should have a <title> element for screen readers
      const title = sparkline!.querySelector('title');
      expect(title).not.toBeNull();
      expect(title!.textContent).toContain('Quality trend sparkline');
      // Polyline and circle should be aria-hidden
      const polyline = sparkline!.querySelector('polyline');
      const circle = sparkline!.querySelector('circle');
      expect(polyline!.getAttribute('aria-hidden')).toBe('true');
      expect(circle!.getAttribute('aria-hidden')).toBe('true');
    });

    it('renders histogram qualityDistribution bucket counts (50-75%=1, 75-100%=1, total=2)', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      // Scope to the histogram section using its heading text
      const histogramSection = screen.getByText(/Quality Distribution/).closest('div.mt-4')! as HTMLElement;
      // qualityDistribution: [0-25%=0, 25-50%=0, 50-75%=1, 75-100%=1] → total = 2
      expect(histogramSection.textContent).toContain('2');
      // Verify range labels are rendered
      expect(histogramSection.textContent).toContain('50-75%');
      expect(histogramSection.textContent).toContain('75-100%');
      // Verify non-zero bucket count values are rendered using within() for scoped queries
      const ones = within(histogramSection).getAllByText('1', { exact: true });
      expect(ones.length).toBe(2);
    });

    it('renders zero-count histogram buckets (0-25%, 25-50%) with count 0 spans even when count is 0', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const histogramSection = screen.getByText(/Quality Distribution/).closest('div.mt-4')! as HTMLElement;
      // Verify zero-count bucket labels are present
      expect(histogramSection.textContent).toContain('0-25%');
      expect(histogramSection.textContent).toContain('25-50%');
      // Verify zero-count bucket count spans render '0' — these should exist even though count is 0
      const histogramCounts = within(histogramSection).getAllByTestId('histogram-bucket-count');
      // Verify all 4 histogram bucket count spans are rendered (including zero-count)
      expect(histogramCounts.length).toBe(4);
      const zeros = histogramCounts.filter((el) => el.textContent === '0');
      // qualityDistribution has 2 zero-count buckets (0-25% and 25-50%), each renders a '0' span
      expect(zeros.length).toBe(2);
    });

    it('hides histogram section when qualityDistribution has all zero counts', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      mockGetGodModeMetrics.mockReturnValue({
        ...MOCK_GOD_MODE_METRICS,
        qualityDistribution: [
          { range: '0-25%', count: 0 },
          { range: '25-50%', count: 0 },
          { range: '50-75%', count: 0 },
          { range: '75-100%', count: 0 },
        ],
      });
      render(<PerformanceDashboard />);
      // The histogram section should not be rendered when all counts are 0
      expect(screen.queryByText(/Quality Distribution/)).not.toBeInTheDocument();
      // No histogram bucket count spans should exist
      const histogramCounts = screen.queryAllByTestId('histogram-bucket-count');
      expect(histogramCounts.length).toBe(0);
    });

    it('renders histogram bars with correct height percentages based on maxCount scaling', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const histogramSection = screen.getByText(/Quality Distribution/).closest('div.mt-4')! as HTMLElement;
      // qualityDistribution: [0-25%=0, 25-50%=0, 50-75%=1, 75-100%=1] → maxCount = 1
      const bars = within(histogramSection).getAllByTestId('histogram-bar');
      // Should render 4 bars (one per bucket)
      expect(bars.length).toBe(4);
      // Zero-count bars should have height 0%
      expect(bars[0]).toHaveStyle({ height: '0%' });
      expect(bars[1]).toHaveStyle({ height: '0%' });
      // Non-zero-count bars should have height 100% (count=1 / maxCount=1 * 100)
      expect(bars[2]).toHaveStyle({ height: '100%' });
      expect(bars[3]).toHaveStyle({ height: '100%' });
    });

    it('renders histogram bars with correct scaled heights for varying counts', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      mockGetGodModeMetrics.mockReturnValue({
        ...MOCK_GOD_MODE_METRICS,
        qualityDistribution: [
          { range: '0-25%', count: 1 },
          { range: '25-50%', count: 2 },
          { range: '50-75%', count: 3 },
          { range: '75-100%', count: 4 },
        ],
      });
      render(<PerformanceDashboard />);
      const histogramSection = screen.getByText(/Quality Distribution/).closest('div.mt-4')! as HTMLElement;
      // maxCount = 4
      const bars = within(histogramSection).getAllByTestId('histogram-bar');
      expect(bars.length).toBe(4);
      // height = (count / maxCount) * 100
      expect(bars[0]).toHaveStyle({ height: '25%' });  // 1/4 * 100
      expect(bars[1]).toHaveStyle({ height: '50%' });  // 2/4 * 100
      expect(bars[2]).toHaveStyle({ height: '75%' });  // 3/4 * 100
      expect(bars[3]).toHaveStyle({ height: '100%' }); // 4/4 * 100
    });

    it('renders histogram bar at 100% when only one bucket has a non-zero count', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      mockGetGodModeMetrics.mockReturnValue({
        ...MOCK_GOD_MODE_METRICS,
        qualityDistribution: [
          { range: '0-25%', count: 0 },
          { range: '25-50%', count: 5 },
          { range: '50-75%', count: 0 },
          { range: '75-100%', count: 0 },
        ],
      });
      render(<PerformanceDashboard />);
      const histogramSection = screen.getByText(/Quality Distribution/).closest('div.mt-4')! as HTMLElement;
      // maxCount = 5 (only one non-zero bucket)
      const bars = within(histogramSection).getAllByTestId('histogram-bar');
      expect(bars.length).toBe(4);
      // The single non-zero bucket should render at 100% (5/5 * 100)
      expect(bars[0]).toHaveStyle({ height: '0%' });
      expect(bars[1]).toHaveStyle({ height: '100%' });
      expect(bars[2]).toHaveStyle({ height: '0%' });
      expect(bars[3]).toHaveStyle({ height: '0%' });
    });

    it('renders histogram bars with correct QUALITY_BUCKET_COLORS for each bucket index', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const histogramSection = screen.getByText(/Quality Distribution/).closest('div.mt-4')! as HTMLElement;
      // QUALITY_BUCKET_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4']
      const bars = within(histogramSection).getAllByTestId('histogram-bar');
      expect(bars.length).toBe(4);
      // Each bar should use the color at its bucket index
      expect(bars[0]).toHaveStyle({ backgroundColor: '#ef4444' });
      expect(bars[1]).toHaveStyle({ backgroundColor: '#f59e0b' });
      expect(bars[2]).toHaveStyle({ backgroundColor: '#10b981' });
      expect(bars[3]).toHaveStyle({ backgroundColor: '#06b6d4' });
    });

    it('renders histogram bars with transition CSS class for smooth height animations', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const histogramSection = screen.getByText(/Quality Distribution/).closest('div.mt-4')! as HTMLElement;
      const bars = within(histogramSection).getAllByTestId('histogram-bar');
      expect(bars.length).toBe(4);
      // All bars should have the transition-all and duration-300 classes
      bars.forEach((bar) => {
        expect(bar.className).toContain('transition-all');
        expect(bar.className).toContain('duration-300');
      });
    });

    it('renders histogram buckets with equal width (flex-1) for even distribution', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const histogramSection = screen.getByText(/Quality Distribution/).closest('div.mt-4')! as HTMLElement;
      // The histogram uses a flex container with each bucket wrapper having flex-1
      const bars = within(histogramSection).getAllByTestId('histogram-bar');
      expect(bars.length).toBe(4);
      // Each bar's parent container should have flex-1 for equal width distribution
      bars.forEach((bar) => {
        const bucketContainer = bar.closest('.flex-1');
        expect(bucketContainer).not.toBeNull();
        expect(bucketContainer!.className).toContain('flex-1');
      });
    });

    it('has proper ARIA labels and screen reader support for quality distribution histogram', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const histogramSection = screen.getByText(/Quality Distribution/).closest('div.mt-4')! as HTMLElement;
      // The histogram container should have role="figure" and an aria-label
      const histogramFigure = within(histogramSection).getByRole('figure');
      expect(histogramFigure).toHaveAttribute('aria-labelledby', 'quality-distribution-heading');
      // Each bar should have role="img" and an aria-label describing its bucket
      const bars = within(histogramSection).getAllByRole('img');
      expect(bars.length).toBe(4);
      // Verify specific aria-labels for the non-zero buckets
      const ariaLabels = bars.map((bar) => bar.getAttribute('aria-label'));
      expect(ariaLabels).toContain('50-75%: 1 score');
      expect(ariaLabels).toContain('75-100%: 1 score');
      // Zero-count buckets should have plural-safe labels
      expect(ariaLabels).toContain('0-25%: 0 scores');
      expect(ariaLabels).toContain('25-50%: 0 scores');
    });

    it('calls clearGodModeMetrics when Clear button is clicked and user confirms', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<PerformanceDashboard />);
      const clearBtn = screen.getByText(/🗑️ Clear/).closest('button')!;
      fireEvent.click(clearBtn);
      await waitFor(() => {
        expect(mockClearGodModeMetrics).toHaveBeenCalledTimes(1);
      });
      vi.mocked(window.confirm).mockRestore();
    });

    it('does not call clearGodModeMetrics when user cancels the dialog', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<PerformanceDashboard />);
      const clearBtn = screen.getByText(/🗑️ Clear/).closest('button')!;
      fireEvent.click(clearBtn);
      await waitFor(() => {
        expect(mockClearGodModeMetrics).not.toHaveBeenCalled();
      });
      vi.mocked(window.confirm).mockRestore();
    });

    // ── qualityScore Display ──

    it('displays quality score in agent breakdown when avgQuality > 0', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      // agentBreakdown has avgQuality: 0.88 → rendered as q:88% (appears in both agent and provider sections)
      expect(screen.getAllByText(/q:88%/).length).toBeGreaterThanOrEqual(1);
    });

    it('hides quality score in agent breakdown when avgQuality is 0', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      mockGetGodModeMetrics.mockReturnValue({
        ...MOCK_GOD_MODE_METRICS,
        agentBreakdown: {
          researcher: { count: 8, successCount: 7, totalTokens: 32000, avgQuality: 0 },
        },
        providerBreakdown: {
          openai: { count: 8, successCount: 7, totalTokens: 32000, avgQuality: 0 },
        },
      });
      render(<PerformanceDashboard />);
      expect(screen.queryByText(/q:/)).toBeNull();
    });

    // ── Success Rate Progress Bar Width ──

    it('success rate progress bar width matches calculated success rate', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      // successfulMessages: 10, totalMessages: 12 → 83.3%
      const expectedPercent = Math.round((10 / 12) * 100);
      const successRateBar = screen.getByRole('progressbar', { name: /GOD MODE success rate/i });
      // Verify aria-valuenow matches calculated rate
      expect(successRateBar).toHaveAttribute('aria-valuenow', String(expectedPercent));
      // Verify the displayed text matches
      expect(screen.getByText('83.3%')).toBeTruthy();
    });

    // ── Integration: Ref Wrapper Captures Both Charts ──

    it('ref wrapper div contains both token comparison and message count charts', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);

      // Both chart headers should be rendered (GOD MODE section is visible)
      const tokenChartHeader = screen.getByText('⚡ GOD MODE vs Normal Usage');
      const messageChartHeader = screen.getByText('📊 Message Count Over Time');
      expect(tokenChartHeader).toBeTruthy();
      expect(messageChartHeader).toBeTruthy();

      // Find the ref div via data-testid
      const refDiv = document.querySelector('[data-testid="god-mode-charts-wrapper"]');
      expect(refDiv).toBeTruthy();
      // Both charts should be inside the same ref div
      expect(refDiv!.contains(tokenChartHeader)).toBe(true);
      expect(refDiv!.contains(messageChartHeader)).toBe(true);
    });

    it('ref wrapper div is captured by html2canvas on PNG export', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const pngBtn = screen.getByText(/🖼️ PNG/).closest('button')!;
      fireEvent.click(pngBtn);
      await waitFor(() => {
        // html2canvas should be called with the ref div element
        expect(mockHtml2canvas).toHaveBeenCalledTimes(1);
        const calls = mockHtml2canvas.mock.calls as unknown as [HTMLElement, unknown][];
        const capturedElement = calls[0]?.[0];
        expect(capturedElement).toBeTruthy();
        // The captured element should contain both chart headers
        expect(capturedElement!.textContent).toContain('GOD MODE vs Normal');
        expect(capturedElement!.textContent).toContain('Message Count');
      });
    });

    // ── GOD MODE Section Visibility ──

    it('renders GOD MODE Analytics section when totalToggles > 0', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      expect(screen.getByTestId('god-mode-analytics')).toBeTruthy();
      expect(screen.getByText('⚡ GOD MODE Analytics')).toBeTruthy();
    });

    it('hides GOD MODE Analytics section when totalToggles is 0', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      mockGetGodModeMetrics.mockReturnValue(MOCK_GOD_MODE_METRICS_DISABLED);
      render(<PerformanceDashboard />);
      expect(screen.queryByTestId('god-mode-analytics')).toBeNull();
    });

    // ── Chart View Mode Toggle ──

    it('defaults to token view and shows token toggle button as active', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      // Default is 'tokens' view
      const tokensBtn = screen.getByText('🪙 Tokens').closest('button')!;
      const costBtn = screen.getByText('💰 Cost').closest('button')!;
      // Tokens button should have the active style class
      expect(tokensBtn.className).toContain('bg-[var(--oracle-primary)]/10');
      // Cost button should not have the active style class
      expect(costBtn.className).not.toContain('bg-[var(--oracle-primary)]/10');
    });

    it('switches to cost view when Cost button is clicked', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const costBtn = screen.getByText('💰 Cost').closest('button')!;
      const tokensBtn = screen.getByText('🪙 Tokens').closest('button')!;
      // Click cost button
      fireEvent.click(costBtn);
      await waitFor(() => {
        // Cost button should now have the active style class
        expect(costBtn.className).toContain('bg-[var(--oracle-primary)]/10');
        // Tokens button should no longer have the active style class
        expect(tokensBtn.className).not.toContain('bg-[var(--oracle-primary)]/10');
      });
    });

    it('switches back to token view when Tokens button is clicked', async () => {
      mockGetAgentPerformance.mockReturnValue([]);
      render(<PerformanceDashboard />);
      const tokensBtn = screen.getByText('🪙 Tokens').closest('button')!;
      const costBtn = screen.getByText('💰 Cost').closest('button')!;
      // Switch to cost first
      fireEvent.click(costBtn);
      await waitFor(() => {
        expect(costBtn.className).toContain('bg-[var(--oracle-primary)]/10');
      });
      // Switch back to tokens
      fireEvent.click(tokensBtn);
      await waitFor(() => {
        expect(tokensBtn.className).toContain('bg-[var(--oracle-primary)]/10');
        expect(costBtn.className).not.toContain('bg-[var(--oracle-primary)]/10');
      });
    });
  });
});
