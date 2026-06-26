import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BrandAssetsPanel } from './BrandAssetsPanel';

vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {} },
  cardHoverProps: {},
  buttonTapProps: {},
}));

describe('BrandAssetsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the header', () => {
    render(<BrandAssetsPanel />);
    expect(screen.getAllByText(/Brand Assets/).length).toBeGreaterThan(0);
  });

  it('renders stat cards', () => {
    render(<BrandAssetsPanel />);
    expect(screen.getByText('Logos')).toBeDefined();
    expect(screen.getByText('Colors')).toBeDefined();
    expect(screen.getByText('Fonts')).toBeDefined();
    expect(screen.getByText('Clients')).toBeDefined();
  });

  it('shows empty state initially', () => {
    render(<BrandAssetsPanel />);
    expect(screen.getByText(/No Brand Assets Yet/)).toBeDefined();
  });

  it('renders font pairing reference', () => {
    render(<BrandAssetsPanel />);
    expect(screen.getByText(/Font Pairing Reference/)).toBeDefined();
  });

  it('Add Asset button toggles form', () => {
    render(<BrandAssetsPanel />);
    const addBtns = screen.getAllByText(/\+ Add Asset/);
    fireEvent.click(addBtns[0]);
    expect(screen.getByText(/Add Brand Asset/)).toBeDefined();
  });

  it('can add a color asset', () => {
    render(<BrandAssetsPanel />);
    const addBtns = screen.getAllByText(/\+ Add Asset/);
    fireEvent.click(addBtns[0]);
    fireEvent.change(screen.getByPlaceholderText('Client name'), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByPlaceholderText(/Asset name/), { target: { value: 'Primary Blue' } });
    fireEvent.change(screen.getByPlaceholderText('#6366f1'), { target: { value: '#6366f1' } });
    fireEvent.click(screen.getByText('Save Asset'));
    expect(screen.getByText('Primary Blue')).toBeDefined();
  });
});
