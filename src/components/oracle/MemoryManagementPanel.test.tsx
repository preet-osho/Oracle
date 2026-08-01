import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryManagementPanel } from './MemoryManagementPanel';

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

const mockMemoriesList = vi.fn();
const mockMemoriesUpdate = vi.fn();
const mockMemoriesDelete = vi.fn();
vi.mock('@/lib/api', () => ({
  memoriesApi: {
    list: (...args: unknown[]) => mockMemoriesList(...args),
    update: (...args: unknown[]) => mockMemoriesUpdate(...args),
    delete: (...args: unknown[]) => mockMemoriesDelete(...args),
  },
}));

vi.mock('@/lib/memory', () => ({
  formatMemoryForContext: vi.fn((memories: any[]) => {
    if (memories.length === 0) return '';
    return `What I remember about this client:\n${memories.map((m: any) => `  - [${m.category}] ${m.content}`).join('\n')}`;
  }),
}));

const SAMPLE_MEMORIES = [
  { id: 'm1', client_id: 'proj-1', content: 'Client prefers formal communication', category: 'preference', importance: 3, created_at: Date.now() - 1000 },
  { id: 'm2', client_id: 'proj-1', content: 'Business is based in Mumbai', category: 'fact', importance: 2, created_at: Date.now() - 2000 },
  { id: 'm3', client_id: 'proj-1', content: 'Client liked the proposal', category: 'feedback', importance: 1, created_at: Date.now() - 3000 },
];

// ─── Tests ─────────────────────────────

describe('MemoryManagementPanel', () => {
  const originalConfirm = window.confirm;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMemoriesList.mockResolvedValue(SAMPLE_MEMORIES);
    mockMemoriesUpdate.mockResolvedValue({ id: 'm1', content: 'Updated content', category: 'preference', importance: 3, created_at: Date.now() });
    mockMemoriesDelete.mockResolvedValue({ success: true });
    // Default: confirm returns true
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    window.confirm = originalConfirm;
  });

  // ── Rendering ──
  describe('rendering', () => {
    it('renders the header', async () => {
      await act(async () => { render(<MemoryManagementPanel projectId="proj-1" />); });
      expect(screen.getByText('🧠 Memory Management')).toBeDefined();
    });

    it('renders no project selected state when projectId is null', async () => {
      await act(async () => { render(<MemoryManagementPanel />); });
      expect(screen.getByText('No Project Selected')).toBeDefined();
    });

    it('loads memories on mount', async () => {
      await act(async () => { render(<MemoryManagementPanel projectId="proj-1" />); });
      expect(mockMemoriesList).toHaveBeenCalledWith('proj-1');
    });

    it('displays loaded memories', async () => {
      await act(async () => { render(<MemoryManagementPanel projectId="proj-1" />); });
      await waitFor(() => {
        expect(screen.getByText('Client prefers formal communication')).toBeDefined();
        expect(screen.getByText('Business is based in Mumbai')).toBeDefined();
        expect(screen.getByText('Client liked the proposal')).toBeDefined();
      });
    });

    it('shows memory count in header', async () => {
      await act(async () => { render(<MemoryManagementPanel projectId="proj-1" />); });
      await waitFor(() => {
        expect(screen.getByText(/3 total/)).toBeDefined();
      });
    });
  });

  // ── Search ──
  describe('search', () => {
    it('filters memories by search query', async () => {
      const user = userEvent.setup();
      render(<MemoryManagementPanel projectId="proj-1" />);
      await waitFor(() => { expect(screen.getByText('Client prefers formal communication')).toBeDefined(); });

      const searchInput = screen.getByPlaceholderText('Search memories...');
      await user.type(searchInput, 'Mumbai');

      await waitFor(() => {
        expect(screen.getByText('Business is based in Mumbai')).toBeDefined();
        expect(screen.queryByText('Client prefers formal communication')).toBeNull();
      });
    });

    it('clears search results when query is cleared', async () => {
      const user = userEvent.setup();
      render(<MemoryManagementPanel projectId="proj-1" />);
      await waitFor(() => { expect(screen.getByText('Client prefers formal communication')).toBeDefined(); });

      const searchInput = screen.getByPlaceholderText('Search memories...');
      await user.type(searchInput, 'Mumbai');
      await user.clear(searchInput);

      await waitFor(() => {
        expect(screen.getByText('Client prefers formal communication')).toBeDefined();
      });
    });
  });

  // ── Filters ──
  describe('filters', () => {
    it('filters by category', async () => {
      const user = userEvent.setup();
      render(<MemoryManagementPanel projectId="proj-1" />);
      await waitFor(() => { expect(screen.getByText('Client prefers formal communication')).toBeDefined(); });

      // Scope to the filter chip container to avoid matching memory category badges
      const filterChips = document.querySelectorAll('.flex.flex-wrap.gap-2 button');
      const factButton = Array.from(filterChips).find(b => b.textContent?.includes('fact'))!;
      await user.click(factButton);

      await waitFor(() => {
        expect(screen.getByText('Business is based in Mumbai')).toBeDefined();
        expect(screen.queryByText('Client prefers formal communication')).toBeNull();
      });
    });

    it('filters by importance', async () => {
      const user = userEvent.setup();
      render(<MemoryManagementPanel projectId="proj-1" />);
      await waitFor(() => { expect(screen.getByText('Client prefers formal communication')).toBeDefined(); });

      // Scope to the filter button container (ml-auto div) to avoid matching memory stars
      const filterContainer = document.querySelector('.ml-auto');
      const highButton = filterContainer!.querySelector('button:last-child')!;
      await user.click(highButton);

      await waitFor(() => {
        expect(screen.getByText('Client prefers formal communication')).toBeDefined();
        expect(screen.queryByText('Business is based in Mumbai')).toBeNull();
      });
    });
  });

  // ── Edit ──
  describe('edit', () => {
    it('enters edit mode when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(<MemoryManagementPanel projectId="proj-1" />);
      await waitFor(() => { expect(screen.getByText('Client prefers formal communication')).toBeDefined(); });

      const editButtons = screen.getAllByTitle('Edit memory');
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('💾 Save')).toBeDefined();
        expect(screen.getByText('Cancel')).toBeDefined();
      });
    });

    it('saves edited memory', async () => {
      const user = userEvent.setup();
      render(<MemoryManagementPanel projectId="proj-1" />);
      await waitFor(() => { expect(screen.getByText('Client prefers formal communication')).toBeDefined(); });

      const editButtons = screen.getAllByTitle('Edit memory');
      await user.click(editButtons[0]);

      await waitFor(() => { expect(screen.getByText('💾 Save')).toBeDefined(); });

      await user.click(screen.getByText('💾 Save'));

      await waitFor(() => {
        expect(mockMemoriesUpdate).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('updated'), expect.anything());
      });
    });

    it('cancels edit mode', async () => {
      const user = userEvent.setup();
      render(<MemoryManagementPanel projectId="proj-1" />);
      await waitFor(() => { expect(screen.getByText('Client prefers formal communication')).toBeDefined(); });

      const editButtons = screen.getAllByTitle('Edit memory');
      await user.click(editButtons[0]);

      await waitFor(() => { expect(screen.getByText('Cancel')).toBeDefined(); });

      await user.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('💾 Save')).toBeNull();
        expect(screen.getByText('Client prefers formal communication')).toBeDefined();
      });
    });
  });

  // ── Delete ──
  describe('delete', () => {
    it('deletes memory after confirmation', async () => {
      // confirm is already mocked to return true in beforeEach
      const user = userEvent.setup();
      render(<MemoryManagementPanel projectId="proj-1" />);
      await waitFor(() => { expect(screen.getByText('Client prefers formal communication')).toBeDefined(); });

      const deleteButtons = screen.getAllByTitle('Delete memory');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockMemoriesDelete).toHaveBeenCalledWith('m1');
      });
    });

    it('does not delete when confirmation is cancelled', async () => {
      // Override confirm to return false for this test only
      const falseConfirm = vi.fn(() => false);
      window.confirm = falseConfirm;
      const user = userEvent.setup();
      render(<MemoryManagementPanel projectId="proj-1" />);
      await waitFor(() => { expect(screen.getByText('Client prefers formal communication')).toBeDefined(); });

      const deleteButtons = screen.getAllByTitle('Delete memory');
      await user.click(deleteButtons[0]);

      // confirm was called but returned false, so delete should not be called
      await waitFor(() => {
        expect(falseConfirm).toHaveBeenCalled();
      });
      expect(mockMemoriesDelete).not.toHaveBeenCalled();
      expect(screen.getByText('Client prefers formal communication')).toBeDefined();
    });
  });

  // ── Empty States ──
  describe('empty states', () => {
    it('shows empty state when no memories exist', async () => {
      mockMemoriesList.mockResolvedValue([]);
      await act(async () => { render(<MemoryManagementPanel projectId="proj-1" />); });
      await waitFor(() => {
        expect(screen.getByText('No Memories Found')).toBeDefined();
      });
    });

    it('shows empty state when search returns no results', async () => {
      const user = userEvent.setup();
      render(<MemoryManagementPanel projectId="proj-1" />);
      await waitFor(() => { expect(screen.getByText('Client prefers formal communication')).toBeDefined(); });

      const searchInput = screen.getByPlaceholderText('Search memories...');
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No Memories Found')).toBeDefined();
      });
    });
  });

  // ── Context Preview ──
  describe('context preview', () => {
    it('shows context preview when memories exist', async () => {
      await act(async () => { render(<MemoryManagementPanel projectId="proj-1" />); });
      await waitFor(() => {
        expect(screen.getByText('📝 Context Preview')).toBeDefined();
      });
    });
  });
});
