import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CostDashboard from './CostDashboard';

// ─── Mocks (framer-motion & design-tokens are mocked in test-setup.ts) ──

const mockFetchWithTimeout = vi.fn();

vi.mock('@/lib/fetch-utils', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
  TIMEOUT_QUICK_MS: 15000,
}));

// ─── Mock Data ─────────────────────────

const mockOverview = {
  todayCostUsd: 0.0123,
  todayCostInr: 1.03,
  weekCostUsd: 0.0845,
  weekCostInr: 7.10,
  monthCostUsd: 0.3421,
  monthCostInr: 28.74,
  todayRequests: 45,
  weekRequests: 312,
  monthRequests: 1250,
  topProvider: 'openai',
  topModel: 'openai/gpt-4o',
};

const mockDaily = [
  { day: '2024-01-10', providerId: 'openai', modelId: 'gpt-4o', requestCount: 10, totalInputTokens: 5000, totalOutputTokens: 3000, totalCostUsd: 0.005, totalCostInr: 0.42, avgLatencyMs: 800, successRate: 98 },
  { day: '2024-01-10', providerId: 'anthropic', modelId: 'claude-sonnet', requestCount: 5, totalInputTokens: 2000, totalOutputTokens: 1000, totalCostUsd: 0.003, totalCostInr: 0.25, avgLatencyMs: 600, successRate: 100 },
  { day: '2024-01-11', providerId: 'openai', modelId: 'gpt-4o', requestCount: 15, totalInputTokens: 8000, totalOutputTokens: 5000, totalCostUsd: 0.008, totalCostInr: 0.67, avgLatencyMs: 750, successRate: 95 },
  { day: '2024-01-12', providerId: 'openai', modelId: 'gpt-4o', requestCount: 20, totalInputTokens: 12000, totalOutputTokens: 7000, totalCostUsd: 0.012, totalCostInr: 1.01, avgLatencyMs: 900, successRate: 97 },
];

const mockByProvider = [
  { providerId: 'openai', requestCount: 150, totalCostUsd: 0.2000, totalCostInr: 16.80, avgLatencyMs: 850, successRate: 97 },
  { providerId: 'anthropic', requestCount: 50, totalCostUsd: 0.1000, totalCostInr: 8.40, avgLatencyMs: 600, successRate: 99 },
  { providerId: 'groq', requestCount: 200, totalCostUsd: 0.0200, totalCostInr: 1.68, avgLatencyMs: 200, successRate: 95 },
];

function setupDefaultMocks() {
  mockFetchWithTimeout.mockImplementation((url: string) => {
    if (url.includes('view=overview')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOverview) });
    }
    if (url.includes('view=daily')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ daily: mockDaily }) });
    }
    if (url.includes('view=by-provider')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ byProvider: mockByProvider }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

// ─── Tests ─────────────────────────────

describe('CostDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    setupDefaultMocks();
  });

  // ── Loading State ──

  it('shows loading state initially', () => {
    render(<CostDashboard />);
    expect(screen.getByText(/Loading cost data/)).toBeTruthy();
  });

  // ── Empty State ──

  it('shows empty state when no overview data', async () => {
    mockFetchWithTimeout.mockImplementation((url: string) => {
      if (url.includes('view=overview')) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/No cost data available/)).toBeTruthy();
    });
  });

  // ── Overview Cards ──

  it('renders cost overview cards', async () => {
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Today')).toBeTruthy();
      expect(screen.getByText('This Week')).toBeTruthy();
      expect(screen.getByText('This Month')).toBeTruthy();
    });
  });

  it('shows correct cost values', async () => {
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getByText('$0.0123')).toBeTruthy();
      expect(screen.getByText('$0.0845')).toBeTruthy();
      expect(screen.getByText('$0.3421')).toBeTruthy();
    });
  });

  it('shows INR values', async () => {
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/₹1\.03/)).toBeTruthy();
      expect(screen.getByText(/₹7\.10/)).toBeTruthy();
      expect(screen.getByText(/₹28\.74/)).toBeTruthy();
    });
  });

  it('shows request counts', async () => {
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/45 req/)).toBeTruthy();
      expect(screen.getByText(/312 req/)).toBeTruthy();
      expect(screen.getByText(/1250 req/)).toBeTruthy();
    });
  });

  // ── Top Provider & Model ──

  it('shows top provider', async () => {
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Top Provider:')).toBeTruthy();
      expect(screen.getAllByText('OpenAI').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows top model', async () => {
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Top Model:')).toBeTruthy();
      expect(screen.getByText('gpt-4o')).toBeTruthy();
    });
  });

  it('hides provider/model when none', async () => {
    mockFetchWithTimeout.mockImplementation((url: string) => {
      if (url.includes('view=overview')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...mockOverview, topProvider: 'none', topModel: 'none' }) });
      }
      if (url.includes('view=daily')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ daily: mockDaily }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ byProvider: mockByProvider }) });
    });
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.queryByText('Top Provider:')).toBeNull();
      expect(screen.queryByText('Top Model:')).toBeNull();
    });
  });

  // ── Daily Cost Chart ──

  it('renders daily cost chart', async () => {
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Daily Cost (Last 30 Days)')).toBeTruthy();
    });
  });

  it('renders chart bars for each day', async () => {
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Daily Cost (Last 30 Days)')).toBeTruthy();
    });
    // 3 unique days: 2024-01-10, 2024-01-11, 2024-01-12
    const chartContainer = screen.getByText('Daily Cost (Last 30 Days)').closest('[class*="border-white"]')!;
    const bars = chartContainer.querySelectorAll('.group.relative');
    expect(bars.length).toBe(3);
  });

  // ── Provider Cost ──

  it('renders cost by provider section', async () => {
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Cost by Provider (Last 30 Days)')).toBeTruthy();
    });
  });

  it('shows provider names', async () => {
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getAllByText('OpenAI').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Anthropic').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Groq').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows provider costs', async () => {
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getByText('$0.2000')).toBeTruthy();
      expect(screen.getByText('$0.1000')).toBeTruthy();
      expect(screen.getByText('$0.0200')).toBeTruthy();
    });
  });

  it('shows provider request counts', async () => {
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getAllByText(/150 req/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/50 req/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/200 req/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows success rates with color coding', async () => {
    render(<CostDashboard />);
    await waitFor(() => {
      const successRates = screen.getAllByText(/9[5-9]%|100%/);
      expect(successRates.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Empty daily/provider data ──

  it('hides daily chart when no daily data', async () => {
    mockFetchWithTimeout.mockImplementation((url: string) => {
      if (url.includes('view=overview')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOverview) });
      }
      if (url.includes('view=daily')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ daily: [] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ byProvider: mockByProvider }) });
    });
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.queryByText('Daily Cost (Last 30 Days)')).toBeNull();
    });
  });

  it('hides provider section when no provider data', async () => {
    mockFetchWithTimeout.mockImplementation((url: string) => {
      if (url.includes('view=overview')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOverview) });
      }
      if (url.includes('view=daily')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ daily: mockDaily }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ byProvider: [] }) });
    });
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.queryByText('Cost by Provider (Last 30 Days)')).toBeNull();
    });
  });

  // ── Error State ──

  it('shows empty state when fetch throws network error', async () => {
    mockFetchWithTimeout.mockRejectedValue(new Error('Network error'));
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/No cost data available/)).toBeTruthy();
    });
  });

  it('shows empty state when overview returns non-ok response', async () => {
    mockFetchWithTimeout.mockImplementation(() => {
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/No cost data available/)).toBeTruthy();
    });
  });

  it('shows partial data when only overview succeeds', async () => {
    mockFetchWithTimeout.mockImplementation((url: string) => {
      if (url.includes('view=overview')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOverview) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Today')).toBeTruthy();
    });
    // daily and provider sections should be hidden
    expect(screen.queryByText('Daily Cost (Last 30 Days)')).toBeNull();
    expect(screen.queryByText('Cost by Provider (Last 30 Days)')).toBeNull();
  });

  // ── Refresh ──

  it('sets up auto-refresh interval', async () => {
    const spy = vi.spyOn(global, 'setInterval');
    render(<CostDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Today')).toBeTruthy();
    });
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 60_000);
    spy.mockRestore();
  });
});
