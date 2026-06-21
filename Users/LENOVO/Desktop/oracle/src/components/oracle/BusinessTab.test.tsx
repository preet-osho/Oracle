import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ─── Mocks ───

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...filterDomProps(props)}>{children}</div>,
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <button {...filterDomProps(props)}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
  const domProps: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (key === 'children' || key.startsWith('on') || key === 'className' || key === 'style' || key === 'onClick' || key === 'data-testid' || key === 'key' || key === 'role' || key === 'title' || key === 'type' || key === 'disabled' || key === 'value' || key === 'placeholder' || key === 'id' || key === 'htmlFor') {
      domProps[key] = props[key];
    }
  }
  return domProps;
}

vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {} },
  cardHoverProps: {},
  buttonTapProps: {},
}));

vi.mock('@/data/revenue-templates', () => ({
  DEFAULT_REVENUE_TEMPLATES: [
    { name: 'SEO Services', type: 'Service', description: 'Monthly SEO retainer', monthlyProjection: 50000, annualProjection: 600000, status: 'Active', margin: 70, effort: 'Medium', timeline: 'Ongoing', tools: ['Ahrefs', 'GSC'], notes: 'Core service' },
    { name: 'Web Development', type: 'Service', description: 'Custom websites', monthlyProjection: 100000, annualProjection: 1200000, status: 'Planning', margin: 60, effort: 'High', timeline: '2-4 weeks per project', tools: ['Next.js'], notes: '' },
  ],
}));

vi.mock('@/data/expense-templates', () => ({
  DEFAULT_EXPENSE_TEMPLATES: [
    { description: 'Ahrefs subscription', amount: 9990, category: 'software', date: Date.now(), recurring: true, projectId: 'default', clientName: 'Internal' },
  ],
}));

vi.mock('@/lib/expense-tracker', () => ({
  loadExpenses: vi.fn().mockReturnValue([]),
  seedExpensesIfEmpty: vi.fn(),
}));

vi.mock('@/lib/annual-revenue-report', () => ({
  generateAnnualReport: vi.fn().mockReturnValue({
    year: 2025,
    revenue: { totalINR: 1200000, monthly: [] },
    expenses: { totalINR: 300000, byCategory: {} },
    profitability: { netProfit: 900000, grossMargin: 75 },
    clients: { totalClients: 5, newClients: 2, retentionRate: 80, repeatRate: 60, averageLifetimeValue: 240000, lostClients: 1 },
    insights: ['Revenue grew 25% YoY'],
  }),
  formatAnnualReportAsText: vi.fn().mockReturnValue('Annual Report Text'),
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(
    (...args: unknown[]) => {},
    { success: vi.fn(), error: vi.fn() }
  ),
  toast: Object.assign(
    (...args: unknown[]) => {},
    { success: vi.fn(), error: vi.fn() }
  ),
}));

// Mock global.fetch
const mockFetch = vi.fn();

// ─── Tests ───

import { BusinessTab } from './BusinessTab';

describe('BusinessTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation(async (url: string | Request, init?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/api/revenue-streams/seed') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ streams: [] }) };
      }
      if (typeof url === 'string' && url.includes('/api/revenue-streams') && init?.method === 'DELETE') {
        return { ok: true, json: async () => ({}) };
      }
      if (typeof url === 'string' && url.includes('/api/revenue-streams') && init?.method === 'PUT') {
        return { ok: true, json: async () => ({}) };
      }
      if (typeof url === 'string' && url.includes('/api/revenue-streams') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 'new-1', name: 'New Stream', type: 'Service', description: '', monthly_projection: 10000, annual_projection: 120000, status: 'Planning', margin: 80, effort: 'Low', timeline: '', tools: [], notes: '', created_at: Date.now() }) };
      }
      if (typeof url === 'string' && url.includes('/api/revenue-streams')) {
        return { ok: true, json: async () => [] };
      }
      return { ok: true, json: async () => ({}) };
    });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  // ── Rendering ──

  describe('rendering', () => {
    it('renders the business operations header', async () => {
      await waitFor(() => {
        render(<BusinessTab />);
      });
      expect(screen.getByText('💼 Business Operations')).toBeDefined();
      expect(screen.getByText(/Revenue streams, financial projections/)).toBeDefined();
    });

    it('renders the add stream button', async () => {
      await waitFor(() => {
        render(<BusinessTab />);
      });
      expect(screen.getByText('+ Add Stream')).toBeDefined();
    });

    it('renders view tabs', async () => {
      await waitFor(() => {
        render(<BusinessTab />);
      });
      expect(screen.getByText('💰 Revenue Streams')).toBeDefined();
      expect(screen.getByText('📈 Financial Projections')).toBeDefined();
      expect(screen.getByText('🔮 12-Month Forecast')).toBeDefined();
      expect(screen.getByText('☁️ Micro-SaaS Research')).toBeDefined();
      expect(screen.getByText('📊 Annual Report')).toBeDefined();
    });

    it('displays stats cards', async () => {
      await waitFor(() => {
        render(<BusinessTab />);
      });
      expect(screen.getByText('Active Streams')).toBeDefined();
      expect(screen.getByText('Monthly Revenue')).toBeDefined();
      expect(screen.getByText('Annual Projection')).toBeDefined();
      expect(screen.getByText('Avg Margin')).toBeDefined();
    });
  });

  // ── View Tab Switching ──

  describe('view tab switching', () => {
    it('switches to projections view', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<BusinessTab />);
      });
      await user.click(screen.getByText('📈 Financial Projections'));
      expect(screen.getByText('💰 Revenue by Stream')).toBeDefined();
      expect(screen.getByText('📈 Growth Scenarios')).toBeDefined();
    });

    it('switches to forecast view', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<BusinessTab />);
      });
      await user.click(screen.getByText('🔮 12-Month Forecast'));
      expect(screen.getByText('🔮 12-Month Revenue Forecast')).toBeDefined();
      expect(screen.getByText('📋 Monthly Breakdown')).toBeDefined();
    });

    it('switches to micro-saas view', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<BusinessTab />);
      });
      await user.click(screen.getByText('☁️ Micro-SaaS Research'));
      expect(screen.getByText('☁️ Micro-SaaS Ideas for Indian Agencies')).toBeDefined();
      expect(screen.getByText('🏆 Recommended: Client Report Automator')).toBeDefined();
    });

    it('switches to annual report view', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<BusinessTab />);
      });
      await user.click(screen.getByText('📊 Annual Report'));
      expect(screen.getByText('Generate Annual Revenue Report')).toBeDefined();
      expect(screen.getByText('⚡ Generate Report')).toBeDefined();
    });
  });

  // ── Revenue Streams ──

  describe('revenue streams', () => {
    it('displays default revenue streams', async () => {
      await waitFor(() => {
        render(<BusinessTab />);
      });
      expect(screen.getByText('SEO Services')).toBeDefined();
      expect(screen.getByText('Web Development')).toBeDefined();
    });

    it('shows stream statuses', async () => {
      await waitFor(() => {
        render(<BusinessTab />);
      });
      const activeBadges = screen.getAllByText('Active');
      expect(activeBadges.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Planning')).toBeDefined();
    });

    it('expands stream details when clicked', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<BusinessTab />);
      });
      await user.click(screen.getByText('SEO Services'));
      expect(screen.getByText('Annual:')).toBeDefined();
      expect(screen.getByText('Effort:')).toBeDefined();
      expect(screen.getByText('Tools:')).toBeDefined();
    });

    it('shows status update buttons when expanded', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<BusinessTab />);
      });
      await user.click(screen.getByText('SEO Services'));
      // 'Planning' appears both as a stream status badge and as a status button — use getAllByText
      const planningElements = screen.getAllByText('Planning');
      expect(planningElements.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Building')).toBeDefined();
    });
  });

  // ── Micro-SaaS Research ──

  describe('micro-saas research', () => {
    it('displays SaaS ideas table', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<BusinessTab />);
      });
      await user.click(screen.getByText('☁️ Micro-SaaS Research'));
      expect(screen.getByText('AI Proposal Generator')).toBeDefined();
      expect(screen.getByText('Local Lead Finder')).toBeDefined();
      expect(screen.getByText('Client Report Automator')).toBeDefined();
    });

    it('shows recommended winner', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<BusinessTab />);
      });
      await user.click(screen.getByText('☁️ Micro-SaaS Research'));
      expect(screen.getByText('🏆 Recommended: Client Report Automator')).toBeDefined();
      expect(screen.getByText('⚡ Generate Full Plan')).toBeDefined();
    });
  });

  // ── Annual Report ──

  describe('annual report', () => {
    it('shows year selector and generate button', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<BusinessTab />);
      });
      await user.click(screen.getByText('📊 Annual Report'));
      const currentYear = new Date().getFullYear().toString();
      expect(screen.getByDisplayValue(currentYear)).toBeDefined();
      expect(screen.getByText('⚡ Generate Report')).toBeDefined();
    });

    it('generates report when button is clicked', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<BusinessTab />);
      });
      await user.click(screen.getByText('📊 Annual Report'));
      await user.click(screen.getByText('⚡ Generate Report'));

      await waitFor(() => {
        expect(screen.getByText('Total Revenue')).toBeDefined();
        expect(screen.getByText('Net Profit')).toBeDefined();
        expect(screen.getByText('Gross Margin')).toBeDefined();
      });
    });
  });
});
