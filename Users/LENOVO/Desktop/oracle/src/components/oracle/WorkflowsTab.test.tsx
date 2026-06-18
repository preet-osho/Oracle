import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

// ─── Mocks ───

vi.mock('framer-motion', () => ({
  motion: {
    div: (p: Record<string, unknown>) => <div {...p}>{p.children as React.ReactNode}</div>,
    button: (p: Record<string, unknown>) => <button {...p}>{p.children as React.ReactNode}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {}, snappy: {} },
  buttonTapProps: {},
  cardHoverProps: {},
}));

// ─── Import after mocks ───
import { WorkflowsTab } from './WorkflowsTab';

// ─── Tests ───

describe('WorkflowsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the workflows heading', () => {
    render(<WorkflowsTab />);
    expect(screen.getByText('🔄 Workflows')).toBeDefined();
    expect(screen.getByText(/12 automated multi-step workflows/)).toBeDefined();
  });

  it('displays all 6 workflow cards', () => {
    render(<WorkflowsTab />);
    expect(screen.getByText('Website Launch')).toBeDefined();
    expect(screen.getByText('SEO Project')).toBeDefined();
    expect(screen.getByText('Ad Campaign Launch')).toBeDefined();
    expect(screen.getByText('Investment Portfolio Setup')).toBeDefined();
    expect(screen.getByText('Client Onboarding')).toBeDefined();
    expect(screen.getByText('Content Production Machine')).toBeDefined();
  });

  it('displays step counts and estimated times for workflows', () => {
    render(<WorkflowsTab />);
    // Multiple workflows have 5 steps, multiple have 4 steps
    expect(screen.getAllByText('📋 5 steps').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('⏱ 4-6 hours').length).toBe(2);
    expect(screen.getAllByText('📋 4 steps').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('⏱ 3-4 hours').length).toBe(1);
  });

  it('shows first 3 steps preview for workflows with 5 steps', () => {
    render(<WorkflowsTab />);
    // First workflow (Website Launch) has 5 steps, shows first 3 + "+2 more"
    expect(screen.getByText('Strategy & Sitemap')).toBeDefined();
    expect(screen.getByText('Copywriting')).toBeDefined();
    expect(screen.getByText('Design Brief')).toBeDefined();
    expect(screen.getAllByText('+2 more steps').length).toBeGreaterThanOrEqual(1);
  });

  it('has start workflow buttons', () => {
    render(<WorkflowsTab />);
    const startButtons = screen.getAllByText('▶ Start Workflow');
    expect(startButtons.length).toBe(12);
  });

  it('switches to active workflow view when start is clicked', () => {
    render(<WorkflowsTab />);
    const startButtons = screen.getAllByText('▶ Start Workflow');
    fireEvent.click(startButtons[0]);
    // Should show the active workflow view with timeline and output
    expect(screen.getByText('← Back')).toBeDefined();
    expect(screen.getByText('▶ Start')).toBeDefined();
    expect(screen.getByText('↺ Reset')).toBeDefined();
    expect(screen.getByText('Timeline')).toBeDefined();
    expect(screen.getByText('Output')).toBeDefined();
  });

  it('starts workflow execution when Start button is clicked in active view', () => {
    render(<WorkflowsTab />);
    const startButtons = screen.getAllByText('▶ Start Workflow');
    fireEvent.click(startButtons[0]);
    fireEvent.click(screen.getByText('▶ Start'));

    // First step should be running (name appears in timeline + output panel)
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getAllByText('Strategy & Sitemap').length).toBeGreaterThanOrEqual(1);

    // After 3 seconds, first step should be done and second step running
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getAllByText('Copywriting').length).toBeGreaterThanOrEqual(1);
  });

  it('pauses and resumes workflow execution', () => {
    render(<WorkflowsTab />);
    const startButtons = screen.getAllByText('▶ Start Workflow');
    fireEvent.click(startButtons[0]);
    fireEvent.click(screen.getByText('▶ Start'));

    // Pause
    fireEvent.click(screen.getByText('⏸ Pause'));
    expect(screen.getByText('▶ Resume')).toBeDefined();

    // Resume
    fireEvent.click(screen.getByText('▶ Resume'));
    expect(screen.getByText('⏸ Pause')).toBeDefined();
  });

  it('resets workflow when reset button is clicked', () => {
    render(<WorkflowsTab />);
    const startButtons = screen.getAllByText('▶ Start Workflow');
    fireEvent.click(startButtons[0]);
    fireEvent.click(screen.getByText('▶ Start'));

    // Reset
    fireEvent.click(screen.getByText('↺ Reset'));
    // Should show start button again
    expect(screen.getByText('▶ Start')).toBeDefined();
  });

  it('goes back to workflow list when back button is clicked', () => {
    render(<WorkflowsTab />);
    const startButtons = screen.getAllByText('▶ Start Workflow');
    fireEvent.click(startButtons[0]);
    fireEvent.click(screen.getByText('← Back'));
    // Should show the workflow list again
    expect(screen.getByText('🔄 Workflows')).toBeDefined();
    expect(screen.getAllByText('▶ Start Workflow').length).toBe(12);
  });

  it('calls onRunPrompt when Send to Agent is clicked', () => {
    const onRunPrompt = vi.fn();
    render(<WorkflowsTab onRunPrompt={onRunPrompt} />);
    const startButtons = screen.getAllByText('▶ Start Workflow');
    fireEvent.click(startButtons[0]);
    fireEvent.click(screen.getByText('▶ Start'));

    // Complete first step
    act(() => {
      vi.advanceTimersByTime(3100);
    });

    // Click Send to Agent for first step
    const sendButtons = screen.getAllByText('⚡ Send to Agent');
    expect(sendButtons.length).toBeGreaterThan(0);
    fireEvent.click(sendButtons[0]);
    expect(onRunPrompt).toHaveBeenCalled();
  });

  it('displays workflow descriptions', () => {
    render(<WorkflowsTab />);
    expect(screen.getByText(/Complete website launch from strategy to deployment/)).toBeDefined();
    expect(screen.getByText(/End-to-end SEO project from audit to content pipeline/)).toBeDefined();
  });
});
