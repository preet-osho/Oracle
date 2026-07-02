// ═══════════════════════════════════════
// ORACLE — TabErrorBoundary Tests
// Crash fallback · Retry limit · Counter reset
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TabErrorBoundary } from './TabErrorBoundary';

// ─── Throwing Child Helper ─────────────

let shouldThrow = false;
let throwMessage = 'Test error';

function ThrowingChild() {
  if (shouldThrow) {
    throw new Error(throwMessage);
  }
  return <div data-testid="child-content">Child rendered</div>;
}

// Suppress React error boundary console.error in tests
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  shouldThrow = false;
  throwMessage = 'Test error';
  consoleErrorSpy.mockClear();
});

// ─── Tests ─────────────────────────────

describe('TabErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <TabErrorBoundary tabName="Test Tab">
        <ThrowingChild />
      </TabErrorBoundary>
    );

    expect(screen.getByTestId('child-content')).toBeTruthy();
    expect(screen.getByText('Child rendered')).toBeTruthy();
  });

  it('shows fallback UI when child throws', () => {
    shouldThrow = true;

    render(
      <TabErrorBoundary tabName="Projects">
        <ThrowingChild />
      </TabErrorBoundary>
    );

    expect(screen.getByText('Projects failed to load')).toBeTruthy();
    expect(screen.getByText('Test error')).toBeTruthy();
    expect(screen.queryByTestId('child-content')).toBeNull();
  });

  it('shows retry button with correct count on first crash', () => {
    shouldThrow = true;

    render(
      <TabErrorBoundary tabName="Agent">
        <ThrowingChild />
      </TabErrorBoundary>
    );

    expect(screen.getByText(/Try Again/)).toBeTruthy();
    expect(screen.getByText(/1\/3/)).toBeTruthy();
  });

  it('increments retry counter on each Try Again click', async () => {
    const user = userEvent.setup();
    shouldThrow = true;

    render(
      <TabErrorBoundary tabName="Agent">
        <ThrowingChild />
      </TabErrorBoundary>
    );

    // First retry
    const tryAgainBtn = screen.getByRole('button', { name: /Try Again/ });
    await act(async () => {
      await user.click(tryAgainBtn);
    });
    // After click, hasError resets to false, child re-renders, but throws again
    // So we should see the fallback again with count 2/3
    expect(screen.getByText(/2\/3/)).toBeTruthy();

    // Second retry
    const tryAgainBtn2 = screen.getByRole('button', { name: /Try Again/ });
    await act(async () => {
      await user.click(tryAgainBtn2);
    });
    expect(screen.getByText(/3\/3/)).toBeTruthy();
  });

  it('disables retry button after MAX_RETRIES (3) attempts', async () => {
    const user = userEvent.setup();
    shouldThrow = true;

    render(
      <TabErrorBoundary tabName="Agent">
        <ThrowingChild />
      </TabErrorBoundary>
    );

    // Click Try Again 3 times
    for (let i = 0; i < 3; i++) {
      const btn = screen.getByRole('button', { name: /Try Again/ });
      await act(async () => {
        await user.click(btn);
      });
    }

    // After 3 retries, "Max retries reached" should appear
    expect(screen.getByText('Max retries reached')).toBeTruthy();
    // Try Again button should no longer exist
    expect(screen.queryByRole('button', { name: /Try Again/ })).toBeNull();
  });

  it('shows Reload Page button in fallback UI', () => {
    shouldThrow = true;

    render(
      <TabErrorBoundary tabName="Test">
        <ThrowingChild />
      </TabErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /Reload Page/ })).toBeTruthy();
  });

  it('resets retry count when component unmounts and remounts', async () => {
    const user = userEvent.setup();
    shouldThrow = true;

    const { unmount } = render(
      <TabErrorBoundary tabName="Agent">
        <ThrowingChild />
      </TabErrorBoundary>
    );

    // Click Try Again once
    const btn = screen.getByRole('button', { name: /Try Again/ });
    await act(async () => {
      await user.click(btn);
    });
    expect(screen.getByText(/2\/3/)).toBeTruthy();

    // Unmount
    unmount();

    // Remount fresh
    render(
      <TabErrorBoundary tabName="Agent">
        <ThrowingChild />
      </TabErrorBoundary>
    );

    // Should start at 1/3 again
    expect(screen.getByText(/1\/3/)).toBeTruthy();
  });

  it('recovers when child stops throwing after retry', async () => {
    const user = userEvent.setup();
    shouldThrow = true;

    render(
      <TabErrorBoundary tabName="Agent">
        <ThrowingChild />
      </TabErrorBoundary>
    );

    // Verify fallback is shown
    expect(screen.getByText('Agent failed to load')).toBeTruthy();

    // Fix the error before retrying
    shouldThrow = false;

    // Click Try Again
    const btn = screen.getByRole('button', { name: /Try Again/ });
    await act(async () => {
      await user.click(btn);
    });

    // Child should now render successfully
    expect(screen.getByTestId('child-content')).toBeTruthy();
    expect(screen.getByText('Child rendered')).toBeTruthy();
    // Fallback should be gone
    expect(screen.queryByText('Agent failed to load')).toBeNull();
  });

  it('logs error to console.error when child crashes', () => {
    shouldThrow = true;

    render(
      <TabErrorBoundary tabName="Debug Tab">
        <ThrowingChild />
      </TabErrorBoundary>
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[TabErrorBoundary] Debug Tab crashed:'),
      expect.any(Error),
      expect.any(Object)
    );
  });
});
