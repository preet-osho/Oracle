import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { IntelligenceReportsPanel } from './IntelligenceReportsPanel';

vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {} },
  cardHoverProps: {},
  buttonTapProps: {},
}));

describe('IntelligenceReportsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the header', () => {
    render(<IntelligenceReportsPanel />);
    expect(screen.getByText(/Intelligence Hub/)).toBeDefined();
  });

  it('renders section tabs', () => {
    render(<IntelligenceReportsPanel />);
    expect(screen.getAllByText(/Reports/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tools/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Trends/).length).toBeGreaterThan(0);
  });

  it('renders stat cards', () => {
    render(<IntelligenceReportsPanel />);
    expect(screen.getByText('Reports')).toBeDefined();
    expect(screen.getByText('Free Tools')).toBeDefined();
    expect(screen.getByText('Patterns Detected')).toBeDefined();
    expect(screen.getByText('Upsell Offers')).toBeDefined();
  });

  it('shows empty state for reports', () => {
    render(<IntelligenceReportsPanel />);
    expect(screen.getByText(/No reports yet/)).toBeDefined();
  });

  it('generate report button works', () => {
    render(<IntelligenceReportsPanel />);
    fireEvent.click(screen.getByText(/Generate.*Report/));
    // After click, report count should increase
  });

  it('tools tab shows free tools', () => {
    render(<IntelligenceReportsPanel />);
    const toolsBtns = screen.getAllByText(/Tools/);
    fireEvent.click(toolsBtns[0]);
    expect(screen.getByText(/Free Tools Arsenal/)).toBeDefined();
  });

  it('trends tab shows trend alerts', () => {
    render(<IntelligenceReportsPanel />);
    const trendsBtns = screen.getAllByText(/Trends/);
    fireEvent.click(trendsBtns[0]);
    expect(screen.getByText(/Trend Alerts/)).toBeDefined();
  });
});
