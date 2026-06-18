import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ProactiveInsightsPanel } from './ProactiveInsightsPanel';

vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {} },
  cardHoverProps: {},
  buttonTapProps: {},
}));

describe('ProactiveInsightsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the header', () => {
    render(<ProactiveInsightsPanel />);
    expect(screen.getByText(/Proactive Intelligence/)).toBeDefined();
  });

  it('renders stat cards', () => {
    render(<ProactiveInsightsPanel />);
    expect(screen.getByText('Active Risks')).toBeDefined();
    expect(screen.getByText('Opportunities')).toBeDefined();
    expect(screen.getByText('Dismissed')).toBeDefined();
    expect(screen.getByText('Total Scans')).toBeDefined();
  });

  it('renders client context editor', () => {
    render(<ProactiveInsightsPanel />);
    expect(screen.getByText(/Client Context/)).toBeDefined();
  });

  it('renders Run Scan button', () => {
    render(<ProactiveInsightsPanel />);
    expect(screen.getAllByText(/Run Scan/).length).toBeGreaterThan(0);
  });

  it('shows empty state initially', () => {
    render(<ProactiveInsightsPanel />);
    expect(screen.getByText(/No Insights Yet/)).toBeDefined();
  });

  it('run scan produces insights', async () => {
    render(<ProactiveInsightsPanel />);
    const scanBtns = screen.getAllByText(/Run Scan/);
    const scanBtn = scanBtns[0];
    fireEvent.click(scanBtn);
    await waitFor(() => {
      expect(screen.getByText(/Scan complete/)).toBeDefined();
    }, { timeout: 3000 });
    // Default context has risks (overdueInvoiceCount: 1, lowGoogleRating, noGSC, noGA4)
    expect(screen.getByText(/Active Insights/)).toBeDefined();
  });
});
