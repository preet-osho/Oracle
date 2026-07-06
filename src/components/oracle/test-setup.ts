/**
 * Oracle-specific test setup.
 * Loaded automatically by vitest for oracle tests (merged with root setupTests.ts).
 * Contains framer-motion and design-tokens mocks that are only needed by oracle components.
 */

// ── framer-motion mock (plain HTML passthrough) ──
// Strips framer-motion-specific props so React doesn't warn about unknown DOM attributes.
const FRAMER_PROPS = new Set([
  'whileHover', 'whileTap', 'whileInView', 'whileDrag', 'whileFocus',
  'layout', 'variants', 'initial', 'animate', 'exit', 'transition',
  'drag', 'dragConstraints', 'dragElastic', 'dragMomentum',
  'onDragStart', 'onDragEnd', 'onAnimationStart', 'onAnimationComplete',
  'layoutId', 'layoutDependency', 'onLayoutAnimationStart',
]);

function stripFramerProps(props: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const key in props) {
    if (!FRAMER_PROPS.has(key)) clean[key] = props[key];
  }
  return clean;
}

vi.mock('framer-motion', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  const wrap = (tag: string) => (p: Record<string, unknown>) =>
    R.createElement(tag, stripFramerProps(p), p.children);
  return {
    motion: {
      div: wrap('div'),
      button: wrap('button'),
      span: wrap('span'),
      a: wrap('a'),
      p: wrap('p'),
      li: wrap('li'),
      ul: wrap('ul'),
      img: wrap('img'),
      aside: wrap('aside'),
      // SVG elements used inside motion wrappers (e.g. recharts gradients)
      linearGradient: wrap('linearGradient'),
      stop: wrap('stop'),
      defs: wrap('defs'),
    },
    AnimatePresence: (p: { children: React.ReactNode }) => R.createElement(R.Fragment, null, p.children),
  };
});

// ── ScrollArea viewport.getAnimations polyfill ──
// base-ui's ScrollAreaViewport calls viewportRef.current.getAnimations() which isn't in jsdom.
Element.prototype.getAnimations = function () {
  return [];
};

// ── design-tokens mock ──
vi.mock('@/styles/design-tokens', () => ({
  motionVariants: { fadeUp: {} },
  transitions: { smooth: {}, snappy: {} },
  buttonTapProps: {},
}));
