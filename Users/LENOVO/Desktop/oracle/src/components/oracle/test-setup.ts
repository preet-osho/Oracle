/**
 * Oracle-specific test setup.
 * Loaded automatically by vitest for oracle tests (merged with root setupTests.ts).
 * Contains framer-motion and design-tokens mocks that are only needed by oracle components.
 */

// ── framer-motion mock (plain HTML passthrough) ──
vi.mock('framer-motion', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  return {
    motion: {
      div: (p: Record<string, unknown>) => R.createElement('div', p, p.children),
      button: (p: Record<string, unknown>) => R.createElement('button', p, p.children),
      span: (p: Record<string, unknown>) => R.createElement('span', p, p.children),
    },
    AnimatePresence: (p: { children: React.ReactNode }) => R.createElement(R.Fragment, null, p.children),
  };
});

// ── design-tokens mock ──
vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {}, snappy: {} },
  buttonTapProps: {},
}));
