'use client';

import toast, { type ToastPosition } from 'react-hot-toast';
import { TOAST_DEFAULTS } from './toast-config';

// ─── Toast Types ──────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  /** Duration in ms. Default 3000 */
  duration?: number;
  /** Position override */
  position?: ToastPosition;
}

// ─── Shared Styles ────────────────────

const BASE_STYLE = {
  background: 'var(--oracle-surface-2)',
  color: 'var(--oracle-text-1)',
  border: '1px solid var(--oracle-border)',
  fontSize: '13px',
  fontWeight: 500,
  borderRadius: '12px',
  padding: '10px 16px',
  maxWidth: '380px',
} as const;

const ICON_MAP: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

const BORDER_COLOR_MAP: Record<ToastType, string> = {
  success: 'var(--oracle-success)',
  error: 'var(--oracle-error)',
  warning: 'var(--oracle-warning)',
  info: 'var(--oracle-info)',
};

// ─── Hook ─────────────────────────────

export function useToast() {
  const show = (type: ToastType, message: string, options?: ToastOptions) => {
    const icon = ICON_MAP[type];
    const borderColor = BORDER_COLOR_MAP[type];

    const toastFn = type === 'error' ? toast.error
      : type === 'success' ? toast.success
      : toast;

    toastFn(`${icon} ${message}`, {
      duration: options?.duration ?? TOAST_DEFAULTS.duration,
      position: options?.position ?? TOAST_DEFAULTS.position,
      style: {
        ...BASE_STYLE,
        borderLeft: `3px solid ${borderColor}`,
      },
    });
  };

  return {
    /** Show a success toast */
    success: (message: string, options?: ToastOptions) => show('success', message, options),
    /** Show an error toast */
    error: (message: string, options?: ToastOptions) => show('error', message, options),
    /** Show a warning toast */
    warning: (message: string, options?: ToastOptions) => show('warning', message, options),
    /** Show an info toast */
    info: (message: string, options?: ToastOptions) => show('info', message, options),
    /** Dismiss all toasts */
    dismiss: () => toast.dismiss(),
  };
}
