import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

// ─── Mocks ───

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: vi.fn(),
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: (p: Record<string, unknown>) => <div {...p}>{p.children as React.ReactNode}</div>,
    span: (p: Record<string, unknown>) => <span {...p}>{p.children as React.ReactNode}</span>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/stores/router.store', () => ({
  useRouterStore: () => ({
    totalCostINR: 0.05,
    mcpEnabled: { gmail: true, calendar: false, drive: false },
    providerStatuses: {},
  }),
}));

vi.mock('@/styles/design-tokens', () => ({
  ORACLE_TABS: [
    { id: 'agent', label: 'Agent', emoji: '🤖' },
    { id: 'prompts', label: 'Prompts', emoji: '📝' },
  ],
}));

vi.mock('@/lib/router', () => ({
  NeverStopRouter: {
    getAllKeys: vi.fn().mockReturnValue({ openai: 'sk-123' }),
  },
}));

vi.mock('@/components/oracle/NotificationPanel', () => ({
  useNotificationCount: () => 3,
}));

vi.mock('@/lib/supabase/hooks', () => ({
  useUser: () => ({ user: { id: 'u1', email: 'test@oracle.com' } }),
  useLogout: () => vi.fn(),
}));

// Mock global fetch for the emergency stop useEffect
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ active: false, reason: null }),
});
vi.stubGlobal('fetch', mockFetch);

// ─── Import after mocks ───

import { Header } from './Header';

// ─── Tests ─────────────────────────────

describe('Header', () => {
  const defaultProps = {
    activeTab: 'agent' as const,
    onTabChange: vi.fn(),
    onCommandOpen: vi.fn(),
    onNotificationsOpen: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ active: false, reason: null }),
    });
  });

  it('renders the ORACLE logo', async () => {
    await act(async () => {
      render(<Header {...defaultProps} />);
    });
    expect(screen.getByText('ORACLE')).toBeDefined();
    expect(screen.getByText('Universal Agency Intelligence')).toBeDefined();
  });

  it('renders tab navigation', async () => {
    await act(async () => {
      render(<Header {...defaultProps} />);
    });
    expect(screen.getByText('Agent')).toBeDefined();
    expect(screen.getByText('Prompts')).toBeDefined();
  });

  it('calls onTabChange when tab is clicked', async () => {
    await act(async () => {
      render(<Header {...defaultProps} />);
    });
    fireEvent.click(screen.getByText('Prompts'));
    expect(defaultProps.onTabChange).toHaveBeenCalledWith('prompts');
  });

  it('renders MCP service toggles', async () => {
    await act(async () => {
      render(<Header {...defaultProps} />);
    });
    expect(screen.getByText('Gmail')).toBeDefined();
    expect(screen.getByText('Calendar')).toBeDefined();
    expect(screen.getByText('Drive')).toBeDefined();
  });

  it('shows MCP gmail as connected', async () => {
    await act(async () => {
      render(<Header {...defaultProps} />);
    });
    // The status dot class is on a span inside the button
    const gmailBtn = screen.getByLabelText('MCP gmail: connected');
    expect(gmailBtn).toBeDefined();
  });

  it('renders command palette button', async () => {
    await act(async () => {
      render(<Header {...defaultProps} />);
    });
    const cmdBtn = screen.getByText('⌘K');
    expect(cmdBtn).toBeDefined();
  });

  it('calls onCommandOpen when ⌘K is clicked', async () => {
    await act(async () => {
      render(<Header {...defaultProps} />);
    });
    fireEvent.click(screen.getByText('⌘K'));
    expect(defaultProps.onCommandOpen).toHaveBeenCalledTimes(1);
  });

  it('renders theme toggle', async () => {
    await act(async () => {
      render(<Header {...defaultProps} />);
    });
    expect(screen.getByLabelText('Switch to light mode')).toBeDefined();
  });

  it('renders notifications bell with count', async () => {
    await act(async () => {
      render(<Header {...defaultProps} />);
    });
    expect(screen.getByLabelText(/Notifications.*3 unread/)).toBeDefined();
  });

  it('calls onNotificationsOpen when bell is clicked', async () => {
    await act(async () => {
      render(<Header {...defaultProps} />);
    });
    fireEvent.click(screen.getByLabelText(/Notifications/));
    expect(defaultProps.onNotificationsOpen).toHaveBeenCalledTimes(1);
  });

  it('displays cost in INR', async () => {
    await act(async () => {
      render(<Header {...defaultProps} />);
    });
    expect(screen.getByText('₹0.05')).toBeDefined();
  });

  it('renders user menu when user is present', async () => {
    await act(async () => {
      render(<Header {...defaultProps} />);
    });
    expect(screen.getByLabelText('User menu')).toBeDefined();
  });

  it('shows user email when menu is opened', async () => {
    await act(async () => {
      render(<Header {...defaultProps} />);
    });
    fireEvent.click(screen.getByLabelText('User menu'));
    expect(screen.getByText('test@oracle.com')).toBeDefined();
    expect(screen.getByText('Signed in')).toBeDefined();
  });

  it('shows sign out option in user menu', async () => {
    await act(async () => {
      render(<Header {...defaultProps} />);
    });
    fireEvent.click(screen.getByLabelText('User menu'));
    expect(screen.getByText('Sign out')).toBeDefined();
  });

  it('sets aria-current on active tab', async () => {
    await act(async () => {
      render(<Header {...defaultProps} />);
    });
    const agentTab = screen.getByText('Agent').closest('button');
    expect(agentTab?.getAttribute('aria-current')).toBe('page');
  });
});
