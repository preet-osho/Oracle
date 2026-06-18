import type { ToastPosition } from 'react-hot-toast';

// ─── Shared Toast Options ─────────────
// All components should import these defaults instead of repeating them.

export const TOAST_DEFAULTS = {
  duration: 3000,
  position: 'bottom-right' as ToastPosition,
} as const;
