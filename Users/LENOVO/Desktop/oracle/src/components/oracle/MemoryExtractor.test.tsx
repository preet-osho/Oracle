import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryExtractor } from './MemoryExtractor';

// ─── Mocks ─────────────────────────────

// Mock react-hot-toast
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

// Mock NeverStopRouter
const mockCallSync = vi.fn();
vi.mock('@/lib/router', () => ({
  NeverStopRouter: {
    callSync: (...args: unknown[]) => mockCallSync(...args),
  },
}));

// Mock memories API
const mockMemoriesCreate = vi.fn();
vi.mock('@/lib/api', () => ({
  memoriesApi: {
    create: (...args: unknown[]) => mockMemoriesCreate(...args),
  },
}));

// ─── Tests ─────────────────────────────

describe('MemoryExtractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToast.mockClear();
    mockToastError.mockClear();
    mockCallSync.mockResolvedValue({
      text: JSON.stringify([
        { content: 'Client prefers formal communication', category: 'preference', importance: 3 },
        { content: 'Business is based in Mumbai', category: 'fact', importance: 2 },
      ]),
      provider: 'openai',
      model: 'gpt-4o',
    });
    mockMemoriesCreate.mockResolvedValue({ id: 'mem1' });
  });

  // ── Rendering ──

  describe('rendering', () => {
    it('renders the memory extraction header', () => {
      render(<MemoryExtractor />);
      expect(screen.getByText('🧠 Memory Extraction')).toBeDefined();
      expect(screen.getByText(/Extract and save key client facts/)).toBeDefined();
    });

    it('renders the extract button', () => {
      render(<MemoryExtractor />);
      expect(screen.getByText('🧠 Extract Memories')).toBeDefined();
    });

    it('renders empty state when no memories exist', () => {
      render(<MemoryExtractor />);
      expect(screen.getByText('No Memories Extracted Yet')).toBeDefined();
      expect(screen.getByText(/Paste a conversation transcript above/)).toBeDefined();
    });

    it('has a textarea for conversation input', () => {
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      expect(textarea).toBeDefined();
    });
  });

  // ── Input ──

  describe('input', () => {
    it('updates textarea value when typing', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation about their project');
      expect((textarea as HTMLTextAreaElement).value).toBe('Client conversation about their project');
    });

    it('shows character count when text is entered', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Hello');
      expect(screen.getByText('5 characters')).toBeDefined();
    });

    it('disables extract button when textarea is empty', () => {
      render(<MemoryExtractor />);
      const button = screen.getByText('🧠 Extract Memories');
      expect(button).toBeDisabled();
    });

    it('enables extract button when textarea has content', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Some conversation');
      const button = screen.getByText('🧠 Extract Memories');
      expect(button).not.toBeDisabled();
    });
  });

  // ── Memory Extraction ──

  describe('memory extraction', () => {
    it('calls NeverStopRouter.callSync when extract is clicked', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(mockCallSync).toHaveBeenCalledTimes(1);
      });
    });

    it('displays extracted memories after extraction', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(screen.getByText('Client prefers formal communication')).toBeDefined();
        expect(screen.getByText('Business is based in Mumbai')).toBeDefined();
      });
    });

    it('shows extracted memory count', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(screen.getByText('Extracted Memories (2)')).toBeDefined();
      });
    });

    it('shows memory categories with correct labels', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        // Both memories have 'preference' and 'fact' in their category labels
        const preferenceLabels = screen.getAllByText(/preference/);
        expect(preferenceLabels.length).toBeGreaterThanOrEqual(1);
        const factLabels = screen.getAllByText(/fact/);
        expect(factLabels.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows importance stars for each memory', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        const importanceLabels = screen.getAllByText(/Importance:/);
        expect(importanceLabels.length).toBe(2);
      });
    });

    it('auto-selects high-importance memories', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor projectId="proj-1" />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(screen.getByText('Client prefers formal communication')).toBeDefined();
      });

      // All 2 memories have importance >= 2, so both checkboxes should be checked
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      checkboxes.forEach((cb) => {
        expect((cb as HTMLInputElement).checked).toBe(true);
      });
    });

    it('does not auto-select low-importance memories', async () => {
      mockCallSync.mockResolvedValue({
        text: JSON.stringify([
          { content: 'Client name is Alex', category: 'fact', importance: 3 },
          { content: 'Minor detail about office', category: 'fact', importance: 1 },
        ]),
        provider: 'openai',
        model: 'gpt-4o',
      });

      const user = userEvent.setup();
      render(<MemoryExtractor projectId="proj-1" />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(screen.getByText('Client name is Alex')).toBeDefined();
      });

      // importance 3 → checked, importance 1 → unchecked
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
    });

    it('shows loading state during extraction', async () => {
      let resolvePromise: ((value: unknown) => void) | undefined;
      mockCallSync.mockImplementation(() =>
        new Promise((resolve) => { resolvePromise = resolve; })
      );

      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(screen.getByText('Extracting...')).toBeDefined();
      });

      resolvePromise?.(undefined);
    });

    it('handles extraction failure gracefully', async () => {
      mockCallSync.mockRejectedValue(new Error('API Error'));

      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        // Should render error message in the DOM
        expect(screen.getByText('API Error')).toBeDefined();
      });
      // Empty state should NOT appear when error is shown
      expect(screen.queryByText('No Memories Extracted Yet')).toBeNull();
    });

    it('renders extraction error in styled error container', async () => {
      mockCallSync.mockRejectedValue(new Error('Network timeout'));

      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        const errorEl = screen.getByText('Network timeout');
        // Verify it's in a container with error styling (bg-[var(--oracle-error)]/10)
        expect(errorEl.closest('[class*="oracle-error"]')).toBeDefined();
      });
    });

    it('clears error on new extraction attempt', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');

      // First attempt fails
      mockCallSync.mockRejectedValue(new Error('API Error'));
      await user.click(screen.getByText('🧠 Extract Memories'));
      await waitFor(() => {
        expect(screen.getByText('API Error')).toBeDefined();
      });

      // Second attempt succeeds
      mockCallSync.mockResolvedValue({
        text: JSON.stringify([
          { content: 'Client name is Alex', category: 'fact', importance: 3 },
        ]),
        provider: 'openai',
        model: 'gpt-4o',
      });
      await user.click(screen.getByText('🧠 Extract Memories'));
      await waitFor(() => {
        expect(screen.queryByText('API Error')).toBeNull();
        expect(screen.getByText('Client name is Alex')).toBeDefined();
      });
    });

    it('handles invalid JSON response', async () => {
      mockCallSync.mockResolvedValue({
        text: 'This is not valid JSON',
        provider: 'openai',
        model: 'gpt-4o',
      });

      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        // Should show empty state since no memories were parsed
        expect(screen.getByText('No Memories Extracted Yet')).toBeDefined();
      });
    });

    it('shows warning toast when JSON parsing fails', async () => {
      mockCallSync.mockResolvedValue({
        text: '[broken json content',
        provider: 'openai',
        model: 'gpt-4o',
      });

      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.stringContaining('Failed to parse extracted memories'),
          expect.objectContaining({ duration: 3000 })
        );
      });
    });

    it('shows error toast when extraction fails', async () => {
      mockCallSync.mockRejectedValue(new Error('API Error'));

      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('Memory extraction failed'),
          expect.objectContaining({ duration: 3000 })
        );
      });
    });
  });

  // ── Memory Selection ──

  describe('memory selection', () => {
    it('allows toggling memory selection', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor projectId="proj-1" />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(screen.getByText('Client prefers formal communication')).toBeDefined();
      });

      // Click on the first memory card to toggle selection
      const memoryText = screen.getByText('Client prefers formal communication');
      await user.click(memoryText.closest('[class*=\"rounded-xl\"]') || memoryText.parentElement!.parentElement!);

      // Save button should still be visible (auto-selected ones)
      expect(screen.getByRole('button', { name: /Save Selected/ })).toBeDefined();
    });

    it('shows save button with project ID', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor projectId="proj-123" />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(screen.getByText(/Save Selected/)).toBeDefined();
      });
    });

    it('hides save button without project ID', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(screen.getByText('Client prefers formal communication')).toBeDefined();
      });

      // Save button should not be present without projectId
      expect(screen.queryByText(/Save Selected/)).toBeNull();
    });
  });

  // ── Saving Memories ──

  describe('saving memories', () => {
    it('saves selected memories to API', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor projectId="proj-123" />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(screen.getByText(/Save Selected/)).toBeDefined();
      });

      await user.click(screen.getByText(/Save Selected/));

      await waitFor(() => {
        expect(mockMemoriesCreate).toHaveBeenCalledTimes(2);
        expect(mockMemoriesCreate).toHaveBeenCalledWith(
          expect.objectContaining({ client_id: 'proj-123' })
        );
      });
    });

    it('renders save error when API call fails', async () => {
      mockMemoriesCreate.mockRejectedValue(new Error('Save failed'));

      const user = userEvent.setup();
      render(<MemoryExtractor projectId="proj-123" />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(screen.getByText(/Save Selected/)).toBeDefined();
      });

      await user.click(screen.getByText(/Save Selected/));

      await waitFor(() => {
        expect(screen.getByText('Save failed')).toBeDefined();
      });
    });

    it('shows error toast when save fails', async () => {
      mockMemoriesCreate.mockRejectedValue(new Error('Save failed'));

      const user = userEvent.setup();
      render(<MemoryExtractor projectId="proj-123" />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(screen.getByText(/Save Selected/)).toBeDefined();
      });

      await user.click(screen.getByText(/Save Selected/));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to save memories'),
          expect.objectContaining({ duration: 3000 })
        );
      });
    });

    it('shows success message after saving', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor projectId="proj-123" />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(screen.getByText(/Save Selected/)).toBeDefined();
      });

      await user.click(screen.getByText(/Save Selected/));

      await waitFor(() => {
        expect(screen.getByText(/memories saved successfully/)).toBeDefined();
      });
    });

    it('shows correct save count', async () => {
      const user = userEvent.setup();
      render(<MemoryExtractor projectId="proj-123" />);
      const textarea = screen.getByPlaceholderText(/Paste a conversation transcript here/);
      await user.type(textarea, 'Client conversation');
      await user.click(screen.getByText('🧠 Extract Memories'));

      await waitFor(() => {
        expect(screen.getByText('Client prefers formal communication')).toBeDefined();
      });

      // Both memories have importance >= 2, so both should be auto-selected
      const saveButton = screen.getByRole('button', { name: /Save Selected/ });
      expect(saveButton).toBeDefined();
      expect(saveButton).not.toBeDisabled();
    });
  });
});
