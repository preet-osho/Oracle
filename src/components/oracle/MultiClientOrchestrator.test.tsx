import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MultiClientOrchestrator } from './MultiClientOrchestrator';

// ─── Mocks ─────────────────────────────

vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: { initial: {}, animate: {} } },
  transitions: { smooth: {} },
  buttonTapProps: {},
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-container">{children}</div>,
  PieChart: () => <div data-testid="pie-chart" />,
  Pie: () => null,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => null,
  LineChart: () => <div data-testid="line-chart" />,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
}));

const mockClientTasks = [
  {
    id: 'task-1',
    clientId: 'client-1',
    clientName: 'Acme Corp',
    title: 'Build landing page',
    description: 'Create a modern landing page for Acme Corp',
    category: 'code-generation' as const,
    priority: 'high' as const,
    status: 'queued' as const,
    assignedAgents: [],
    tags: ['code-generation', 'frontend'],
    results: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'task-2',
    clientId: 'client-1',
    clientName: 'Acme Corp',
    title: 'Write blog post',
    description: 'Write a blog post about AI trends',
    category: 'content-creation' as const,
    priority: 'medium' as const,
    status: 'completed' as const,
    assignedAgents: ['writer'],
    tags: ['content-creation'],
    results: [{ agent: 'writer', output: 'Done', duration: 5000, tokensUsed: 1200 }],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
  },
  {
    id: 'task-3',
    clientId: 'client-2',
    clientName: 'Beta Inc',
    title: 'Market research',
    description: 'Research competitors in the SaaS space',
    category: 'research' as const,
    priority: 'critical' as const,
    status: 'executing' as const,
    assignedAgents: ['researcher'],
    tags: ['research'],
    results: [],
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
  },
];

const mockClientSummaries = [
  { clientId: 'client-1', clientName: 'Acme Corp', totalTasks: 2, activeTasks: 1, completedTasks: 1, avgQuality: 85 },
  { clientId: 'client-2', clientName: 'Beta Inc', totalTasks: 1, activeTasks: 1, completedTasks: 0, avgQuality: 0 },
];

const mockSkillTemplates = [
  { id: 'skill-1', name: 'Landing Page Builder', description: 'Automated landing page creation', category: 'code-generation', avgQuality: 92, usageCount: 5 },
];

vi.mock('@/lib/client-task-queue', () => ({
  getClientTasks: vi.fn(() => mockClientTasks),
  addClientTask: vi.fn(),
  updateClientTask: vi.fn(),
  analyzeBatchTasks: vi.fn(() => []),
  getClientSummaries: vi.fn(() => mockClientSummaries),
  getSkillTemplates: vi.fn(() => mockSkillTemplates),
  addReviewCheckpoint: vi.fn(),
  populateDemoTasks: vi.fn(),
}));

vi.mock('@/lib/task-executor', () => ({
  executeClientTask: vi.fn(),
  createProgressListener: vi.fn(() => vi.fn()),
}));

vi.mock('@/lib/events', () => ({
  emit: vi.fn(),
}));

// ─── Tests ─────────────────────────────

describe('MultiClientOrchestrator', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ── Header & Stats ──

  it('renders the header with title', async () => {
    render(<MultiClientOrchestrator />);
    expect(screen.getByText(/Multi-Client Orchestrator/)).toBeTruthy();
    expect(screen.getByText(/Manage tasks from multiple clients/)).toBeTruthy();
  });

  it('renders stats overview cards', async () => {
    render(<MultiClientOrchestrator />);
    expect(screen.getByText('Total Tasks')).toBeTruthy();
    // 'Active' appears in stat label and in task status badges
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Clients').length).toBeGreaterThanOrEqual(1);
  });

  it('renders correct task counts in stats', async () => {
    render(<MultiClientOrchestrator />);
    // 3 tasks total, 2 active (queued + executing), 1 completed, 2 clients
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1); // Total Tasks
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1); // Active + Clients
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1); // Completed
  });

  // ── View Toggle ──

  it('renders view toggle buttons', async () => {
    render(<MultiClientOrchestrator />);
    // 'Clients' appears in view toggle and in stat card
    expect(screen.getAllByText(/Clients/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Tasks/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Skills/).length).toBeGreaterThanOrEqual(1);
  });

  it('starts in clients view by default', async () => {
    render(<MultiClientOrchestrator />);
    // Client names should be visible in clients view
    expect(screen.getByText('Acme Corp')).toBeTruthy();
    expect(screen.getByText('Beta Inc')).toBeTruthy();
  });

  it('switches to tasks view on click', async () => {
    render(<MultiClientOrchestrator />);
    fireEvent.click(screen.getByText(/📋 Tasks/));
    // Task titles should be visible
    expect(screen.getByText('Build landing page')).toBeTruthy();
    expect(screen.getByText('Write blog post')).toBeTruthy();
    expect(screen.getByText('Market research')).toBeTruthy();
  });

  it('switches to skills view on click', async () => {
    render(<MultiClientOrchestrator />);
    fireEvent.click(screen.getByText(/🛠️ Skills/));
    expect(screen.getAllByText(/Auto-Created Skills/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Landing Page Builder').length).toBeGreaterThanOrEqual(1);
  });

  // ── Clients View ──

  it('renders client cards with task counts', async () => {
    render(<MultiClientOrchestrator />);
    expect(screen.getByText('Acme Corp')).toBeTruthy();
    expect(screen.getByText('2 tasks total')).toBeTruthy();
    expect(screen.getByText('Beta Inc')).toBeTruthy();
    expect(screen.getByText('1 tasks total')).toBeTruthy();
  });

  it('renders client quality scores', async () => {
    render(<MultiClientOrchestrator />);
    expect(screen.getAllByText('85%').length).toBeGreaterThanOrEqual(1);
  });

  // ── Tasks View ──

  it('shows search input in tasks view', async () => {
    render(<MultiClientOrchestrator />);
    fireEvent.click(screen.getByText(/📋 Tasks/));
    expect(screen.getByPlaceholderText('Search tasks...')).toBeTruthy();
  });

  it('shows status filter dropdown in tasks view', async () => {
    render(<MultiClientOrchestrator />);
    fireEvent.click(screen.getByText(/📋 Tasks/));
    expect(screen.getByDisplayValue('All Status')).toBeTruthy();
  });

  it('shows Analyze button for queued tasks', async () => {
    render(<MultiClientOrchestrator />);
    fireEvent.click(screen.getByText(/📋 Tasks/));
    expect(screen.getAllByText(/🔍 Analyze/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows Run button for all tasks', async () => {
    render(<MultiClientOrchestrator />);
    fireEvent.click(screen.getByText(/📋 Tasks/));
    const runButtons = screen.getAllByText(/🚀 Run/);
    expect(runButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Orchestrator button for all tasks', async () => {
    render(<MultiClientOrchestrator />);
    fireEvent.click(screen.getByText(/📋 Tasks/));
    const orchButtons = screen.getAllByText(/⚡ Orchestrator/);
    expect(orchButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('filters tasks by search query', async () => {
    render(<MultiClientOrchestrator />);
    fireEvent.click(screen.getByText(/📋 Tasks/));
    const searchInput = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(searchInput, { target: { value: 'landing' } });
    expect(screen.getByText('Build landing page')).toBeTruthy();
    expect(screen.queryByText('Market research')).toBeNull();
  });

  it('filters tasks by status', async () => {
    render(<MultiClientOrchestrator />);
    fireEvent.click(screen.getByText(/📋 Tasks/));
    const statusSelect = screen.getByDisplayValue('All Status');
    fireEvent.change(statusSelect, { target: { value: 'completed' } });
    expect(screen.getByText('Write blog post')).toBeTruthy();
    expect(screen.queryByText('Build landing page')).toBeNull();
  });

  // ── Batch Analysis ──

  it('renders Batch Analyze button', async () => {
    render(<MultiClientOrchestrator />);
    expect(screen.getByText(/🔍 Batch Analyze/)).toBeTruthy();
  });

  // ── New Task Dialog ──

  it('opens New Task dialog on click', async () => {
    render(<MultiClientOrchestrator />);
    fireEvent.click(screen.getByText(/➕ New Task/));
    expect(screen.getAllByText('➕ New Client Task').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Client Name').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Task Title').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Description').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Category').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Priority').length).toBeGreaterThanOrEqual(1);
  });

  it('closes New Task dialog on Cancel', async () => {
    render(<MultiClientOrchestrator />);
    fireEvent.click(screen.getByText(/➕ New Task/));
    expect(screen.getAllByText('➕ New Client Task').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryAllByText('➕ New Client Task').length).toBe(0);
    });
  });

  it('validates required fields on submit', async () => {
    render(<MultiClientOrchestrator />);
    fireEvent.click(screen.getByText(/➕ New Task/));
    fireEvent.click(screen.getByText('Create Task'));
    // Dialog should remain open (validation prevents close)
    await waitFor(() => {
      expect(screen.getAllByText('➕ New Client Task').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('submits new task with valid data', async () => {
    const { addClientTask } = await import('@/lib/client-task-queue');
    render(<MultiClientOrchestrator />);
    fireEvent.click(screen.getByText(/➕ New Task/));

    fireEvent.change(screen.getByPlaceholderText(/e.g., Priya Sharma/), { target: { value: 'Test Client' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g., Google Ads/), { target: { value: 'Test Task' } });
    fireEvent.change(screen.getByPlaceholderText(/Describe the task/), { target: { value: 'Test description' } });
    fireEvent.click(screen.getByText('Create Task'));

    await waitFor(() => {
      expect(addClientTask).toHaveBeenCalled();
    });
  });

  // ── Skills View ──

  it('shows skill templates with usage count', async () => {
    render(<MultiClientOrchestrator />);
    fireEvent.click(screen.getByText(/🛠️ Skills/));
    expect(screen.getAllByText('92%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Used 5x/).length).toBeGreaterThanOrEqual(1);
  });

  // ── onAskOracle callback ──

  it('calls onAskOracle when sending to orchestrator', async () => {
    const mockOnAsk = vi.fn();
    render(<MultiClientOrchestrator onAskOracle={mockOnAsk} />);
    fireEvent.click(screen.getByText(/📋 Tasks/));
    const orchButtons = screen.getAllByText(/⚡ Orchestrator/);
    fireEvent.click(orchButtons[0]);
    expect(mockOnAsk).toHaveBeenCalled();
  });
});
