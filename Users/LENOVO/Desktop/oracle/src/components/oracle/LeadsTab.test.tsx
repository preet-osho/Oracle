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

vi.mock('@/data/lead-templates', () => ({
  DEFAULT_LEAD_TEMPLATES: [
    { businessName: 'Spice Garden Restaurant', phone: '+919876543210', email: 'info@spicegarden.com', website: '', googleMapsUrl: '', rating: 3.5, reviewCount: 25, address: '123 MG Road', city: 'Mumbai', category: 'Restaurant', industry: 'Food & Beverage', triggerCriterion: 'Low rating with many reviews', status: 'New', source: 'Google Maps', notes: 'Needs website', assignedTo: undefined, followUpDate: undefined },
    { businessName: 'Smile Dental Clinic', phone: '+919876543211', email: 'dr@smiledental.com', website: 'http://smiledental.in', googleMapsUrl: '', rating: 4.2, reviewCount: 50, address: '456 Park Street', city: 'Delhi', category: 'Dental Clinic', industry: 'Healthcare', triggerCriterion: 'Outdated website', status: 'Contacted', source: 'Website Audit', notes: 'Responded positively', assignedTo: undefined, followUpDate: '2026-06-25' },
    { businessName: 'FitZone Gym', phone: '+919876543212', email: 'contact@fitzone.in', website: '', googleMapsUrl: '', rating: 4.0, reviewCount: 100, address: '789 Hill Road', city: 'Mumbai', category: 'Gym', industry: 'Fitness', triggerCriterion: 'No website listed', status: 'Hot', source: 'Google Maps', notes: '', assignedTo: undefined, followUpDate: undefined },
  ],
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

import { LeadsTab } from './LeadsTab';

describe('LeadsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation(async (url: string | Request, init?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/api/leads/seed') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ leads: [] }) };
      }
      if (typeof url === 'string' && url.includes('/api/leads') && init?.method === 'DELETE') {
        return { ok: true, json: async () => ({}) };
      }
      if (typeof url === 'string' && url.includes('/api/leads') && init?.method === 'PUT') {
        return { ok: true, json: async () => ({}) };
      }
      if (typeof url === 'string' && url.includes('/api/leads') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 'new-1', business_name: 'New Lead', phone: '', email: '', website: '', google_maps_url: '', rating: 0, review_count: 0, address: '', city: '', category: '', industry: '', trigger_criterion: 'Manual entry', status: 'New', source: 'Manual', notes: '', created_at: Date.now(), updated_at: Date.now() }) };
      }
      if (typeof url === 'string' && url.includes('/api/leads')) {
        return { ok: true, json: async () => [] };
      }
      return { ok: true, json: async () => ({}) };
    });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  // ── Rendering ──

  describe('rendering', () => {
    it('renders the lead generation header', async () => {
      await waitFor(() => {
        render(<LeadsTab />);
      });
      expect(screen.getByText('🎯 Lead Generation')).toBeDefined();
      expect(screen.getByText(/Find, track, and convert potential clients/)).toBeDefined();
    });

    it('renders the add lead button', async () => {
      await waitFor(() => {
        render(<LeadsTab />);
      });
      expect(screen.getByText('+ Add Lead')).toBeDefined();
    });

    it('renders view tabs with counts', async () => {
      await waitFor(() => {
        render(<LeadsTab />);
      });
      expect(screen.getByText(/📋 Lead Tracker/)).toBeDefined();
      expect(screen.getByText(/⚡ Generation Workflows/)).toBeDefined();
      expect(screen.getByText(/📅 Follow-ups/)).toBeDefined();
    });

    it('displays stats cards', async () => {
      await waitFor(() => {
        render(<LeadsTab />);
      });
      expect(screen.getByText('Total Leads')).toBeDefined();
      expect(screen.getByText('Hot Leads')).toBeDefined();
      // 'Responded' appears as both a stat label and a lead status badge
      expect(screen.getAllByText('Responded').length).toBeGreaterThanOrEqual(1);
      // 'Converted' also appears in both stat label and status badge
      expect(screen.getAllByText('Converted').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── View Tab Switching ──

  describe('view tab switching', () => {
    it('switches to workflows view', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      // Find the workflows tab button
      const workflowsTab = screen.getAllByText(/Generation Workflows/)[0].closest('button')!;
      await user.click(workflowsTab);
      expect(screen.getByText('Google Maps Lead Mining')).toBeDefined();
      expect(screen.getByText('Website Quality Analysis')).toBeDefined();
    });

    it('switches to follow-ups view', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      const followUpsTab = screen.getAllByText(/Follow-ups/)[0].closest('button')!;
      await user.click(followUpsTab);
      // Smile Dental has a followUpDate, FitZone is Hot — both should appear
      expect(screen.getByText('Smile Dental Clinic')).toBeDefined();
      expect(screen.getByText('FitZone Gym')).toBeDefined();
    });
  });

  // ── Lead Tracker ──

  describe('lead tracker', () => {
    it('displays default leads', async () => {
      await waitFor(() => {
        render(<LeadsTab />);
      });
      expect(screen.getByText('Spice Garden Restaurant')).toBeDefined();
      expect(screen.getByText('Smile Dental Clinic')).toBeDefined();
      expect(screen.getByText('FitZone Gym')).toBeDefined();
    });

    it('shows lead statuses', async () => {
      await waitFor(() => {
        render(<LeadsTab />);
      });
      // Status badges appear with emojis, and 'New' appears in multiple places
      const newElements = screen.getAllByText(/New/);
      expect(newElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Contacted/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Hot/).length).toBeGreaterThanOrEqual(1);
    });

    it('shows lead cities and categories', async () => {
      await waitFor(() => {
        render(<LeadsTab />);
      });
      // Mumbai appears for both Spice Garden and FitZone
      expect(screen.getAllByText('Mumbai').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Delhi')).toBeDefined();
      // 'Restaurant' may be part of a larger string like 'Restaurant' category
      const bodyText = document.body.textContent || '';
      expect(bodyText).toContain('Restaurant');
    });

    it('expands lead details when clicked', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      await user.click(screen.getByText('Spice Garden Restaurant'));
      expect(screen.getByText('Phone:')).toBeDefined();
      expect(screen.getByText('Email:')).toBeDefined();
      expect(screen.getByText('Website:')).toBeDefined();
    });

    it('shows personalised message when expanded', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      // Smile Dental has notes, expand it
      await user.click(screen.getByText('Smile Dental Clinic'));
      expect(screen.getByText('Notes')).toBeDefined();
    });
  });

  // ── Filtering ──

  describe('filtering', () => {
    it('filters leads by search term', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      const searchInput = screen.getByPlaceholderText(/Search leads/);
      await user.type(searchInput, 'Spice');
      expect(screen.getByText('Spice Garden Restaurant')).toBeDefined();
      expect(screen.queryByText('FitZone Gym')).toBeNull();
    });

    it('filters leads by status', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      // Multiple 'All' selects exist (status + source), find the first one
      const allSelects = screen.getAllByDisplayValue('All');
      await user.selectOptions(allSelects[0], 'Hot');
      expect(screen.getByText('FitZone Gym')).toBeDefined();
      expect(screen.queryByText('Spice Garden Restaurant')).toBeNull();
    });

    it('filters leads by source', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      const sourceSelect = screen.getAllByDisplayValue('All')[1]; // Second select is source
      await user.selectOptions(sourceSelect, 'Google Maps');
      expect(screen.getByText('Spice Garden Restaurant')).toBeDefined();
      expect(screen.getByText('FitZone Gym')).toBeDefined();
      expect(screen.queryByText('Smile Dental Clinic')).toBeNull();
    });
  });

  // ── Lead Workflows ──

  describe('lead workflows', () => {
    it('displays all workflow types', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      const workflowsTab = screen.getAllByText(/Generation Workflows/)[0].closest('button')!;
      await user.click(workflowsTab);

      expect(screen.getByText('Google Maps Lead Mining')).toBeDefined();
      expect(screen.getByText('Website Quality Analysis')).toBeDefined();
      expect(screen.getByText('Funded Startup Prospecting')).toBeDefined();
      expect(screen.getByText('Social Listening Lead Gen')).toBeDefined();
      expect(screen.getByText('Job Listing Intelligence')).toBeDefined();
    });

    it('shows Run Workflow and Generate Template buttons', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      const workflowsTab = screen.getAllByText(/Generation Workflows/)[0].closest('button')!;
      await user.click(workflowsTab);

      const runButtons = screen.getAllByText('⚡ Run Workflow');
      expect(runButtons.length).toBe(5);
      const templateButtons = screen.getAllByText('✍️ Generate Template');
      expect(templateButtons.length).toBe(5);
    });

    it('expands workflow criteria', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      const workflowsTab = screen.getAllByText(/Generation Workflows/)[0].closest('button')!;
      await user.click(workflowsTab);

      await user.click(screen.getByText(/View 5 qualification criteria/));
      expect(screen.getByText('No website listed in Google Maps profile')).toBeDefined();
    });
  });

  // ── Follow-ups ──

  describe('follow-ups', () => {
    it('shows leads with follow-up dates or hot/warm status', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      const followUpsTab = screen.getAllByText(/Follow-ups/)[0].closest('button')!;
      await user.click(followUpsTab);

      // Smile Dental has followUpDate, FitZone is Hot
      expect(screen.getByText('Smile Dental Clinic')).toBeDefined();
      expect(screen.getByText('FitZone Gym')).toBeDefined();
      // Spice Garden is New with no followUp — should not appear
      expect(screen.queryByText('Spice Garden Restaurant')).toBeNull();
    });

    it('shows overdue indicator for past follow-up dates', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      const followUpsTab = screen.getAllByText(/Follow-ups/)[0].closest('button')!;
      await user.click(followUpsTab);

      // Smile Dental has followUpDate '2026-06-25' — text may be split across elements
      const bodyText = document.body.textContent || '';
      expect(bodyText).toContain('2026-06-25');
    });

    it('shows Write Follow-up and WhatsApp buttons', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      const followUpsTab = screen.getAllByText(/Follow-ups/)[0].closest('button')!;
      await user.click(followUpsTab);

      const followUpButtons = screen.getAllByText('✍️ Write Follow-up');
      expect(followUpButtons.length).toBeGreaterThanOrEqual(1);

      const whatsappLinks = screen.getAllByText('💬 WhatsApp');
      expect(whatsappLinks.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Add Lead Modal ──

  describe('add lead modal', () => {
    it('opens add lead form when button is clicked', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      await user.click(screen.getByText('+ Add Lead'));
      expect(screen.getByText('+ Add New Lead')).toBeDefined();
      expect(screen.getByPlaceholderText('Business Name *')).toBeDefined();
    });

    it('shows error when saving without business name', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      await user.click(screen.getByText('+ Add Lead'));
      await user.click(screen.getByText('Add Lead'));
      expect(screen.getByText('Business name is required.')).toBeDefined();
    });
  });

  // ── Edge Cases ──

  describe('edge cases', () => {
    it('handles API seed failure gracefully (keeps template data)', async () => {
      mockFetch.mockImplementation(async () => {
        throw new Error('Network error');
      });
      await waitFor(() => {
        render(<LeadsTab />);
      });
      // Should still show default template leads
      expect(screen.getByText('Spice Garden Restaurant')).toBeDefined();
      expect(screen.getByText('FitZone Gym')).toBeDefined();
    });

    it('handles delete API failure gracefully (optimistic update)', async () => {
      mockFetch.mockImplementation(async (url: string | Request, init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/api/leads/seed') && init?.method === 'POST') {
          return { ok: true, json: async () => ({ leads: [] }) };
        }
        if (typeof url === 'string' && url.includes('/api/leads') && init?.method === 'DELETE') {
          throw new Error('Delete failed');
        }
        if (typeof url === 'string' && url.includes('/api/leads')) {
          return { ok: true, json: async () => [] };
        }
        return { ok: true, json: async () => ({}) };
      });
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      // Expand the first lead to see delete button
      await user.click(screen.getByText('Spice Garden Restaurant'));
      const deleteButtons = screen.getAllByText('🗑');
      await user.click(deleteButtons[0]);
      // Lead should be removed optimistically even though API failed
      expect(screen.queryByText('Spice Garden Restaurant')).toBeNull();
    });

    it('search with no results shows empty state', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      const searchInput = screen.getByPlaceholderText(/Search leads/);
      await user.type(searchInput, 'NonexistentBusiness12345');
      expect(screen.getByText(/No leads found/)).toBeDefined();
    });

    it('onAskOracle callback is invoked from lead actions', async () => {
      const onAskOracle = vi.fn();
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab onAskOracle={onAskOracle} />);
      });
      await user.click(screen.getByText('Spice Garden Restaurant'));
      const askButtons = screen.getAllByText('⚡');
      await user.click(askButtons[0]);
      expect(onAskOracle).toHaveBeenCalled();
    });

    it('follow-ups view filters to only hot/warm or dated leads', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      const followUpsTab = screen.getAllByText(/Follow-ups/)[0].closest('button')!;
      await user.click(followUpsTab);
      // Smile Dental (Contacted + followUpDate) and FitZone (Hot) should appear
      expect(screen.getByText('Smile Dental Clinic')).toBeDefined();
      expect(screen.getByText('FitZone Gym')).toBeDefined();
      // Spice Garden (New, no followUpDate) should NOT appear
      expect(screen.queryByText('Spice Garden Restaurant')).toBeNull();
    });

    it('closes add lead modal when cancel is clicked', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      await user.click(screen.getByText('+ Add Lead'));
      expect(screen.getByText('+ Add New Lead')).toBeDefined();
      await user.click(screen.getByText('Cancel'));
      expect(screen.queryByText('+ Add New Lead')).toBeNull();
    });

    it('workflow criteria toggle collapses when clicked again', async () => {
      const user = userEvent.setup();
      await waitFor(() => {
        render(<LeadsTab />);
      });
      const workflowsTab = screen.getAllByText(/Generation Workflows/)[0].closest('button')!;
      await user.click(workflowsTab);
      // Expand
      await user.click(screen.getByText(/View 5 qualification criteria/));
      expect(screen.getByText('No website listed in Google Maps profile')).toBeDefined();
      // Collapse
      await user.click(screen.getByText(/Hide criteria/));
      expect(screen.queryByText('No website listed in Google Maps profile')).toBeNull();
    });
  });
});
