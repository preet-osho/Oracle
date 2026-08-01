import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { WorkflowTemplatesPanel } from './WorkflowTemplatesPanel';

// ─── Mocks ─────────────────────────────

const mockToast = vi.fn();
const mockToastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(
    (...args: unknown[]) => mockToast(...args),
    { success: (...args: unknown[]) => mockToast(...args), error: (...args: unknown[]) => mockToastError(...args) }
  ) as any,
  toast: Object.assign(
    (...args: unknown[]) => mockToast(...args),
    { success: (...args: unknown[]) => mockToast(...args), error: (...args: unknown[]) => mockToastError(...args) }
  ) as any,
}));

const mockTemplatesList = vi.fn();
const mockTemplatesCreate = vi.fn();
const mockTemplatesUpdate = vi.fn();
const mockTemplatesDelete = vi.fn();
vi.mock('@/lib/api', () => ({
  workflowTemplatesApi: {
    list: (...args: unknown[]) => mockTemplatesList(...args),
    create: (...args: unknown[]) => mockTemplatesCreate(...args),
    update: (...args: unknown[]) => mockTemplatesUpdate(...args),
    delete: (...args: unknown[]) => mockTemplatesDelete(...args),
  },
}));

const SAMPLE_TEMPLATES = [
  {
    id: 'wt-1', org_id: 'org-1', name: 'New Client Onboarding',
    description: 'Complete onboarding workflow', color: '#3b82f6',
    estimated_time: '2-3 hours', domains: ['Development', 'Design'],
    steps: [
      { id: 's1', name: 'Research Client', description: 'Research the client', prompt: 'Research the client business' },
      { id: 's2', name: 'Set Up Project', description: 'Create project structure', prompt: 'Create project files' },
    ],
    is_builtin: false, use_count: 5, created_at: Date.now(), updated_at: Date.now(),
  },
  {
    id: 'wt-2', org_id: 'org-1', name: 'Monthly Audit',
    description: 'Monthly client performance audit', color: '#10b981',
    estimated_time: '3-4 hours', domains: ['SEO', 'Content'],
    steps: [
      { id: 's3', name: 'SEO Audit', description: 'Run SEO checks', prompt: 'Audit SEO performance' },
      { id: 's4', name: 'Content Review', description: 'Review content', prompt: 'Review all content' },
      { id: 's5', name: 'Report', description: 'Generate report', prompt: 'Generate monthly report' },
    ],
    is_builtin: true, use_count: 12, created_at: Date.now(), updated_at: Date.now(),
  },
];

const newTemplate = {
  id: 'wt-3', org_id: 'org-1', name: 'Emergency Response',
    description: 'Handle urgent issues', color: '#f59e0b',
    estimated_time: '1 hour', domains: ['Operations'],
    steps: [
      { id: 's6', name: 'Triage', description: 'Assess the issue', prompt: 'Triage the emergency' },
    ],
    is_builtin: false, use_count: 0, created_at: Date.now(), updated_at: Date.now(),
};

// ─── Tests ─────────────────────────────

describe('WorkflowTemplatesPanel', () => {
  const originalConfirm = window.confirm;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTemplatesList.mockResolvedValue(SAMPLE_TEMPLATES);
    mockTemplatesCreate.mockResolvedValue(newTemplate);
    mockTemplatesUpdate.mockResolvedValue({ ...SAMPLE_TEMPLATES[0], use_count: 6 });
    mockTemplatesDelete.mockResolvedValue({ success: true });
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    window.confirm = originalConfirm;
  });

  // ── Rendering ──
  describe('rendering', () => {
    it('renders the header', async () => {
      await act(async () => { render(<WorkflowTemplatesPanel />); });
      expect(screen.getByText('🔄 Workflow Templates')).toBeDefined();
    });

    it('loads templates on mount', async () => {
      await act(async () => { render(<WorkflowTemplatesPanel />); });
      expect(mockTemplatesList).toHaveBeenCalled();
    });

    it('displays loaded templates', async () => {
      await act(async () => { render(<WorkflowTemplatesPanel />); });
      await waitFor(() => {
        expect(screen.getByText('New Client Onboarding')).toBeDefined();
        expect(screen.getByText('Monthly Audit')).toBeDefined();
      });
    });

    it('shows template count in header', async () => {
      await act(async () => { render(<WorkflowTemplatesPanel />); });
      await waitFor(() => {
        expect(screen.getByText(/2 total/)).toBeDefined();
      });
    });

    it('shows step count for each template', async () => {
      await act(async () => { render(<WorkflowTemplatesPanel />); });
      await waitFor(() => {
        expect(screen.getByText(/📋 2 steps/)).toBeDefined();
        expect(screen.getByText(/📋 3 steps/)).toBeDefined();
      });
    });

    it('shows estimated time for each template', async () => {
      await act(async () => { render(<WorkflowTemplatesPanel />); });
      await waitFor(() => {
        expect(screen.getByText(/⏱ 2-3 hours/)).toBeDefined();
        expect(screen.getByText(/⏱ 3-4 hours/)).toBeDefined();
      });
    });

    it('shows run count for each template', async () => {
      await act(async () => { render(<WorkflowTemplatesPanel />); });
      await waitFor(() => {
        expect(screen.getByText(/🚀 5 runs/)).toBeDefined();
        expect(screen.getByText(/🚀 12 runs/)).toBeDefined();
      });
    });

    it('shows built-in badge for built-in templates', async () => {
      await act(async () => { render(<WorkflowTemplatesPanel />); });
      await waitFor(() => {
        expect(screen.getByText('Built-in')).toBeDefined();
      });
    });

    it('does not show edit/delete for built-in templates', async () => {
      await act(async () => { render(<WorkflowTemplatesPanel />); });
      await waitFor(() => {
        expect(screen.getByText('Monthly Audit')).toBeDefined();
      });
      // Built-in template should not have edit/delete buttons
      const editButtons = screen.getAllByTitle('Edit');
      const deleteButtons = screen.getAllByTitle('Delete');
      // Only 1 template (non-built-in) should have edit/delete
      expect(editButtons.length).toBe(1);
      expect(deleteButtons.length).toBe(1);
    });
  });

  // ── Search ──
  describe('search', () => {
    it('filters templates by search query', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      const searchInput = screen.getByPlaceholderText('Search templates...');
      await user.type(searchInput, 'Audit');

      await waitFor(() => {
        expect(screen.getByText('Monthly Audit')).toBeDefined();
        expect(screen.queryByText('New Client Onboarding')).toBeNull();
      });
    });

    it('shows empty state when search returns no results', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      const searchInput = screen.getByPlaceholderText('Search templates...');
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No Templates Found')).toBeDefined();
      });
    });
  });

  // ── Create ──
  describe('create', () => {
    it('shows create form when New Template button is clicked', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      await user.click(screen.getByText('+ New Template'));

      await waitFor(() => {
        expect(screen.getByText('➕ Create New Template')).toBeDefined();
        expect(screen.getByText('💾 Create Template')).toBeDefined();
      });
    });

    it('validates name is required', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      await user.click(screen.getByText('+ New Template'));
      await waitFor(() => { expect(screen.getByText('💾 Create Template')).toBeDefined(); });

      // Try to save without name
      await user.click(screen.getByText('💾 Create Template'));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Name is required'), expect.anything());
      });
    });

    it('validates steps need name and prompt', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      await user.click(screen.getByText('+ New Template'));
      await waitFor(() => { expect(screen.getByText('💾 Create Template')).toBeDefined(); });

      // Fill in name but leave step empty
      const nameInput = screen.getByPlaceholderText('e.g., New Client Onboarding');
      await user.type(nameInput, 'Test Workflow');

      // Try to save without step name/prompt
      await user.click(screen.getByText('💾 Create Template'));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('All steps need a name and prompt'), expect.anything());
      });
    });

    it('creates template with valid data', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      await user.click(screen.getByText('+ New Template'));
      await waitFor(() => { expect(screen.getByText('💾 Create Template')).toBeDefined(); });

      // Fill in name
      const nameInput = screen.getByPlaceholderText('e.g., New Client Onboarding');
      await user.type(nameInput, 'Emergency Response');

      // Fill in step name and prompt
      const stepNameInput = screen.getByPlaceholderText('Step name');
      await user.type(stepNameInput, 'Triage');

      const stepPromptInput = screen.getByPlaceholderText('Prompt for this step...');
      await user.type(stepPromptInput, 'Triage the emergency');

      await user.click(screen.getByText('💾 Create Template'));

      await waitFor(() => {
        expect(mockTemplatesCreate).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('created'), expect.anything());
      });
    });

    it('adds additional steps', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      await user.click(screen.getByText('+ New Template'));
      await waitFor(() => { expect(screen.getByText('💾 Create Template')).toBeDefined(); });

      // Add a step
      await user.click(screen.getByText('+ Add Step'));

      // Should now have 2 step name inputs
      const stepInputs = screen.getAllByPlaceholderText('Step name');
      expect(stepInputs.length).toBe(2);
    });

    it('removes steps when there are multiple', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      await user.click(screen.getByText('+ New Template'));
      await waitFor(() => { expect(screen.getByText('💾 Create Template')).toBeDefined(); });

      // Add a second step
      await user.click(screen.getByText('+ Add Step'));
      let stepInputs = screen.getAllByPlaceholderText('Step name');
      expect(stepInputs.length).toBe(2);

      // Remove the second step
      const removeButtons = screen.getAllByText('✕');
      await user.click(removeButtons[removeButtons.length - 1]);

      stepInputs = screen.getAllByPlaceholderText('Step name');
      expect(stepInputs.length).toBe(1);
    });

    it('does not show remove button when only one step exists', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      await user.click(screen.getByText('+ New Template'));
      await waitFor(() => { expect(screen.getByText('💾 Create Template')).toBeDefined(); });

      // Single step should not have a remove button
      expect(screen.queryByText('✕')).toBeNull();
    });

    it('cancels form when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      await user.click(screen.getByText('+ New Template'));
      await waitFor(() => { expect(screen.getByText('➕ Create New Template')).toBeDefined(); });

      await user.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('➕ Create New Template')).toBeNull();
        expect(screen.getByText('New Client Onboarding')).toBeDefined();
      });
    });
  });

  // ── Edit ──
  describe('edit', () => {
    it('enters edit mode when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      const editButtons = screen.getAllByTitle('Edit');
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Template')).toBeDefined();
        expect(screen.getByText('💾 Update Template')).toBeDefined();
      });
    });

    it('pre-fills form with template data in edit mode', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      const editButtons = screen.getAllByTitle('Edit');
      await user.click(editButtons[0]);

      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('e.g., New Client Onboarding') as HTMLInputElement;
        expect(nameInput.value).toBe('New Client Onboarding');
      });
    });

    it('updates template when form is submitted', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      const editButtons = screen.getAllByTitle('Edit');
      await user.click(editButtons[0]);

      await waitFor(() => { expect(screen.getByText('💾 Update Template')).toBeDefined(); });

      await user.click(screen.getByText('💾 Update Template'));

      await waitFor(() => {
        expect(mockTemplatesUpdate).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('updated'), expect.anything());
      });
    });
  });

  // ── Delete ──
  describe('delete', () => {
    it('deletes template after confirmation', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      const deleteButtons = screen.getAllByTitle('Delete');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalled();
        expect(mockTemplatesDelete).toHaveBeenCalledWith('wt-1');
      });
    });

    it('does not delete when confirmation is cancelled', async () => {
      const falseConfirm = vi.fn(() => false);
      window.confirm = falseConfirm;
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      const deleteButtons = screen.getAllByTitle('Delete');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(falseConfirm).toHaveBeenCalled();
      });
      expect(mockTemplatesDelete).not.toHaveBeenCalled();
    });
  });

  // ── Run Workflow ──
  describe('run workflow', () => {
    it('calls onRunWorkflow with combined step prompts', async () => {
      const mockOnRun = vi.fn();
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel onRunWorkflow={mockOnRun} />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      const runButtons = screen.getAllByText('▶ Run');
      await user.click(runButtons[0]);

      await waitFor(() => {
        expect(mockOnRun).toHaveBeenCalled();
        const prompt = mockOnRun.mock.calls[0][0];
        expect(prompt).toContain('Research Client');
        expect(prompt).toContain('Research the client business');
        expect(prompt).toContain('Set Up Project');
        expect(prompt).toContain('Create project files');
        expect(prompt).toContain('---');
      });
    });

    it('increments use count when running', async () => {
      const mockOnRun = vi.fn();
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel onRunWorkflow={mockOnRun} />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      const runButtons = screen.getAllByText('▶ Run');
      await user.click(runButtons[0]);

      await waitFor(() => {
        expect(mockTemplatesUpdate).toHaveBeenCalledWith('wt-1', { use_count: 6 });
      });
    });
  });

  // ── Domain Filter ──
  describe('domain filter', () => {
    it('filters templates by domain', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      // Click on 'SEO' filter — find all buttons with that text and click the filter one (not a domain chip in a card)
      const seoButtons = screen.getAllByText('SEO');
      // The filter button is inside the search/filter container, not inside a template card
      const seoButton = seoButtons.find(el => el.closest('.oracle-glass') && !el.closest('.oracle-glass')?.querySelector('[class*="truncate"]'))!;
      await user.click(seoButton);

      await waitFor(() => {
        expect(screen.getByText('Monthly Audit')).toBeDefined();
        expect(screen.queryByText('New Client Onboarding')).toBeNull();
      });
    });
  });

  // ── Empty States ──
  describe('empty states', () => {
    it('shows empty state when no templates exist', async () => {
      mockTemplatesList.mockResolvedValue([]);
      await act(async () => { render(<WorkflowTemplatesPanel />); });
      await waitFor(() => {
        expect(screen.getByText('No Templates Found')).toBeDefined();
        expect(screen.getByText('Create your first workflow template to get started.')).toBeDefined();
      });
    });

    it('shows different empty message when filtering with no results', async () => {
      const user = userEvent.setup();
      render(<WorkflowTemplatesPanel />);
      await waitFor(() => { expect(screen.getByText('New Client Onboarding')).toBeDefined(); });

      const searchInput = screen.getByPlaceholderText('Search templates...');
      await user.type(searchInput, 'zzz no match');

      await waitFor(() => {
        expect(screen.getByText('Try adjusting your search or filters.')).toBeDefined();
      });
    });
  });
});
