import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommunicationDashboard } from './CommunicationDashboard';
import { createJsPdfMock, createUrlMock, createAnchorDownloadMock, createBlobMock } from '@/test-utils';

// ─── Mocks ─────────────────────────────

vi.mock('@/lib/communication-hub', () => ({
  getCommunicationStats: vi.fn(() => ({
    totalSent: 156,
    emailsSent: 120,
    whatsappSent: 36,
    failed: 4,
    lastSentAt: Date.now() - 3600000,
  })),
  checkCommunicationHealth: vi.fn(async () => ({
    email: { resend: true, sendgrid: false, preferred: 'resend' },
    whatsapp: { configured: true, fromNumber: '+919876543210' },
  })),
}));

vi.mock('@/lib/communication-log', () => ({
  getCommunications: vi.fn(() => [
    {
      id: '1',
      projectId: 'p1',
      clientName: 'Acme Corp',
      channel: 'email',
      direction: 'outbound',
      subject: 'Invoice Reminder',
      summary: 'Follow up on pending invoice',
      sentiment: 'neutral',
      followUpRequired: false,
      timestamp: Date.now() - 7200000,
    },
    {
      id: '2',
      projectId: 'p1',
      clientName: 'Acme Corp',
      channel: 'whatsapp',
      direction: 'inbound',
      subject: 'Quick question',
      summary: 'Client asked about timeline',
      sentiment: 'positive',
      followUpRequired: true,
      followUpDate: Date.now() + 86400000,
      timestamp: Date.now() - 3600000,
    },
  ]),
  getCommunicationStats: vi.fn(() => ({
    total: 2,
    outbound: 1,
    inbound: 1,
    channels: { email: 1, whatsapp: 1 },
    sentimentBreakdown: { neutral: 1, positive: 1 },
    pendingFollowUps: 1,
  })),
  getPendingFollowUps: vi.fn(() => [
    {
      id: '2',
      projectId: 'p1',
      clientName: 'Acme Corp',
      channel: 'whatsapp',
      direction: 'inbound',
      subject: 'Quick question',
      summary: 'Client asked about timeline',
      sentiment: 'positive',
      followUpRequired: true,
      followUpDate: Date.now() + 86400000,
      timestamp: Date.now() - 3600000,
    },
  ]),
  getChannelIcon: vi.fn((ch: string) => {
    const icons: Record<string, string> = { email: '📧', whatsapp: '💬', phone: '📞' };
    return icons[ch] || '📋';
  }),
  getSentimentIcon: vi.fn((s: string) => {
    const icons: Record<string, string> = { positive: '😊', neutral: '😐', negative: '😟' };
    return icons[s] || '😐';
  }),
}));

// ─── Delivery Events Mock Data ────────

const mockDeliveryEvents = [
  {
    id: 'evt-001',
    provider: 'resend' as const,
    channel: 'email' as const,
    eventType: 'email.delivered' as const,
    messageId: 'msg-abc-123',
    recipient: 'user@example.com',
    sender: 'sender@company.com',
    subject: 'Welcome to Oracle',
    metadata: { testEvent: false, campaignId: 'camp-1' },
    receivedAt: Date.now() - 3600000,
  },
  {
    id: 'evt-002',
    provider: 'twilio' as const,
    channel: 'whatsapp' as const,
    eventType: 'whatsapp.failed' as const,
    messageId: 'msg-def-456',
    recipient: '+919876543210',
    errorCode: '30003',
    errorMessage: 'Unreachable handset',
    metadata: {
      testEvent: false,
      largePayload: {
        nested: { deep: { value: 'test', count: 42, items: ['a', 'b', 'c'] } },
      },
      tags: ['campaign', 'important', 'priority'],
    },
    receivedAt: Date.now() - 7200000,
  },
];

vi.mock('@/lib/delivery-events', () => ({
  getDeliveryEvents: vi.fn(() => mockDeliveryEvents),
  getDeliveryStats: vi.fn(() => ({
    totalEvents: 2,
    byStatus: { delivered: 1, failed: 1, pending: 0, opened: 0, clicked: 0 },
  })),
  clearTestEvents: vi.fn(() => 0),
  cleanExpiredTestEvents: vi.fn(),
  getTestEventTTL: vi.fn(() => 3600000),
  setTestEventTTL: vi.fn(),
}));

// ─── Tests ─────────────────────────────

describe('CommunicationDashboard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the header with title', async () => {
    render(<CommunicationDashboard />);
    expect(screen.getByText(/Communication Hub/)).toBeTruthy();
  });

  it('shows loading state initially', () => {
    render(<CommunicationDashboard />);
    expect(screen.getByText(/Loading Communication Hub/)).toBeTruthy();
  });

  it('renders metric cards after loading', async () => {
    render(<CommunicationDashboard />);
    await screen.findByText(/Communication Hub/);
    expect(screen.getByText(/Total Sent/)).toBeTruthy();
    expect(screen.getByText(/Emails Sent/)).toBeTruthy();
    expect(screen.getByText(/WhatsApp Sent/)).toBeTruthy();
    expect(screen.getAllByText(/Pending Follow-ups/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders provider health cards', async () => {
    render(<CommunicationDashboard />);
    await screen.findByText(/Communication Hub/);
    expect(screen.getByText(/Email Providers/)).toBeTruthy();
    expect(screen.getByText(/WhatsApp \(Twilio\)/)).toBeTruthy();
  });

  it('renders channel breakdown card', async () => {
    render(<CommunicationDashboard />);
    await screen.findByText(/Communication Hub/);
    expect(screen.getByText(/Channel Breakdown/)).toBeTruthy();
  });

  it('renders sentiment analysis card', async () => {
    render(<CommunicationDashboard />);
    await screen.findByText(/Communication Hub/);
    expect(screen.getByText(/Sentiment Analysis/)).toBeTruthy();
  });

  it('renders recent activity card', async () => {
    render(<CommunicationDashboard />);
    await screen.findByText(/Communication Hub/);
    expect(screen.getByText(/Recent Activity/)).toBeTruthy();
  });

  it('renders pending follow-ups card with count badge', async () => {
    render(<CommunicationDashboard />);
    await screen.findByText(/Communication Hub/);
    expect(screen.getAllByText(/Pending Follow-ups/).length).toBeGreaterThanOrEqual(1);
    const badges = screen.getAllByText('1');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders time range buttons', async () => {
    render(<CommunicationDashboard />);
    await screen.findByText(/Communication Hub/);
    expect(screen.getByText('24h')).toBeTruthy();
    expect(screen.getByText('7d')).toBeTruthy();
    expect(screen.getByText('30d')).toBeTruthy();
    expect(screen.getByText('All')).toBeTruthy();
  });

  it('renders refresh button', async () => {
    render(<CommunicationDashboard />);
    await screen.findByText(/Communication Hub/);
    expect(screen.getByText('Refresh')).toBeTruthy();
  });

  it('renders auto-refresh footer', async () => {
    render(<CommunicationDashboard />);
    await screen.findByText(/Communication Hub/);
    expect(screen.getByText(/Auto-refreshes every 60s/)).toBeTruthy();
  });
});

// ─── Delivery Event Modal Tests ────────

describe('DeliveryEventModal - CopyJsonButton', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function openEventModal() {
    render(<CommunicationDashboard />);
    await screen.findByText(/Communication Hub/);

    // Switch to events tab
    const eventsTab = screen.getByText('Delivery Events');
    fireEvent.click(eventsTab);

    // Wait for events to render and click the first event (email.delivered)
    await waitFor(() => {
      expect(screen.getByText('email.delivered')).toBeTruthy();
    });

    const eventRow = screen.getByText('email.delivered').closest('[role="button"]')!;
    fireEvent.click(eventRow);

    // Wait for the modal to open
    await waitFor(() => {
      expect(screen.getByText('Event ID')).toBeTruthy();
    });
  }

  it('renders Copy JSON button in modal footer', async () => {
    await openEventModal();
    expect(screen.getByText('Copy JSON')).toBeTruthy();
  });

  it('renders Download JSON button in modal footer', async () => {
    await openEventModal();
    expect(screen.getByText('Download JSON')).toBeTruthy();
  });

  it('shows copied state after clicking Copy JSON', async () => {
    await openEventModal();

    const copyButton = screen.getByText('Copy JSON');
    fireEvent.click(copyButton);

    // Should show "Copied!" text
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeTruthy();
    });
  });

  it('resets copied state after timeout', async () => {
    await openEventModal();

    const copyButton = screen.getByText('Copy JSON');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeTruthy();
    });

    // Fast-forward time to trigger the timeout reset
    vi.advanceTimersByTime(1600);

    await waitFor(() => {
      expect(screen.getByText('Copy JSON')).toBeTruthy();
    });
  });

  it('shows error state when clipboard write fails', async () => {
    // Mock clipboard to reject
    const originalWriteText = navigator.clipboard.writeText;
    navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error('Permission denied'));

    await openEventModal();

    const copyButton = screen.getByText('Copy JSON');
    fireEvent.click(copyButton);

    // Should show "Failed" text — use getByRole to disambiguate from other "Failed" text
    await waitFor(() => {
      expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1);
    });

    // Restore original
    navigator.clipboard.writeText = originalWriteText;
  });
});

describe('DeliveryEventModal - DownloadJsonButton', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function openEventModal() {
    render(<CommunicationDashboard />);
    await screen.findByText(/Communication Hub/);

    const eventsTab = screen.getByText('Delivery Events');
    fireEvent.click(eventsTab);

    await waitFor(() => {
      expect(screen.getByText('email.delivered')).toBeTruthy();
    });

    const eventRow = screen.getByText('email.delivered').closest('[role="button"]')!;
    fireEvent.click(eventRow);

    await waitFor(() => {
      expect(screen.getByText('Event ID')).toBeTruthy();
    });
  }

  it('renders Download JSON button in modal footer', async () => {
    await openEventModal();
    expect(screen.getByText('Download JSON')).toBeTruthy();
  });

  it('disables button while downloading (loading spinner visible)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openEventModal();

    const downloadButton = screen.getByText('Download JSON');
    fireEvent.click(downloadButton);

    // Should show spinner text immediately
    expect(screen.getByText('Generating…')).toBeTruthy();

    vi.useRealTimers();
  });

  it('re-enables button after download completes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openEventModal();

    const downloadButton = screen.getByText('Download JSON');
    fireEvent.click(downloadButton);
    expect(screen.getByText('Generating…')).toBeTruthy();

    // Allow async work to finish
    await vi.advanceTimersByTimeAsync(50);

    // Button should return to default state
    expect(screen.getByText('Download JSON')).toBeTruthy();

    vi.useRealTimers();
  });
});

describe('DeliveryEventModal - Collapsible Metadata', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function openEventModal() {
    render(<CommunicationDashboard />);
    await screen.findByText(/Communication Hub/);

    const eventsTab = screen.getByText('Delivery Events');
    fireEvent.click(eventsTab);

    // Click the second event which has large metadata (whatsapp.failed)
    await waitFor(() => {
      expect(screen.getByText('whatsapp.failed')).toBeTruthy();
    });

    const eventRow = screen.getByText('whatsapp.failed').closest('[role="button"]')!;
    fireEvent.click(eventRow);

    await waitFor(() => {
      expect(screen.getByText('Event ID')).toBeTruthy();
    });
  }

  it('renders metadata section in modal', async () => {
    await openEventModal();
    expect(screen.getByText('Metadata')).toBeTruthy();
  });

  it('shows collapsible indicator for large nested objects', async () => {
    await openEventModal();

    // The 'largePayload' key should have a collapsible chevron button
    const largePayloadButton = screen.getByText('largePayload');
    expect(largePayloadButton).toBeTruthy();
  });

  it('shows collapsed summary for large objects', async () => {
    await openEventModal();

    // LargePayload should show a collapsed summary like '(N keys)'
    const summary = screen.getByText(/\(\d+ keys?\)/);
    expect(summary).toBeTruthy();
  });

  it('expands collapsed section when clicking the toggle', async () => {
    await openEventModal();

    // Click on the largePayload toggle button
    const largePayloadButton = screen.getByText('largePayload');
    fireEvent.click(largePayloadButton);

    // After expanding, the nested content should be visible
    await waitFor(() => {
      expect(screen.getByText(/nested/)).toBeTruthy();
    });
  });

  it('collapses expanded section when clicking toggle again', async () => {
    await openEventModal();

    const largePayloadButton = screen.getByText('largePayload');

    // First click to expand
    fireEvent.click(largePayloadButton);
    await waitFor(() => {
      expect(screen.getByText(/nested/)).toBeTruthy();
    });

    // Click again to collapse
    fireEvent.click(largePayloadButton);

    // The nested content should no longer be visible
    await waitFor(() => {
      expect(screen.queryByText(/nested/)).toBeNull();
    });
  });

  it('renders array metadata with collapsed summary', async () => {
    await openEventModal();

    // The 'tags' key should have a collapsed summary showing '(N items)'
    const tagsButton = screen.getByText('tags');
    expect(tagsButton).toBeTruthy();
  });

  it('expands array metadata when clicked', async () => {
    await openEventModal();

    const tagsButton = screen.getByText('tags');
    fireEvent.click(tagsButton);

    // After expanding, array items should be visible
    await waitFor(() => {
      expect(screen.getByText(/campaign/)).toBeTruthy();
    });
  });

  it('small metadata values are expanded by default', async () => {
    await openEventModal();

    // 'testEvent' is a small boolean value — should be visible without toggling
    expect(screen.getByText('testEvent')).toBeTruthy();
    expect(screen.getByText('false')).toBeTruthy();
  });

  it('closes modal on Escape key', async () => {
    await openEventModal();

    // Verify modal is open
    expect(screen.getByText('Event ID')).toBeTruthy();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('Event ID')).toBeNull();
    });
  });
});

describe('DeliveryEventModal - DetailRow Copy Buttons', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function openEventModal() {
    render(<CommunicationDashboard />);
    await screen.findByText(/Communication Hub/);

    const eventsTab = screen.getByText('Delivery Events');
    fireEvent.click(eventsTab);

    await waitFor(() => {
      expect(screen.getByText('email.delivered')).toBeTruthy();
    });

    const eventRow = screen.getByText('email.delivered').closest('[role="button"]')!;
    fireEvent.click(eventRow);

    await waitFor(() => {
      expect(screen.getByText('Event ID')).toBeTruthy();
    });
  }

  it('shows copy buttons next to Event ID and Message ID', async () => {
    await openEventModal();

    // There should be copy buttons with aria-labels
    const copyEventId = screen.getByLabelText('Copy Event ID');
    const copyMessageId = screen.getByLabelText('Copy Message ID');
    expect(copyEventId).toBeTruthy();
    expect(copyMessageId).toBeTruthy();
  });

  it('shows copied state when clicking copy on Event ID', async () => {
    await openEventModal();

    const copyButton = screen.getByLabelText('Copy Event ID');
    fireEvent.click(copyButton);

    // Should briefly show copied state — the button's SVG should have emerald color
    await waitFor(() => {
      const svg = copyButton.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('class')).toContain('text-emerald-400');
    });
  });

  it('resets copy state after timeout', async () => {
    await openEventModal();

    const copyButton = screen.getByLabelText('Copy Event ID');
    fireEvent.click(copyButton);

    // Wait for timeout to clear the copied state
    vi.advanceTimersByTime(1600);

    await waitFor(() => {
      // The button should be back to its default state
      expect(copyButton.querySelector('svg')).toBeTruthy();
    });
  });
});

// ─── Shared Test Helpers ───────────────────

async function openEventsTab() {
  render(<CommunicationDashboard />);
  await screen.findByText(/Communication Hub/);
  fireEvent.click(screen.getByText('Delivery Events'));
  // Wait for events count text to appear (ensures filteredEvents is populated)
  await waitFor(() => {
    expect(screen.getByText(/events$/)).toBeTruthy();
  });
}



// ─── downloadCsv Tests ───────────────────

describe('DeliveryEventsTab - downloadCsv', () => {
  let blobMock: ReturnType<typeof createBlobMock>;
  let urlMock: ReturnType<typeof createUrlMock>;
  const originalBlob = globalThis.Blob;

  beforeEach(async () => {
    localStorage.clear();
    blobMock = createBlobMock();
    urlMock = createUrlMock();
    globalThis.Blob = blobMock.Blob;

    // Reset delivery events mock to default data (tests may override it)
    const { getDeliveryEvents } = await import('@/lib/delivery-events');
    vi.mocked(getDeliveryEvents).mockReturnValue(mockDeliveryEvents);
  });

  afterEach(() => {
    globalThis.Blob = originalBlob;
    urlMock.restore();
  });

  it('disables Export CSV button when no events', async () => {
    const { getDeliveryEvents } = await import('@/lib/delivery-events');
    (getDeliveryEvents as ReturnType<typeof vi.fn>).mockReturnValue([]);

    await openEventsTab();

    const csvButton = screen.getByText('Export CSV').closest('button');
    expect(csvButton).toBeTruthy();
    expect(csvButton).toHaveProperty('disabled', true);
  });

  it('generates CSV with correct headers', async () => {
    await openEventsTab();

    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => {
      expect(blobMock.getContent()).toContain('ID,Received At');
    });
    const lines = blobMock.getContent().split('\n');
    expect(lines[0]).toBe('ID,Received At,Channel,Provider,Event Type,Message ID,Recipient,Sender,Subject,Error Code,Error Message');
  });

  it('includes correct row data for events', async () => {
    await openEventsTab();

    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => {
      expect(blobMock.getContent()).toContain('evt-001');
    });
    const lines = blobMock.getContent().split('\n');
    // Line 0 = header, Line 1 = first event, Line 2 = second event
    expect(lines.length).toBe(3);

    // First event row should contain known values
    expect(lines[1]).toContain('evt-001');
    expect(lines[1]).toContain('resend');
    expect(lines[1]).toContain('email');
    expect(lines[1]).toContain('user@example.com');
    expect(lines[1]).toContain('sender@company.com');
    expect(lines[1]).toContain('Welcome to Oracle');
  });

  it('defaults optional fields to empty string', async () => {
    await openEventsTab();

    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => {
      expect(blobMock.getContent()).toContain('evt-002');
    });
    const lines = blobMock.getContent().split('\n');
    // evt-002 has no sender or subject
    const evt002Row = lines[2];
    const values = evt002Row.split(',');
    // sender (col 7) and subject (col 8) should be empty
    expect(values[7]).toBe('');
    expect(values[8]).toBe('');
  });

  it('sets correct MIME type on Blob', async () => {
    await openEventsTab();

    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => {
      expect(blobMock.getMime()).toBe('text/csv;charset=utf-8;');
    });
  });

  it('creates object URL and revokes it after download', async () => {
    await openEventsTab();

    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalledOnce();
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it('escapes CSV values containing commas', async () => {
    const { getDeliveryEvents } = await import('@/lib/delivery-events');
    (getDeliveryEvents as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        id: 'evt-comma',
        provider: 'resend' as const,
        channel: 'email' as const,
        eventType: 'email.delivered' as const,
        messageId: 'msg-comma',
        recipient: 'test@test.com',
        sender: 'sender@test.com',
        subject: 'Hello, World',
        metadata: {},
        receivedAt: Date.now(),
      },
    ]);

    await openEventsTab();

    fireEvent.click(screen.getByText('Export CSV'));

    // Subject 'Hello, World' should be quoted
    await waitFor(() => {
      expect(blobMock.getContent()).toContain('"Hello, World"');
    });
  });

  it('escapes CSV values containing double quotes', async () => {
    const { getDeliveryEvents } = await import('@/lib/delivery-events');
    (getDeliveryEvents as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        id: 'evt-quote',
        provider: 'resend' as const,
        channel: 'email' as const,
        eventType: 'email.delivered' as const,
        messageId: 'msg-quote',
        recipient: 'test@test.com',
        sender: 'sender@test.com',
        subject: 'Say \"hello\"',
        metadata: {},
        receivedAt: Date.now(),
      },
    ]);

    await openEventsTab();

    fireEvent.click(screen.getByText('Export CSV'));

    // Subject 'Say "hello"' should be escaped as '""Say ""hello"""'
    await waitFor(() => {
      expect(blobMock.getContent()).toContain('"Say ""hello"""');
    });
  });

  it('escapes CSV values containing newlines', async () => {
    const { getDeliveryEvents } = await import('@/lib/delivery-events');
    (getDeliveryEvents as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        id: 'evt-nl',
        provider: 'resend' as const,
        channel: 'email' as const,
        eventType: 'email.delivered' as const,
        messageId: 'msg-nl',
        recipient: 'test@test.com',
        sender: 'sender@test.com',
        subject: 'Line1\nLine2',
        metadata: {},
        receivedAt: Date.now(),
      },
    ]);

    await openEventsTab();

    fireEvent.click(screen.getByText('Export CSV'));

    // Subject with newline should be quoted
    await waitFor(() => {
      expect(blobMock.getContent()).toContain('"Line1\nLine2"');
    });
  });
});

// ─── Multi-select Tests ───────────────────

describe('DeliveryEventsTab - Multi-select', () => {
  beforeEach(async () => {
    localStorage.clear();
    // Reset delivery events mock to default data (previous describe blocks may override it)
    const { getDeliveryEvents } = await import('@/lib/delivery-events');
    vi.mocked(getDeliveryEvents).mockReturnValue(mockDeliveryEvents);
  });

  it('shows checkboxes on each event row', async () => {
    await openEventsTab();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2); // at least 2 mock events
  });

  it('toggles individual checkbox selection', async () => {
    await openEventsTab();

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];

    // Initially unchecked
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(false);

    // Click first checkbox
    fireEvent.click(checkboxes[0]);
    await waitFor(() => {
      expect(checkboxes[0].checked).toBe(true);
    });
    expect(checkboxes[1].checked).toBe(false);

    // Click second checkbox
    fireEvent.click(checkboxes[1]);
    await waitFor(() => {
      expect(checkboxes[1].checked).toBe(true);
    });
    expect(checkboxes[0].checked).toBe(true);

    // Deselect first
    fireEvent.click(checkboxes[0]);
    await waitFor(() => {
      expect(checkboxes[0].checked).toBe(false);
    });
    expect(checkboxes[1].checked).toBe(true);
  });

  it('shows Select All button with correct states', async () => {
    await openEventsTab();

    // Initially shows "Select all"
    expect(screen.getByText('Select all')).toBeTruthy();

    // Select one event
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // Shows "Clear (1)"
    await waitFor(() => {
      expect(screen.getByText('Clear (1)')).toBeTruthy();
    });

    // Click the Clear button to select all
    fireEvent.click(screen.getByText('Clear (1)'));

    // Shows "Deselect all"
    await waitFor(() => {
      expect(screen.getByText('Deselect all')).toBeTruthy();
    });

    // Click again to deselect all
    fireEvent.click(screen.getByText('Deselect all'));
    await waitFor(() => {
      expect(screen.getByText('Select all')).toBeTruthy();
    });
  });

  it('shows Download Selected button when events are selected', async () => {
    await openEventsTab();

    // No download button initially
    expect(screen.queryByText(/Download Selected/)).toBeNull();

    // Select one event
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // Download Selected button appears
    await waitFor(() => {
      expect(screen.getByText(/Download Selected/)).toBeTruthy();
    });
  });

  it('Download Selected button shows correct count', async () => {
    await openEventsTab();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    await waitFor(() => {
      expect(screen.getByText(/Download Selected \(/)).toBeTruthy();
    });

    // Deselect one
    fireEvent.click(checkboxes[0]);
    await waitFor(() => {
      const btn = screen.getByText(/Download Selected \(/);
      expect(btn.textContent).toContain('1)');
    });
  });

  it('Export CSV uses selected events when selection is active', async () => {
    const origBlob = globalThis.Blob;
    const blobMock = createBlobMock();
    const urlMock = createUrlMock();
    globalThis.Blob = blobMock.Blob;

    try {
      await openEventsTab();

      // Select only the first event
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(screen.getByText(/Download Selected/)).toBeTruthy();
      });

      // Click Export CSV
      fireEvent.click(screen.getByText('Export CSV'));

      // Should only contain the selected event
      await waitFor(() => {
        expect(blobMock.getContent()).toContain('email.delivered');
      });
      const lines = blobMock.getContent().split('\n');
      expect(lines.length).toBe(2); // header + 1 event
      expect(blobMock.getContent()).not.toContain('whatsapp.failed');
    } finally {
      globalThis.Blob = origBlob;
      urlMock.restore();
    }
  });

  it('Export CSV uses all filtered events when no selection is active', async () => {
    const origBlob = globalThis.Blob;
    const blobMock = createBlobMock();
    const urlMock = createUrlMock();
    globalThis.Blob = blobMock.Blob;

    try {
      await openEventsTab();

      // No selection - Export CSV should include all events
      fireEvent.click(screen.getByText('Export CSV'));

      await waitFor(() => {
        expect(blobMock.getContent()).toContain('whatsapp.failed');
      });
      const lines = blobMock.getContent().split('\n');
      expect(lines.length).toBe(3); // header + 2 events
      expect(lines[1]).toContain('email.delivered');
      expect(lines[2]).toContain('whatsapp.failed');
    } finally {
      globalThis.Blob = origBlob;
      urlMock.restore();
    }
  });

  it('row click still opens modal regardless of checkbox', async () => {
    await openEventsTab();

    // Click on the row (not the checkbox) to open modal
    const eventRow = screen.getByRole('button', { name: /email\.delivered/ });
    fireEvent.click(eventRow);

    // Modal should open
    await waitFor(() => {
      expect(screen.getByText('Copy JSON')).toBeTruthy();
    });
  });

  it('checkbox click does not open modal', async () => {
    await openEventsTab();

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(checkboxes[0]);

    // Modal should NOT open
    expect(screen.queryByText('Copy JSON')).toBeNull();
    // Checkbox should be checked
    expect(checkboxes[0].checked).toBe(true);
  });

  it('blue highlight class applied to selected rows', async () => {
    await openEventsTab();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    await waitFor(() => {
      // Find the event row that contains the checkbox's parent
      const selectedRow = checkboxes[0].closest('[role="button"]');
      expect(selectedRow?.className).toContain('bg-blue-500/10');
    });
  });

  it('Download Selected JSON button triggers JSON download with correct content', async () => {
    const origBlob = globalThis.Blob;
    const blobMock = createBlobMock();
    const urlMock = createUrlMock();
    const anchorMock = createAnchorDownloadMock();
    globalThis.Blob = blobMock.Blob;

    try {
      await openEventsTab();

      // Select both events
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getByText('Download Selected (2)')).toBeTruthy();
      });

      // Click Download Selected
      fireEvent.click(screen.getByText('Download Selected (2)'));

      // Wait for the async handler to yield and run downloadJsonArray
      await waitFor(() => {
        expect(blobMock.getContent()).toBeTruthy();
      });

      // Verify JSON content
      const parsed = JSON.parse(blobMock.getContent());
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
      expect(parsed[0].id).toBe('evt-001');
      expect(parsed[1].id).toBe('evt-002');

      // Verify MIME type and filename
      expect(blobMock.getMime()).toBe('application/json');
      expect(anchorMock.getFilename()).toMatch(/^delivery-events-selected-\d{4}-\d{2}-\d{2}\.json$/);
    } finally {
      globalThis.Blob = origBlob;
      urlMock.restore();
      anchorMock.restore();
    }
  });

  it('Download Selected JSON button disables while generating and re-enables after', async () => {
    const origBlob = globalThis.Blob;
    const blobMock = createBlobMock();
    const urlMock = createUrlMock();
    globalThis.Blob = blobMock.Blob;

    try {
      await openEventsTab();

      // Select both events to make the Download Selected button appear
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getByText('Download Selected (2)')).toBeTruthy();
      });

      // Click Download Selected
      fireEvent.click(screen.getByText('Download Selected (2)'));

      // Button should be disabled immediately (generatingSelectedJson is set synchronously before the await)
      const btn = screen.getByLabelText('Download selected events as JSON');
      expect(btn).toHaveProperty('disabled', true);

      // Wait for async handler to complete (setTimeout(0) yield + downloadJsonArray)
      await waitFor(() => {
        expect(btn).toHaveProperty('disabled', false);
      });
    } finally {
      globalThis.Blob = origBlob;
      urlMock.restore();
    }
  });

  it('Export PDF button generates a valid PDF with correct content', async () => {
    vi.resetModules();
    const saveSpy = vi.fn();

    vi.doMock('jspdf', () => ({
      default: vi.fn().mockImplementation(function () {
        return createJsPdfMock({ save: saveSpy });
      }),
    }));

    const urlMock = createUrlMock();

    try {
      await openEventsTab();

      fireEvent.click(screen.getByText('Export PDF'));

      await waitFor(() => {
        expect(saveSpy).toHaveBeenCalled();
      });

      const today = new Date().toISOString().slice(0, 10);
      expect(saveSpy).toHaveBeenCalledWith(`delivery-events-${today}.pdf`);
    } finally {
      urlMock.restore();
      vi.doUnmock('jspdf');
    }
  });

  it('Export PDF button shows Generating... while PDF is being created', async () => {
    vi.resetModules();
    let resolveSave: () => void;
    const savePromise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });

    vi.doMock('jspdf', () => ({
      default: vi.fn().mockImplementation(function () {
        return createJsPdfMock({ save: vi.fn().mockImplementation(() => savePromise) });
      }),
    }));

    const urlMock = createUrlMock();

    try {
      await openEventsTab();

      fireEvent.click(screen.getByText('Export PDF'));

      // Button should be disabled while generating (generating state is set synchronously)
      const btn = screen.getByLabelText('Export events as PDF');
      await waitFor(() => {
        expect(btn).toHaveProperty('disabled', true);
      });

      // Resolve the save to complete the flow
      resolveSave!();

      // Button should re-enable after completion
      await waitFor(() => {
        expect(btn).toHaveProperty('disabled', false);
      });
    } finally {
      urlMock.restore();
      vi.doUnmock('jspdf');
    }
  });

  it('Export PDF contains expected content (title, headers, row data)', async () => {
    vi.resetModules();
    let pdfMock: ReturnType<typeof createJsPdfMock>;

    vi.doMock('jspdf', () => ({
      default: vi.fn().mockImplementation(function () {
        pdfMock = createJsPdfMock();
        return pdfMock;
      }),
    }));

    const urlMock = createUrlMock();

    try {
      await openEventsTab();

      fireEvent.click(screen.getByText('Export PDF'));

      await waitFor(() => {
        expect(pdfMock!.save).toHaveBeenCalled();
      });

      // Collect all text() calls
      const textCalls = pdfMock!.text.mock.calls.map((args: unknown[]) => args[0] as string);
      const allText = textCalls.join('\n');

      // Verify title
      expect(allText).toContain('Delivery Events Report');

      // Verify subtitle contains date and event count
      expect(allText).toMatch(/Generated:.*\|  Total events: 2/);

      // Verify summary section
      expect(allText).toContain('Summary');
      expect(allText).toMatch(/Email: 1  \|  WhatsApp: 1/);
      expect(allText).toMatch(/Delivered: 1  \|  Failed: 1/);

      // Verify table headers (each header is a separate doc.text() call)
      const expectedHeaders = ['Time', 'Channel', 'Provider', 'Event Type', 'Recipient', 'Sender', 'Subject', 'Error'];
      for (const header of expectedHeaders) {
        expect(textCalls).toContain(header);
      }

      // Verify row data for first event
      expect(allText).toContain('resend');
      expect(allText).toContain('email.delivered');
      expect(allText).toContain('user@example.com');
      expect(allText).toContain('sender@company.com');
      expect(allText).toContain('Welcome to Oracle');

      // Verify row data for second event
      expect(allText).toContain('twilio');
      expect(allText).toContain('whatsapp.failed');
      expect(allText).toContain('+919876543210');
      expect(allText).toContain('Unreachable handset');

      // Verify footer
      expect(allText).toContain('Oracle Communication Hub');
      expect(allText).toContain('2 events exported');
    } finally {
      urlMock.restore();
      vi.doUnmock('jspdf');
    }
  });

  it('Export PDF adds new page and re-draws headers when events exceed one page', async () => {
    // Generate 25 events to exceed the ~21 rows per page limit
    const manyEvents = Array.from({ length: 25 }, (_, i) => ({
      id: `evt-page-${i}`,
      provider: 'resend' as const,
      channel: 'email' as const,
      eventType: 'email.delivered' as const,
      messageId: `msg-page-${i}`,
      recipient: `user${i}@example.com`,
      sender: 'sender@company.com',
      subject: `Subject ${i}`,
      metadata: {},
      receivedAt: Date.now() - i * 1000,
    }));

    const { getDeliveryEvents } = await import('@/lib/delivery-events');
    vi.mocked(getDeliveryEvents).mockReturnValue(manyEvents);
    const { getDeliveryStats } = await import('@/lib/delivery-events');
    vi.mocked(getDeliveryStats).mockReturnValue({
      totalEvents: 25,
      emailEvents: 25,
      whatsappEvents: 0,
      byType: { 'email.delivered': 25 },
      byStatus: { delivered: 25, failed: 0, pending: 0, opened: 0, clicked: 0 },
      recentEvents: manyEvents.slice(0, 10),
    });

    vi.resetModules();
    let pdfMock: ReturnType<typeof createJsPdfMock>;

    vi.doMock('jspdf', () => ({
      default: vi.fn().mockImplementation(function () {
        pdfMock = createJsPdfMock();
        return pdfMock;
      }),
    }));

    const urlMock = createUrlMock();

    try {
      await openEventsTab();

      fireEvent.click(screen.getByText('Export PDF'));

      await waitFor(() => {
        expect(pdfMock!.save).toHaveBeenCalled();
      });

      // Verify addPage was called (page break happened)
      expect(pdfMock!.addPage).toHaveBeenCalled();

      // Count how many times each header appears in text calls.
      // With a page break, headers are drawn at least twice (once per page).
      const textCalls = pdfMock!.text.mock.calls.map((args: unknown[]) => args[0] as string);
      const headerCount = textCalls.filter((t: string) => t === 'Time').length;
      expect(headerCount).toBeGreaterThanOrEqual(2);

      // Verify the footer reflects all 25 events
      const allText = textCalls.join('\n');
      expect(allText).toContain('25 events exported');

      // Verify events from both pages appear (subject is short enough to avoid truncation)
      expect(allText).toContain('Subject 0');
      expect(allText).toContain('Subject 24');
    } finally {
      urlMock.restore();
      vi.doUnmock('jspdf');
    }
  });
});
