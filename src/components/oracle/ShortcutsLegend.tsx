'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { motionVariants, transitions } from '@/styles/design-tokens';
import { KEYBOARD_SHORTCUTS, type KeyboardShortcut } from '@/styles/keyboard-shortcuts';
import { useKeyboardShortcutsContext } from '@/hooks/keyboard-shortcuts-context';

// ═══════════════════════════════════════
// ORACLE — Shortcuts Legend Component
// Displays available keyboard shortcuts with status
// ═══════════════════════════════════════

interface ShortcutsLegendProps {
  /** Whether to show the legend as a compact inline badge */
  compact?: boolean;
  /** Custom className */
  className?: string;
  /** Callback when a shortcut is clicked */
  onShortcutClick?: (shortcut: KeyboardShortcut) => void;
}

/**
 * ShortcutsLegend displays all available keyboard shortcuts with their current status.
 * Can be rendered as a compact inline badge or a full list.
 */
export function ShortcutsLegend({
  compact = false,
  className = '',
  onShortcutClick,
}: ShortcutsLegendProps) {
  const { getRegistrations, isGloballyEnabled } = useKeyboardShortcutsContext();

  const registrations = useMemo(() => getRegistrations(), [getRegistrations]);
  const enabledIds = useMemo(
    () => new Set(registrations.filter((r) => r.enabled).map((r) => r.id)),
    [registrations]
  );

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-lg bg-[var(--oracle-surface-2)] px-2.5 py-1.5 text-[10px] text-[var(--oracle-text-muted)] ${className}`}
      >
        <span>⌨️</span>
        <span>
          Press <kbd className="inline-flex items-center justify-center h-4 px-1 rounded border border-[var(--oracle-border)] bg-[var(--oracle-surface-1)] text-[9px] font-mono">?</kbd> for shortcuts
        </span>
      </div>
    );
  }

  return (
    <motion.div
      variants={motionVariants.fadeUp}
      initial="initial"
      animate="animate"
      transition={transitions.smooth}
      className={`oracle-glass rounded-2xl p-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold text-[var(--oracle-text-1)] flex items-center gap-1.5">
          ⌨️ Keyboard Shortcuts
        </h3>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full ${
            isGloballyEnabled
              ? 'bg-[var(--oracle-success)]/15 text-[var(--oracle-success)]'
              : 'bg-[var(--oracle-error)]/15 text-[var(--oracle-error)]'
          }`}
        >
          {isGloballyEnabled ? 'Active' : 'Disabled'}
        </span>
      </div>

      {/* Shortcuts List */}
      <div className="space-y-1.5">
        {KEYBOARD_SHORTCUTS.map((shortcut) => (
          <ShortcutRow
            key={shortcut.id}
            shortcut={shortcut}
            isRegistered={enabledIds.has(shortcut.id)}
            onClick={onShortcutClick}
          />
        ))}
      </div>

      {/* Footer hint */}
      <div className="mt-3 pt-2 border-t border-[var(--oracle-border)]/50 text-center">
        <p className="text-[10px] text-[var(--oracle-text-muted)]">
          {isGloballyEnabled
            ? 'Shortcuts are active — press ? for full list'
            : 'Shortcuts are currently disabled'}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Shortcut Row ──────────────────────

function ShortcutRow({
  shortcut,
  isRegistered,
  onClick,
}: {
  shortcut: KeyboardShortcut;
  isRegistered: boolean;
  onClick?: (shortcut: KeyboardShortcut) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors ${
        onClick ? 'cursor-pointer hover:bg-[var(--oracle-surface-2)]' : ''
      }`}
      onClick={() => onClick?.(shortcut)}
    >
      <span className="text-[11px] text-[var(--oracle-text-3)]">
        {shortcut.description}
      </span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, i) => (
          <React.Fragment key={key}>
            {i > 0 && (
              <span className="text-[9px] text-[var(--oracle-text-muted)]">+</span>
            )}
            <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 rounded border border-[var(--oracle-border)] bg-[var(--oracle-surface-2)] px-1 text-[9px] font-mono text-[var(--oracle-text-3)]">
              {key}
            </kbd>
          </React.Fragment>
        ))}
        {/* Status indicator */}
        <div
          className={`w-1.5 h-1.5 rounded-full ml-1 ${
            isRegistered
              ? 'bg-[var(--oracle-success)]'
              : 'bg-[var(--oracle-text-muted)]'
          }`}
          title={isRegistered ? 'Registered' : 'Not registered'}
        />
      </div>
    </div>
  );
}



export default ShortcutsLegend;