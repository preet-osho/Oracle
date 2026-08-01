import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { VoiceAgentTab } from './VoiceAgentTab';

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

const mockVoiceAgentsList = vi.fn();
const mockVoiceAgentsCreate = vi.fn();
const mockVoiceAgentsUpdate = vi.fn();
const mockVoiceAgentsDelete = vi.fn();
const mockCallLogsList = vi.fn();
vi.mock('@/lib/api', () => ({
  voiceAgentsApi: {
    list: (...args: unknown[]) => mockVoiceAgentsList(...args),
    create: (...args: unknown[]) => mockVoiceAgentsCreate(...args),
    update: (...args: unknown[]) => mockVoiceAgentsUpdate(...args),
    delete: (...args: unknown[]) => mockVoiceAgentsDelete(...args),
  },
  callLogsApi: {
    list: (...args: unknown[]) => mockCallLogsList(...args),
    create: vi.fn(),
  },
}));

vi.mock('@/lib/utils', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

const SAMPLE_AGENTS = [
  { id: 'va-1', org_id: 'org-1', name: 'Receptionist Bot', provider: 'vapi', voice: 'Aria (Female, Professional)', language: 'English', greeting: 'Hi! How can I help?', instructions: 'Be a receptionist', tools: ['Book Appointment'], is_active: true, config: {}, created_at: Date.now(), updated_at: Date.now() },
  { id: 'va-2', org_id: 'org-1', name: 'Hindi Support Bot', provider: 'sarvam', voice: 'hindi-female-1', language: 'Hindi', greeting: 'Namaste!', instructions: 'Help in Hindi', tools: ['Check Order Status'], is_active: false, config: {}, created_at: Date.now(), updated_at: Date.now() },
];

const SAMPLE_LOGS = [
  { id: 'cl-1', org_id: 'org-1', agent_id: 'va-1', caller_number: '+91 98XXX', duration: 120, status: 'completed', transcript: 'Hello!', sentiment: 'positive', summary: 'Good call', metadata: {}, created_at: Date.now() - 3600000 },
  { id: 'cl-2', org_id: 'org-1', agent_id: 'va-2', caller_number: '+91 87XXX', duration: 90, status: 'missed', transcript: '', sentiment: 'neutral', summary: '', metadata: {}, created_at: Date.now() - 7200000 },
];

const newAgent = {
  id: 'va-3', org_id: 'org-1', name: 'Clinic Bot', provider: 'sarvam', voice: 'hindi-female-1', language: 'Hindi', greeting: 'Namaste!', instructions: 'Help callers', tools: [], is_active: false, config: {}, created_at: Date.now(), updated_at: Date.now(),
};

// ─── Tests ─────────────────────────────

describe('VoiceAgentTab', () => {
  const originalConfirm = window.confirm;

  beforeEach(() => {
    vi.clearAllMocks();
    mockVoiceAgentsList.mockResolvedValue(SAMPLE_AGENTS);
    mockVoiceAgentsCreate.mockResolvedValue(newAgent);
    mockVoiceAgentsUpdate.mockResolvedValue({ ...SAMPLE_AGENTS[0], name: 'Updated Bot' });
    mockVoiceAgentsDelete.mockResolvedValue({ success: true });
    mockCallLogsList.mockResolvedValue(SAMPLE_LOGS);
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    window.confirm = originalConfirm;
  });

  // ── Rendering ──
  describe('rendering', () => {
    it('renders the header', async () => {
      await act(async () => { render(<VoiceAgentTab />); });
      expect(screen.getByText('🎙️ Voice Agent Builder')).toBeDefined();
    });

    it('loads agents and logs on mount', async () => {
      await act(async () => { render(<VoiceAgentTab />); });
      expect(mockVoiceAgentsList).toHaveBeenCalled();
      expect(mockCallLogsList).toHaveBeenCalled();
    });

    it('displays provider cards', async () => {
      await act(async () => { render(<VoiceAgentTab />); });
      expect(screen.getByText('Vapi')).toBeDefined();
      expect(screen.getByText('Sarvam AI')).toBeDefined();
      expect(screen.getByText('ElevenLabs')).toBeDefined();
      expect(screen.getByText('Bland.ai')).toBeDefined();
    });

    it('displays loaded agents', async () => {
      await act(async () => { render(<VoiceAgentTab />); });
      await waitFor(() => {
        expect(screen.getByText('Receptionist Bot')).toBeDefined();
        expect(screen.getByText('Hindi Support Bot')).toBeDefined();
      });
    });

    it('shows summary stats', async () => {
      await act(async () => { render(<VoiceAgentTab />); });
      await waitFor(() => {
        expect(screen.getByText('Agents')).toBeDefined();
        expect(screen.getByText('Active')).toBeDefined();
        expect(screen.getByText('Total Calls')).toBeDefined();
      });
    });
  });

  // ── Search ──
  describe('search', () => {
    it('filters agents by search query', async () => {
      const user = userEvent.setup();
      render(<VoiceAgentTab />);
      await waitFor(() => { expect(screen.getByText('Receptionist Bot')).toBeDefined(); });

      const searchInput = screen.getByPlaceholderText('Search agents...');
      await user.type(searchInput, 'Hindi');

      await waitFor(() => {
        expect(screen.getByText('Hindi Support Bot')).toBeDefined();
        expect(screen.queryByText('Receptionist Bot')).toBeNull();
      });
    });
  });

  // ── Create ──
  describe('create', () => {
    it('shows create form when New Agent button is clicked', async () => {
      const user = userEvent.setup();
      render(<VoiceAgentTab />);
      await waitFor(() => { expect(screen.getByText('Receptionist Bot')).toBeDefined(); });

      await user.click(screen.getByText('+ New Agent'));

      await waitFor(() => {
        expect(screen.getByText('➕ Create New Voice Agent')).toBeDefined();
        expect(screen.getByText('🚀 Create Agent')).toBeDefined();
      });
    });

    it('validates name is required', async () => {
      const user = userEvent.setup();
      render(<VoiceAgentTab />);
      await waitFor(() => { expect(screen.getByText('Receptionist Bot')).toBeDefined(); });

      await user.click(screen.getByText('+ New Agent'));
      await waitFor(() => { expect(screen.getByText('🚀 Create Agent')).toBeDefined(); });

      await user.click(screen.getByText('🚀 Create Agent'));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Name required'), expect.anything());
      });
    });

    it('creates agent with valid data', async () => {
      const user = userEvent.setup();
      render(<VoiceAgentTab />);
      await waitFor(() => { expect(screen.getByText('Receptionist Bot')).toBeDefined(); });

      await user.click(screen.getByText('+ New Agent'));
      await waitFor(() => { expect(screen.getByText('🚀 Create Agent')).toBeDefined(); });

      const nameInput = screen.getByPlaceholderText('e.g., Clinic Receptionist');
      await user.type(nameInput, 'Clinic Bot');

      await user.click(screen.getByText('🚀 Create Agent'));

      await waitFor(() => {
        expect(mockVoiceAgentsCreate).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('created'), expect.anything());
      });
    });

    it('cancels form when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<VoiceAgentTab />);
      await waitFor(() => { expect(screen.getByText('Receptionist Bot')).toBeDefined(); });

      await user.click(screen.getByText('+ New Agent'));
      await waitFor(() => { expect(screen.getByText('➕ Create New Voice Agent')).toBeDefined(); });

      await user.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('➕ Create New Voice Agent')).toBeNull();
      });
    });
  });

  // ── Edit ──
  describe('edit', () => {
    it('enters edit mode when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(<VoiceAgentTab />);
      await waitFor(() => { expect(screen.getByText('Receptionist Bot')).toBeDefined(); });

      const editButtons = screen.getAllByTitle('Edit');
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Voice Agent')).toBeDefined();
        expect(screen.getByText('💾 Update Agent')).toBeDefined();
      });
    });

    it('pre-fills form with agent data in edit mode', async () => {
      const user = userEvent.setup();
      render(<VoiceAgentTab />);
      await waitFor(() => { expect(screen.getByText('Receptionist Bot')).toBeDefined(); });

      const editButtons = screen.getAllByTitle('Edit');
      await user.click(editButtons[0]);

      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('e.g., Clinic Receptionist') as HTMLInputElement;
        expect(nameInput.value).toBe('Receptionist Bot');
      });
    });
  });

  // ── Delete ──
  describe('delete', () => {
    it('deletes agent after confirmation', async () => {
      const user = userEvent.setup();
      render(<VoiceAgentTab />);
      await waitFor(() => { expect(screen.getByText('Receptionist Bot')).toBeDefined(); });

      const deleteButtons = screen.getAllByTitle('Delete');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalled();
        expect(mockVoiceAgentsDelete).toHaveBeenCalledWith('va-1');
      });
    });

    it('does not delete when confirmation is cancelled', async () => {
      const falseConfirm = vi.fn(() => false);
      window.confirm = falseConfirm;
      const user = userEvent.setup();
      render(<VoiceAgentTab />);
      await waitFor(() => { expect(screen.getByText('Receptionist Bot')).toBeDefined(); });

      const deleteButtons = screen.getAllByTitle('Delete');
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(falseConfirm).toHaveBeenCalled();
      });
      expect(mockVoiceAgentsDelete).not.toHaveBeenCalled();
    });
  });

  // ── Toggle ──
  describe('toggle', () => {
    it('toggles agent active state', async () => {
      const user = userEvent.setup();
      render(<VoiceAgentTab />);
      await waitFor(() => { expect(screen.getByText('Receptionist Bot')).toBeDefined(); });

      const liveButtons = screen.getAllByText('● Live');
      await user.click(liveButtons[0]);

      await waitFor(() => {
        expect(mockVoiceAgentsUpdate).toHaveBeenCalledWith('va-1', { is_active: false });
      });
    });
  });

  // ── View Tabs ──
  describe('view tabs', () => {
    it('switches to call logs view', async () => {
      const user = userEvent.setup();
      render(<VoiceAgentTab />);
      await waitFor(() => { expect(screen.getByText('Receptionist Bot')).toBeDefined(); });

      await user.click(screen.getByText('📞 Call Logs'));

      await waitFor(() => {
        expect(screen.getByText('+91 98XXX')).toBeDefined();
      });
    });

    it('shows empty state when no call logs', async () => {
      mockCallLogsList.mockResolvedValue([]);
      const user = userEvent.setup();
      render(<VoiceAgentTab />);
      await waitFor(() => { expect(screen.getByText('Receptionist Bot')).toBeDefined(); });

      await user.click(screen.getByText('📞 Call Logs'));

      await waitFor(() => {
        expect(screen.getByText('No Call Logs')).toBeDefined();
      });
    });
  });

  // ── Empty States ──
  describe('empty states', () => {
    it('shows empty state when no agents exist', async () => {
      mockVoiceAgentsList.mockResolvedValue([]);
      mockCallLogsList.mockResolvedValue([]);
      await act(async () => { render(<VoiceAgentTab />); });
      await waitFor(() => {
        expect(screen.getByText('No Voice Agents')).toBeDefined();
        expect(screen.getByText('Create your first voice agent to get started.')).toBeDefined();
      });
    });
  });

  // ── Expand Details ──
  describe('expand details', () => {
    it('expands agent details when clicked', async () => {
      const user = userEvent.setup();
      render(<VoiceAgentTab />);
      await waitFor(() => { expect(screen.getByText('Receptionist Bot')).toBeDefined(); });

      await user.click(screen.getByText('Receptionist Bot'));

      await waitFor(() => {
        expect(screen.getByText('Be a receptionist')).toBeDefined();
        expect(screen.getByText('📋 Copy Deploy Cmd')).toBeDefined();
        expect(screen.getByText('📞 Test Call')).toBeDefined();
      });
    });
  });
});
