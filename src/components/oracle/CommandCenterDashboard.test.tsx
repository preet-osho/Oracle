import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CommandCenterDashboard } from './CommandCenterDashboard';

vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {} },
  cardHoverProps: {},
  buttonTapProps: {},
}));

describe('CommandCenterDashboard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the header', () => {
    render(<CommandCenterDashboard />);
    expect(screen.getByText(/Agency Command Center/)).toBeDefined();
  });

  it('renders metric cards', () => {
    render(<CommandCenterDashboard />);
    expect(screen.getByText('Active Tasks')).toBeDefined();
    expect(screen.getByText('Training Tasks')).toBeDefined();
    expect(screen.getByText('Revenue')).toBeDefined();
    expect(screen.getByText('Quality Score')).toBeDefined();
  });

  it('renders detail cards', () => {
    render(<CommandCenterDashboard />);
    expect(screen.getByText(/Agent Health/)).toBeDefined();
    expect(screen.getByText(/Self-Training/)).toBeDefined();
    expect(screen.getByText(/System Health/)).toBeDefined();
  });

  it('renders time range buttons', () => {
    render(<CommandCenterDashboard />);
    expect(screen.getByText('24h')).toBeDefined();
    expect(screen.getByText('7d')).toBeDefined();
    expect(screen.getByText('30d')).toBeDefined();
    expect(screen.getByText('All')).toBeDefined();
  });

  it('time range buttons are clickable', () => {
    render(<CommandCenterDashboard />);
    const btn30d = screen.getByText('30d');
    fireEvent.click(btn30d);
    // Should still render without errors
    expect(screen.getByText(/Agency Command Center/)).toBeDefined();
  });

  it('Refresh button is present', () => {
    render(<CommandCenterDashboard />);
    expect(screen.getByText('Refresh')).toBeDefined();
  });

  it('shows auto-refresh footer', () => {
    render(<CommandCenterDashboard />);
    expect(screen.getByText(/Auto-refreshes every 60s/)).toBeDefined();
  });
});
