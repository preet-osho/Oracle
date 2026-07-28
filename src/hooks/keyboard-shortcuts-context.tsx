'use client';

import React, { createContext, useContext, useCallback, useEffect, useRef, useMemo } from 'react';
import { KEYBOARD_SHORTCUTS, matchesShortcut, getCustomShortcuts, saveCustomShortcuts, exportCustomizations, importCustomizations, type KeyboardShortcut, type ShortcutCustomization } from '@/styles/keyboard-shortcuts';

// ═══════════════════════════════════════
// ORACLE — Keyboard Shortcuts Context
// Share keyboard shortcut handlers across components
// ═══════════════════════════════════════

/**
 * A registered shortcut handler
 */
export interface ShortcutRegistration {
  /** Unique identifier for this registration */
  id: string;
  /** The shortcut to match */
  shortcut: KeyboardShortcut;
  /** Handler function called when the shortcut is triggered */
  handler: (event: KeyboardEvent) => void;
  /** Whether this registration is currently enabled */
  enabled: boolean;
  /** Priority (higher = checked first). Default: 0 */
  priority?: number;
  /** Condition to check before triggering. Return false to skip this handler. */
  condition?: () => boolean;
}

/**
 * Analytics data for a specific shortcut
 */
export interface ShortcutAnalytics {
  /** Registration ID */
  id: string;
  /** Number of times this shortcut has been triggered */
  usageCount: number;
  /** Timestamp of the last trigger */
  lastTriggeredAt: number | null;
  /** Timestamp of the first trigger */
  firstTriggeredAt: number | null;
}

/**
 * Context value for keyboard shortcuts
 */
export interface KeyboardShortcutsContextValue {
  /** Register a new shortcut handler */
  register: (registration: Omit<ShortcutRegistration, 'enabled'> & { enabled?: boolean }) => () => void;
  /** Update an existing registration */
  update: (id: string, updates: Partial<Pick<ShortcutRegistration, 'enabled' | 'handler' | 'condition'>>) => void;
  /** Remove a registration */
  unregister: (id: string) => void;
  /** Get all current registrations */
  getRegistrations: () => ShortcutRegistration[];
  /** Get a specific registration by ID */
  getRegistration: (id: string) => ShortcutRegistration | null;
  /** Enable all shortcuts */
  enableAll: () => void;
  /** Disable all shortcuts */
  disableAll: () => void;
  /** Check if shortcuts are globally enabled */
  isGloballyEnabled: boolean;
  /** Toggle global enable/disable */
  toggleGlobal: () => void;
  /** Get analytics for all shortcuts */
  getAnalytics: () => ShortcutAnalytics[];
  /** Get analytics for a specific shortcut */
  getShortcutAnalytics: (id: string) => ShortcutAnalytics | null;
  /** Reset analytics data */
  resetAnalytics: () => void;
  /** Get all custom shortcut mappings */
  getCustomizations: () => ShortcutCustomization[];
  /** Set a custom shortcut mapping */
  setCustomization: (customization: ShortcutCustomization) => void;
  /** Remove a custom shortcut mapping */
  removeCustomization: (shortcutId: string) => void;
  /** Reset all shortcuts to defaults */
  resetToDefaults: () => void;
  /** Get effective keys for a shortcut (custom or default) */
  getEffectiveKeys: (shortcutId: string) => { keys: string[]; alternateKeys?: string[]; requiresModifier?: boolean; requiresShift?: boolean };
  /** Export customizations as JSON string */
  exportCustomizations: () => string;
  /** Import customizations from JSON string. Returns errors if any. */
  importCustomizations: (json: string) => string[];
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null);

/**
 * Provider component for keyboard shortcuts.
 * Wraps the app to enable shared keyboard shortcut handling.
 */
export function KeyboardShortcutsProvider({
  children,
  enabled: initialEnabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const registrationsRef = useRef<Map<string, ShortcutRegistration>>(new Map());
  const analyticsRef = useRef<Map<string, { count: number; firstAt: number | null; lastAt: number | null }>>(new Map());
  const [renderTick, forceRender] = React.useReducer((x: number) => x + 1, 0);
  const isGloballyEnabledRef = useRef(initialEnabled);

  // Use ref for isGloballyEnabled to avoid stale closures in event handler
  const isGloballyEnabled = isGloballyEnabledRef.current;

  const register = useCallback(
    (
      registration: Omit<ShortcutRegistration, 'enabled'> & { enabled?: boolean }
    ): (() => void) => {
      const id = registration.id;

      // Warn in development if duplicate ID is registered
      if (process.env.NODE_ENV === 'development' && registrationsRef.current.has(id)) {
        console.warn(
          `[KeyboardShortcuts] Duplicate registration ID: "${id}". ` +
          `This will overwrite the existing registration. ` +
          `Consider using a unique ID to avoid unintended behavior.`
        );
      }

      const entry: ShortcutRegistration = {
        ...registration,
        enabled: registration.enabled ?? true,
      };
      registrationsRef.current.set(id, entry);
      forceRender();

      // Return cleanup function
      return () => {
        registrationsRef.current.delete(id);
        forceRender();
      };
    },
    []
  );

  const update = useCallback(
    (id: string, updates: Partial<Pick<ShortcutRegistration, 'enabled' | 'handler' | 'condition'>>) => {
      const existing = registrationsRef.current.get(id);
      if (existing) {
        registrationsRef.current.set(id, { ...existing, ...updates });
        forceRender();
      }
    },
    []
  );

  const unregister = useCallback((id: string) => {
    registrationsRef.current.delete(id);
    analyticsCacheRef.current.delete(id);
    forceRender();
  }, []);

  const getRegistrations = useCallback((): ShortcutRegistration[] => {
    return Array.from(registrationsRef.current.values());
  }, []);

  const getRegistration = useCallback((id: string): ShortcutRegistration | null => {
    return registrationsRef.current.get(id) ?? null;
  }, []);

  const enableAll = useCallback(() => {
    isGloballyEnabledRef.current = true;
    forceRender();
  }, []);

  const disableAll = useCallback(() => {
    isGloballyEnabledRef.current = false;
    forceRender();
  }, []);

  const toggleGlobal = useCallback(() => {
    isGloballyEnabledRef.current = !isGloballyEnabledRef.current;
    forceRender();
  }, []);

  // Customization state
  const [customizations, setCustomizations] = React.useState<ShortcutCustomization[]>(() => getCustomShortcuts());

  const getCustomizations = useCallback((): ShortcutCustomization[] => {
    return customizations;
  }, [customizations]);

  const setCustomization = useCallback((customization: ShortcutCustomization) => {
    setCustomizations(prev => {
      const existing = prev.findIndex(c => c.shortcutId === customization.shortcutId);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = customization;
        return next;
      }
      return [...prev, customization];
    });
  }, []);

  const removeCustomization = useCallback((shortcutId: string) => {
    setCustomizations(prev => prev.filter(c => c.shortcutId !== shortcutId));
  }, []);

  const resetToDefaults = useCallback(() => {
    setCustomizations([]);
  }, []);

  // Persist customizations to localStorage when they change
  useEffect(() => {
    saveCustomShortcuts(customizations);
  }, [customizations]);

  const getEffectiveKeysForShortcut = useCallback((shortcutId: string) => {
    const shortcut = KEYBOARD_SHORTCUTS.find(s => s.id === shortcutId);
    if (!shortcut) return { keys: [] };
    const customization = customizations.find(c => c.shortcutId === shortcutId);
    if (customization) {
      return {
        keys: customization.customKeys,
        alternateKeys: customization.customAlternateKeys,
        requiresModifier: customization.requiresModifier ?? shortcut.requiresModifier,
        requiresShift: customization.requiresShift ?? shortcut.requiresShift,
      };
    }
    return {
      keys: shortcut.keys,
      alternateKeys: shortcut.alternateKeys,
      requiresModifier: shortcut.requiresModifier,
      requiresShift: shortcut.requiresShift,
    };
  }, [customizations]);

  const doExportCustomizations = useCallback((): string => {
    return exportCustomizations(customizations);
  }, [customizations]);

  const doImportCustomizations = useCallback((json: string): string[] => {
    const result = importCustomizations(json);
    if (result.customizations.length > 0) {
      setCustomizations(result.customizations);
    }
    return result.errors;
  }, [setCustomizations]);


  const getAnalytics = useCallback((): ShortcutAnalytics[] => {
    return Array.from(analyticsRef.current.entries()).map(([id, data]) => ({
      id,
      usageCount: data.count,
      lastTriggeredAt: data.lastAt,
      firstTriggeredAt: data.firstAt,
    }));
  }, []);

  // Cache analytics results by id to avoid creating new objects on every call
  const analyticsCacheRef = useRef<Map<string, ShortcutAnalytics>>(new Map());

  const getShortcutAnalytics = useCallback((id: string): ShortcutAnalytics | null => {
    const data = analyticsRef.current.get(id);
    if (!data) {
      analyticsCacheRef.current.delete(id);
      return null;
    }
    const cached = analyticsCacheRef.current.get(id);
    // Return cached if data hasn't changed
    if (
      cached &&
      cached.usageCount === data.count &&
      cached.lastTriggeredAt === data.lastAt &&
      cached.firstTriggeredAt === data.firstAt
    ) {
      return cached;
    }
    const result: ShortcutAnalytics = {
      id,
      usageCount: data.count,
      lastTriggeredAt: data.lastAt,
      firstTriggeredAt: data.firstAt,
    };
    analyticsCacheRef.current.set(id, result);
    return result;
  }, []);

  const resetAnalytics = useCallback(() => {
    analyticsRef.current.clear();
    analyticsCacheRef.current.clear();
    forceRender();
  }, []);

  // Global keyboard event handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Check if globally enabled
      if (!isGloballyEnabledRef.current) return;

      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (isInput) return;

      // Get all registrations sorted by priority (highest first)
      const registrations = Array.from(registrationsRef.current.values())
        .filter((r) => r.enabled)
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      // Check each registration
      for (const registration of registrations) {
        // Check condition if provided
        if (registration.condition && !registration.condition()) {
          continue;
        }

        // Check if the shortcut matches
        if (matchesShortcut(e, registration.shortcut)) {
          e.preventDefault();
          e.stopPropagation();
          registration.handler(e);

          // Track analytics
          const now = Date.now();
          const existing = analyticsRef.current.get(registration.id);
          analyticsRef.current.set(registration.id, {
            count: (existing?.count ?? 0) + 1,
            firstAt: existing?.firstAt ?? now,
            lastAt: now,
          });

          // Force re-render so consumers can see updated analytics
          forceRender();

          // Don't break - allow multiple handlers for the same shortcut
          // (e.g., ? opens shortcuts help AND logs analytics)
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const contextValue = useMemo<KeyboardShortcutsContextValue>(
    () => ({
      register,
      update,
      unregister,
      getRegistrations,
      getRegistration,
      enableAll,
      disableAll,
      isGloballyEnabled,
      toggleGlobal,
      getAnalytics,
      getShortcutAnalytics,
      resetAnalytics,
      getCustomizations,
      setCustomization,
      removeCustomization,
      resetToDefaults,
      getEffectiveKeys: getEffectiveKeysForShortcut,
      exportCustomizations: doExportCustomizations,
      importCustomizations: doImportCustomizations,
    }),
    [renderTick, register, update, unregister, getRegistrations, getRegistration, enableAll, disableAll, isGloballyEnabled, toggleGlobal, getAnalytics, getShortcutAnalytics, resetAnalytics, customizations, getCustomizations, setCustomization, removeCustomization, resetToDefaults, getEffectiveKeysForShortcut, doExportCustomizations, doImportCustomizations]
  );

  return (
    <KeyboardShortcutsContext.Provider value={contextValue}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

/**
 * Hook to access the keyboard shortcuts context.
 * Must be used within a KeyboardShortcutsProvider.
 */
export function useKeyboardShortcutsContext(): KeyboardShortcutsContextValue {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error(
      'useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider'
    );
  }
  return context;
}

/**
 * Hook to register a keyboard shortcut handler.
 * Automatically registers on mount and unregisters on unmount.
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   id: 'my-component-shortcut',
 *   shortcut: KEYBOARD_SHORTCUTS[0], // Ctrl+P
 *   handler: () => console.log('PDF preview opened'),
 * });
 * ```
 */
export function useKeyboardShortcuts({
  id,
  shortcut,
  handler,
  enabled = true,
  priority = 0,
  condition,
}: {
  id: string;
  shortcut: KeyboardShortcut;
  handler: (event: KeyboardEvent) => void;
  enabled?: boolean;
  priority?: number;
  condition?: () => boolean;
}): void {
  const { register, update } = useKeyboardShortcutsContext();

  // Register on mount, update when props change
  useEffect(() => {
    const cleanup = register({
      id,
      shortcut,
      handler,
      enabled,
      priority,
      condition,
    });

    return cleanup;
  }, [id]); // Only re-register if id changes

  // Update handler, enabled, and condition when they change
  useEffect(() => {
    update(id, { handler, enabled, condition });
  }, [id, handler, enabled, condition]);
}

/**
 * Result of useKeyboardShortcutStatus
 */
export interface ShortcutStatus {
  /** Whether the shortcut is registered */
  isRegistered: boolean;
  /** Whether the shortcut is currently enabled */
  isEnabled: boolean;
  /** The registration data, if registered */
  registration: ShortcutRegistration | null;
  /** Analytics data for this shortcut, if available */
  analytics: ShortcutAnalytics | null;
}

/**
 * Hook to check the status of a specific keyboard shortcut.
 * Returns whether it's registered, enabled, and its analytics data.
 *
 * @example
 * ```tsx
 * const status = useKeyboardShortcutStatus('pdf-preview');
 * if (status.isRegistered && status.isEnabled) {
 *   console.log('PDF shortcut is active');
 * }
 * ```
 */
export function useKeyboardShortcutStatus(id: string): ShortcutStatus {
  const { getRegistration, getShortcutAnalytics } = useKeyboardShortcutsContext();

  const registration = getRegistration(id);
  const analytics = getShortcutAnalytics(id);

  return {
    isRegistered: registration !== null,
    isEnabled: registration?.enabled ?? false,
    registration,
    analytics,
  };
}

export default KeyboardShortcutsContext;