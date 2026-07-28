import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShortcutsLegend } from './ShortcutsLegend';
import { KeyboardShortcutsProvider } from '@/hooks/keyboard-shortcuts-context';

// ─── Wrapper Component ────────────────

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardShortcutsProvider>
      {children}
    </KeyboardShortcutsProvider>
  );
}

// ─── Tests ────────────────────────────

describe('ShortcutsLegend', () => {
  describe('compact mode', () => {
    it('renders compact hint text', () => {
      render(
        <TestWrapper>
          <ShortcutsLegend compact />
        </TestWrapper>
      );

      expect(screen.getByText(/for shortcuts/)).toBeTruthy();
    });

    it('applies custom className', () => {
      const { container } = render(
        <TestWrapper>
          <ShortcutsLegend compact className="my-custom-class" />
        </TestWrapper>
      );

      expect(container.querySelector('.my-custom-class')).toBeTruthy();
    });
  });

  describe('full mode', () => {
    it('renders the header', () => {
      render(
        <TestWrapper>
          <ShortcutsLegend />
        </TestWrapper>
      );

      expect(screen.getByText(/Keyboard Shortcuts/)).toBeTruthy();
    });

    it('shows active status by default', () => {
      render(
        <TestWrapper>
          <ShortcutsLegend />
        </TestWrapper>
      );

      expect(screen.getByText('Active')).toBeTruthy();
    });

    it('renders all keyboard shortcuts', () => {
      render(
        <TestWrapper>
          <ShortcutsLegend />
        </TestWrapper>
      );

      // Check that all 5 shortcuts are rendered
      expect(screen.getByText('Open PDF preview & export')).toBeTruthy();
      expect(screen.getByText('Export as Word document')).toBeTruthy();
      expect(screen.getByText('Export as CSV file')).toBeTruthy();
      expect(screen.getByText('Show this shortcuts panel')).toBeTruthy();
      expect(screen.getByText('Close modal / panel')).toBeTruthy();
    });

    it('renders keyboard key badges', () => {
      render(
        <TestWrapper>
          <ShortcutsLegend />
        </TestWrapper>
      );

      // Check that kbd elements exist (multiple shortcuts have Ctrl, so use queryAllByText)
      const ctrlKeys = screen.queryAllByText('Ctrl');
      expect(ctrlKeys.length).toBeGreaterThan(0);
    });

    it('calls onClick when a shortcut row is clicked', () => {
      const onClick = vi.fn();

      render(
        <TestWrapper>
          <ShortcutsLegend onShortcutClick={onClick} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Open PDF preview & export'));
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Open PDF preview & export',
        })
      );
    });

    it('shows footer hint', () => {
      render(
        <TestWrapper>
          <ShortcutsLegend />
        </TestWrapper>
      );

      expect(screen.getByText('Shortcuts are active — press ? for full list')).toBeTruthy();
    });

    it('applies custom className', () => {
      const { container } = render(
        <TestWrapper>
          <ShortcutsLegend className="my-custom-class" />
        </TestWrapper>
      );

      expect(container.querySelector('.my-custom-class')).toBeTruthy();
    });
  });
});