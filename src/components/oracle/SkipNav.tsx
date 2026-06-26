'use client';

import React from 'react';

/**
 * Skip navigation link — the first focusable element on the page.
 * Allows keyboard users to jump directly to the main content area.
 * Visually hidden until focused via Tab key (uses .skip-nav:focus in globals.css).
 */
export function SkipNav() {
  return (
    <a
      href="#main-content"
      className="sr-only skip-nav"
    >
      Skip to main content
    </a>
  );
}
