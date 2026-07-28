import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RateLimitDashboard } from './RateLimitDashboard';

// ─── Mocks (framer-motion & design-tokens are mocked in test-setup.ts) ──

const mockFetchWithTimeout = vi.fn();

vi.mock('@/lib/fetch-utils', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
  TIMEOUT_QUICK_MS: 15000,
}));

vi.mock('@/lib/download-blob', () => ({
  downloadBlob: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ─── Mock Data ─────────────────────────

const mockAnalyticsData = {
  range: '24h',
  summary: { totalBlocked: 42, totalWarnings: 15, uniqueUsers: 8 },
  topUsers: [
    { userId: 'user-abc-123-def-456', blockedCount: 20, endpointsAffected: 3, lastBlocked: '2024-01-15T10:30:00Z' },
    { userId: 'user-xyz-789-ghi-012', blockedCount: 12, endpointsAffected: 2, lastBlocked: '2024-01-15T09:00:00Z' },
  ],
  endpointSummary: [
    { endpoint: 'ai_chat', blocked: 30, warnings: 10, total: 100 },
    { endpoint: 'web_search', blocked: 12, warnings: 5, total: 50 },
  ],
  hourlyDistribution: [
    { hour: '2024-01-15T00:00', blocked: 2, warning: 1 },
    { hour: '2024-01-15T01:00', blocked: 5, warning: 3 },
    { hour: '2024-01-15T02:00', blocked: 0, warning: 0 },
    { hour: '2024-01-15T03:00', blocked: 10, warning: 2 },
  ],
};

const mockDrilldownData = {
  userId: 'user-abc-123-def-456',
  range: '24h',
  totalEvents: 3,
  events: [
    { action: 'security.rate_limit_exceeded', endpoint: 'ai_chat', remaining: 0, timestamp: '2024-01-15T10:30:00Z' },
    { action: 'security.rate_limit_warning', endpoint: 'web_search', remaining: 5, timestamp: '2024-01-15T10:25:00Z' },
    { action: 'security.rate_limit_exceeded', endpoint: 'ai_chat', remaining: null, timestamp: '2024-01-15T10:20:00Z' },
  ],
};

const emptyAnalyticsData = {
  range: '24h',
  summary: { totalBlocked: 0, totalWarnings: 0, uniqueUsers: 0 },
  topUsers: [],
  endpointSummary: [],
  hourlyDistribution: [],
};

const mockConfigData = {
  redisConfigured: true,
  configs: [
    { id: 'cfg-1', endpoint: 'ai_chat', max_requests: 100, window_seconds: 60 },
    { id: 'cfg-2', endpoint: 'web_search', max_requests: 50, window_seconds: 30 },
  ],
};

const mockHistoryData = {
  history: [
    { userId: 'user-abc-123-def-456', endpoint: 'ai_chat', changes: { maxRequests: 150, windowSeconds: 60 }, timestamp: '2024-01-15T10:30:00Z' },
  ],
};

// ─── Tests ─────────────────────────────

describe('RateLimitDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsData),
    });
  });

  // ── Header ──

  it('renders the header with title', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/🛡️ Rate Limit Analytics/)).toBeTruthy();
    });
  });

  it('renders time range buttons', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('1 Hour')).toBeTruthy();
      expect(screen.getByText('24 Hours')).toBeTruthy();
      expect(screen.getByText('7 Days')).toBeTruthy();
    });
  });

  // ── Loading State ──

  it('shows loading skeleton initially', () => {
    render(<RateLimitDashboard />);
    const pulses = document.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBeGreaterThan(0);
  });

  // ── Data Rendering ──

  it('renders summary cards with data', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Blocked Requests')).toBeTruthy();
      expect(screen.getByText('Near-Limit Warnings')).toBeTruthy();
      expect(screen.getByText('Unique Users Affected')).toBeTruthy();
    });
  });

  it('shows correct summary values', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
      expect(screen.getByText('15')).toBeTruthy();
      expect(screen.getByText('8')).toBeTruthy();
    });
  });

  it('renders top blocked users table', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Top Blocked Users/)).toBeTruthy();
      expect(screen.getAllByText(/user-abc/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/user-xyz/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders endpoint summary section', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Abuse by Endpoint/)).toBeTruthy();
      expect(screen.getAllByText(/AI Chat/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Web Search/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders hourly distribution chart', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Hourly Distribution/)).toBeTruthy();
    });
  });

  // ── Time Range Switching ──

  it('switches time range on click', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });
    
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...mockAnalyticsData, range: '7d' }),
    });

    fireEvent.click(screen.getByText('7 Days'));
    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        expect.stringContaining('range=7d'),
        expect.anything(),
      );
    });
  });

  // ── Auto-refresh ──

  it('shows auto-refresh toggle', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });
    expect(screen.getByText(/⏸ Pause/)).toBeTruthy();
  });

  it('toggles auto-refresh off', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });
    fireEvent.click(screen.getByText(/⏸ Pause/));
    expect(screen.getByText(/▶ Live/)).toBeTruthy();
  });

  it('shows refresh interval selector', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });
    expect(screen.getByText('15s')).toBeTruthy();
    expect(screen.getByText('30s')).toBeTruthy();
    expect(screen.getByText('60s')).toBeTruthy();
  });

  // ── Export CSV ──

  it('shows export CSV button when data is loaded', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('📥 Export CSV')).toBeTruthy();
    });
  });

  // ── User Drilldown ──

  it('opens user drilldown panel on user click', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAnalyticsData),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDrilldownData),
      });

    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Top Blocked Users/)).toBeTruthy();
    });
    
    const userRow = screen.getAllByText(/user-abc/)[0].closest('tr')!;
    fireEvent.click(userRow);
    
    await waitFor(() => {
      expect(screen.getByText(/User Drill-down/)).toBeTruthy();
    });
  });

  it('closes drilldown panel on close click', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAnalyticsData),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDrilldownData),
      });

    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Top Blocked Users/)).toBeTruthy();
    });
    
    fireEvent.click(screen.getAllByText(/user-abc/)[0].closest('tr')!);
    await waitFor(() => {
      expect(screen.getByText(/User Drill-down/)).toBeTruthy();
    });
    
    fireEvent.click(screen.getByText(/✕ Close/));
    await waitFor(() => {
      expect(screen.queryByText(/User Drill-down/)).toBeNull();
    });
  });

  // ── Error State ──

  it('shows error message on fetch failure', async () => {
    mockFetchWithTimeout.mockRejectedValue(new Error('Network error'));
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/⚠️.*Network error/)).toBeTruthy();
    });
  });

  it('shows HTTP error message', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Server error' }),
    });
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/⚠️.*Server error/)).toBeTruthy();
    });
  });

  // ── Empty State ──

  it('shows empty state when no events', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptyAnalyticsData),
    });
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/No Rate Limit Events/)).toBeTruthy();
    });
  });

  // ── Rate Limit Config Panel ──

  it('opens config panel on Limits button click', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });

    // Mock config API response for the panel
    mockFetchWithTimeout.mockImplementation((url: string) => {
      if (url.includes('/api/admin/rate-limit-config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockConfigData) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAnalyticsData) });
    });

    fireEvent.click(screen.getByText(/⚙ Limits/));
    await waitFor(() => {
      expect(screen.getByText(/Rate Limit Configuration/)).toBeTruthy();
    });
  });

  it('closes config panel on Close button click', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });

    mockFetchWithTimeout.mockImplementation((url: string) => {
      if (url.includes('/api/admin/rate-limit-config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockConfigData) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAnalyticsData) });
    });

    fireEvent.click(screen.getByText(/⚙ Limits/));
    await waitFor(() => {
      expect(screen.getByText(/Rate Limit Configuration/)).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/✕ Close/));
    await waitFor(() => {
      expect(screen.queryByText(/Rate Limit Configuration/)).toBeNull();
    });
  });

  it('shows Redis badge when redis is configured', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });

    mockFetchWithTimeout.mockImplementation((url: string) => {
      if (url.includes('/api/admin/rate-limit-config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockConfigData) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAnalyticsData) });
    });

    fireEvent.click(screen.getByText(/⚙ Limits/));
    await waitFor(() => {
      expect(screen.getByText('Redis (Production)')).toBeTruthy();
    });
  });

  it('shows In-Memory badge when redis is not configured', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });

    mockFetchWithTimeout.mockImplementation((url: string) => {
      if (url.includes('/api/admin/rate-limit-config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...mockConfigData, redisConfigured: false }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAnalyticsData) });
    });

    fireEvent.click(screen.getByText(/⚙ Limits/));
    await waitFor(() => {
      expect(screen.getByText('In-Memory (Development)')).toBeTruthy();
    });
  });

  it('renders config endpoints with input fields', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });

    mockFetchWithTimeout.mockImplementation((url: string) => {
      if (url.includes('/api/admin/rate-limit-config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockConfigData) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAnalyticsData) });
    });

    fireEvent.click(screen.getByText(/⚙ Limits/));
    await waitFor(() => {
      expect(screen.getByText('AI Chat')).toBeTruthy();
      expect(screen.getByText('Web Search')).toBeTruthy();
    });

    // Number inputs have role 'spinbutton' in the accessibility tree
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBeGreaterThanOrEqual(4);
  });

  it('enables Save button when input value changes', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });

    mockFetchWithTimeout.mockImplementation((url: string) => {
      if (url.includes('/api/admin/rate-limit-config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockConfigData) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAnalyticsData) });
    });

    fireEvent.click(screen.getByText(/⚙ Limits/));
    await waitFor(() => {
      expect(screen.getByText('AI Chat')).toBeTruthy();
    });

    // Save button should be disabled initially (no changes made)
    const saveButtons = screen.getAllByText('Save');
    expect(saveButtons[0]).toBeDisabled();

    // Change the max value for ai_chat from 100 to 200
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '200' } });

    // Save button should now be enabled
    await waitFor(() => {
      expect(saveButtons[0]).not.toBeDisabled();
    });
  });

  it('calls PUT endpoint when Save is clicked', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAnalyticsData) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockConfigData) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ config: { max_requests: 200, window_seconds: 60 } }) });

    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/⚙ Limits/));
    await waitFor(() => {
      expect(screen.getByText('AI Chat')).toBeTruthy();
    });

    // Change max value to 200
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '200' } });

    await waitFor(() => {
      expect(screen.getAllByText('Save')[0]).not.toBeDisabled();
    });

    // Click Save
    fireEvent.click(screen.getAllByText('Save')[0]);

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        '/api/admin/rate-limit-config',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
  });

  it('fetches and displays config history on History button click', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });

    mockFetchWithTimeout.mockImplementation((url: string) => {
      if (url.includes('/api/admin/rate-limit-config?history=true')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockHistoryData) });
      }
      if (url.includes('/api/admin/rate-limit-config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockConfigData) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAnalyticsData) });
    });

    fireEvent.click(screen.getByText(/⚙ Limits/));
    await waitFor(() => {
      expect(screen.getByText('AI Chat')).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/📋 History/));
    await waitFor(() => {
      expect(screen.getByText(/Recent Config Changes/)).toBeTruthy();
    });
  });

  it('shows empty history when no changes recorded', async () => {
    render(<RateLimitDashboard />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });

    mockFetchWithTimeout.mockImplementation((url: string) => {
      if (url.includes('/api/admin/rate-limit-config?history=true')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ history: [] }) });
      }
      if (url.includes('/api/admin/rate-limit-config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockConfigData) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAnalyticsData) });
    });

    fireEvent.click(screen.getByText(/⚙ Limits/));
    await waitFor(() => {
      expect(screen.getByText('AI Chat')).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/📋 History/));
    await waitFor(() => {
      expect(screen.getByText(/No config changes recorded yet/)).toBeTruthy();
    });
  });
});
