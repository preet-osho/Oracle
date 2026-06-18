import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SatisfactionTrackerPanel } from './SatisfactionTrackerPanel';

vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {} },
  cardHoverProps: {},
  buttonTapProps: {},
}));

describe('SatisfactionTrackerPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the header', () => {
    render(<SatisfactionTrackerPanel />);
    expect(screen.getByText(/Client Satisfaction/)).toBeDefined();
  });

  it('renders stat cards', () => {
    render(<SatisfactionTrackerPanel />);
    expect(screen.getByText('Overall NPS')).toBeDefined();
    expect(screen.getByText('Avg Rating')).toBeDefined();
    expect(screen.getByText('Total Responses')).toBeDefined();
    expect(screen.getByText('Promoters')).toBeDefined();
  });

  it('shows empty state initially', () => {
    render(<SatisfactionTrackerPanel />);
    expect(screen.getByText(/No Satisfaction Data/)).toBeDefined();
  });

  it('Add Entry button toggles form', () => {
    render(<SatisfactionTrackerPanel />);
    const addButtons = screen.getAllByText(/\+ Add Entry/);
    fireEvent.click(addButtons[0]);
    expect(screen.getByText(/Add Satisfaction Entry/)).toBeDefined();
    expect(screen.getByPlaceholderText('Client name')).toBeDefined();
  });

  it('can add a satisfaction entry', () => {
    render(<SatisfactionTrackerPanel />);
    const addButtons = screen.getAllByText(/\+ Add Entry/);
    fireEvent.click(addButtons[0]);
    fireEvent.change(screen.getByPlaceholderText('Client name'), { target: { value: 'Acme Corp' } });
    fireEvent.click(screen.getByText('Save Entry'));
    expect(screen.getByText('Acme Corp')).toBeDefined();
  });
});
