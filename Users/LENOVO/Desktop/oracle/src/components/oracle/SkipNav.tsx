'use client';

import React from 'react';

/**
 * Skip navigation link — the first focusable element on the page.
 * Allows keyboard users to jump directly to the main content area.
 * Visually hidden until focused via Tab key.
 */
export function SkipNav() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-lg focus:bg-[var(--oracle-primary)] focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none"
    >
      Skip to main content
    </a>
  );
}
