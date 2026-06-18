import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ProjectsTab } from './ProjectsTab';

// ─── Mocks ─────────────────────────────

// Override design-tokens from setupTests for this file
vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {} },
  cardHoverProps: {},
  buttonTapProps: {},
}));

// Mock domains
vi.mock('@/data/domains', () => ({
  AGENCY_DOMAINS: [
    { id: 'seo', name: 'SEO', emoji: '🔍', category: 'Digital Marketing' },
    { id: 'web', name: 'Web Development', emoji: '🌐', category: 'Development' },
  ],
}));

// Mock jsPDF
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
  })),
}));

// Mock react-hot-toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(
    (...args: unknown[]) => mockToastSuccess(...args),
    { success: (...args: unknown[]) => mockToastSuccess(...args), error: (...args: unknown[]) => mockToastError(...args) }
  ),
  toast: Object.assign(
    (...args: unknown[]) => mockToastSuccess(...args),
    { success: (...args: unknown[]) => mockToastSuccess(...args), error: (...args: unknown[]) => mockToastError(...args) }
  ),
}));

// Mock API calls
const mockProjectsList = vi.fn();
const mockProjectsCreate = vi.fn();
const mockProjectsUpdate = vi.fn();
const mockProjectsDelete = vi.fn();
const mockTimeEntriesList = vi.fn();
const mockTimeEntriesCreate = vi.fn();
const mockInvoicesCreate = vi.fn();

vi.mock('@/lib/api', () => ({
  projectsApi: {
    list: (...args: unknown[]) => mockProjectsList(...args),
    create: (...args: unknown[]) => mockProjectsCreate(...args),
    update: (...args: unknown[]) => mockProjectsUpdate(...args),
    delete: (...args: unknown[]) => mockProjectsDelete(...args),
  },
  timeEntriesApi: {
    list: (...args: unknown[]) => mockTimeEntriesList(...args),
    create: (...args: unknown[]) => mockTimeEntriesCreate(...args),
  },
  invoicesApi: {
    create: (...args: unknown[]) => mockInvoicesCreate(...args),
  },
}));

// ─── Test Data ─────────────────────────

const MOCK_PROJECTS = [
  {
    id: 'p1',
    client_name: 'Acme Corp',
    industry: 'SEO',
    sector: 'Tech',
    service: 'SEO',
    status: 'Active',
    value: '₹1,50,000',
    deadline: '2026-12-31',
    city: 'Mumbai',
    notes: 'Important client',
    requirements: ['Rank on page 1', 'Local SEO'],
    contact_name: 'John Doe',
    contact_phone: '+919876543210',
    contact_email: 'john@acme.com',
    tags: ['priority'],
    total_hours: 40,
    invoice_total: 60000,
    created_at: Date.now(),
    updated_at: Date.now(),
  },
  {
    id: 'p2',
    client_name: 'Beta Inc',
    industry: 'Web Development',
    sector: 'E-commerce',
    service: 'Web Dev',
    status: 'Complete',
    value: '₹2,50,000',
    deadline: '2026-06-01',
    city: 'Delhi',
    notes: '',
    requirements: [],
    contact_name: 'Jane Smith',
    contact_phone: '+919876543211',
    contact_email: 'jane@beta.com',
    tags: [],
    total_hours: 80,
    invoice_total: 120000,
    created_at: Date.now(),
    updated_at: Date.now(),
  },
];

const MOCK_TIME_ENTRIES = [
  { id: 't1', client_id: 'p1', description: 'SEO audit', hours: 5, rate: 1500, date: Date.now(), billable: true },
  { id: 't2', client_id: 'p1', description: 'Keyword research', hours: 3, rate: 1500, date: Date.now(), billable: true },
  { id: 't3', client_id: 'p2', description: 'Design mockups', hours: 10, rate: 2000, date: Date.now(), billable: true },
];

// ─── Tests ─────────────────────────────

describe('ProjectsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectsList.mockResolvedValue(MOCK_PROJECTS);
    mockTimeEntriesList.mockResolvedValue(MOCK_TIME_ENTRIES);
    mockProjectsCreate.mockResolvedValue({ ...MOCK_PROJECTS[0], id: 'p3', client_name: 'New Client' });
    mockProjectsUpdate.mockResolvedValue(MOCK_PROJECTS[0]);
    mockProjectsDelete.mockResolvedValue({ success: true });
    mockTimeEntriesCreate.mockResolvedValue({ ...MOCK_TIME_ENTRIES[0], id: 't4' });
    mockInvoicesCreate.mockResolvedValue({ id: 'inv1' });
  });

  // ── Loading & Rendering ──

  describe('loading and rendering', () => {
    it('renders the projects header', async () => {
      render(<ProjectsTab />);
      expect(screen.getByText('📁 Projects')).toBeDefined();
      expect(screen.getByText(/Manage client projects/)).toBeDefined();
    });

    it('loads and displays projects on mount', async () => {
      render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeDefined();
        expect(screen.getByText('Beta Inc')).toBeDefined();
      });
      expect(mockProjectsList).toHaveBeenCalledTimes(1);
      expect(mockTimeEntriesList).toHaveBeenCalledTimes(1);
    });

    it('displays correct stats', async () => {
      render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('Total Projects')).toBeDefined();
        expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Pipeline Value')).toBeDefined();
        expect(screen.getByText('Overdue')).toBeDefined();
      });
    });

    it('shows empty state when no projects', async () => {
      mockProjectsList.mockResolvedValue([]);
      render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText(/No projects yet/)).toBeDefined();
      });
    });
  });

  // ── Filtering ──

  describe('filtering', () => {
    it('filters projects by search term', async () => {
      const user = userEvent.setup();
      render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('Search projects...');
      await user.type(searchInput, 'Acme');

      // Beta Inc should be filtered out
      expect(screen.queryByText('Beta Inc')).toBeNull();
      expect(screen.getByText('Acme Corp')).toBeDefined();
    });

    it('filters projects by status', async () => {
      const user = userEvent.setup();
      render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeDefined();
      });

      const statusSelect = screen.getByDisplayValue('All');
      await user.selectOptions(statusSelect, 'Active');

      expect(screen.getByText('Acme Corp')).toBeDefined();
      expect(screen.queryByText('Beta Inc')).toBeNull();
    });

    it('shows no match message when filters return empty', async () => {
      const user = userEvent.setup();
      render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('Search projects...');
      await user.type(searchInput, 'Nonexistent');

      expect(screen.getByText('No projects match your filters.')).toBeDefined();
    });
  });

  // ── Project Actions ──

  describe('project actions', () => {
    it('opens new project form when "+ New Project" is clicked', async () => {
      const user = userEvent.setup();
      render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeDefined();
      });

      await user.click(screen.getByText('+ New Project'));
      expect(screen.getByText('New Project')).toBeDefined();
      expect(screen.getByPlaceholderText('Client Name')).toBeDefined();
    });

    it('deletes a project when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeDefined();
      });

      // Click delete button for Acme Corp
      const deleteButtons = screen.getAllByText('🗑');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockProjectsDelete).toHaveBeenCalledWith('p1');
        expect(mockToastSuccess).toHaveBeenCalledWith(
          expect.stringContaining('Project deleted'),
          expect.objectContaining({ duration: 3000 })
        );
      });
    });

    it('shows success toast after creating a new project', async () => {
      const user = userEvent.setup();
      render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeDefined();
      });

      await user.click(screen.getByText('+ New Project'));
      await user.type(screen.getByPlaceholderText('Client Name'), 'New Client');
      await user.click(screen.getByText('Create Project'));

      await waitFor(() => {
        expect(mockProjectsCreate).toHaveBeenCalled();
        expect(mockToastSuccess).toHaveBeenCalledWith(
          expect.stringContaining('Project created'),
          expect.objectContaining({ duration: 3000 })
        );
      });
    });

    it('shows success toast after updating a project', async () => {
      const user = userEvent.setup();
      render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeDefined();
      });

      // Click edit button for Acme Corp
      const editButtons = screen.getAllByTitle('Edit');
      await user.click(editButtons[0]);

      // Update the name
      const nameInput = screen.getByPlaceholderText('Client Name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Acme Updated');
      await user.click(screen.getByText('Update Project'));

      await waitFor(() => {
        expect(mockProjectsUpdate).toHaveBeenCalled();
        expect(mockToastSuccess).toHaveBeenCalledWith(
          expect.stringContaining('Project updated'),
          expect.objectContaining({ duration: 3000 })
        );
      });
    });

    it('expands project details when clicked', async () => {
      const user = userEvent.setup();
      render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeDefined();
      });

      // Click on the project name to expand
      await user.click(screen.getByText('Acme Corp'));

      // Should show expanded details
      await waitFor(() => {
        expect(screen.getByText('Requirements')).toBeDefined();
        expect(screen.getByText('Rank on page 1')).toBeDefined();
        expect(screen.getByText('Contact')).toBeDefined();
      });
    });
  });

  // ── Time Tracking ──

  describe('time tracking', () => {
    it('opens time tracker modal when timer button is clicked', async () => {
      const user = userEvent.setup();
      render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeDefined();
      });

      const timerButtons = screen.getAllByTitle('Log Time');
      await user.click(timerButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Log Time/)).toBeDefined();
        expect(screen.getByText(/for Acme Corp/)).toBeDefined();
      });
    });

    it('shows time entries in expanded project', async () => {
      const user = userEvent.setup();
      render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeDefined();
      });

      // Expand the project
      await user.click(screen.getByText('Acme Corp'));

      await waitFor(() => {
        expect(screen.getByText(/Time Entries/)).toBeDefined();
        expect(screen.getByText('SEO audit')).toBeDefined();
        expect(screen.getByText('Keyword research')).toBeDefined();
      });
    });
  });

  // ── Invoice ──

  describe('invoice', () => {
    it('opens invoice modal when invoice button is clicked', async () => {
      const user = userEvent.setup();
      render(<ProjectsTab />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeDefined();
      });

      const invoiceButtons = screen.getAllByTitle('Invoice');
      await user.click(invoiceButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/📄 Invoice/)).toBeDefined();
        expect(screen.getByText('INVOICE TO')).toBeDefined();
      });
    });
  });
});
