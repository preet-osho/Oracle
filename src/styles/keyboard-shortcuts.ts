// ═══════════════════════════════════════
// ORACLE — Keyboard Shortcuts Configuration
// Shared constants for keyboard shortcuts across components
// ═══════════════════════════════════════

export interface KeyboardShortcut {
  /** Unique identifier for this shortcut */
  id: string;
  /** The key combination (e.g., ['Ctrl', 'P']) */
  keys: string[];
  /** Alternative key combinations (e.g., ['/', 'Shift'] for ?) */
  alternateKeys?: string[];
  /** Human-readable description of what the shortcut does */
  description: string;
  /** Whether the shortcut requires a modifier key (Ctrl/Cmd) */
  requiresModifier?: boolean;
  /** Whether the shortcut requires Shift */
  requiresShift?: boolean;
}

/**
 * All available keyboard shortcuts in the application.
 * Use this array to render shortcut hints, help panels, or documentation.
 */
export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    id: 'pdf-preview',
    keys: ['Ctrl', 'P'],
    description: 'Open PDF preview & export',
    requiresModifier: true,
  },
  {
    id: 'export-word',
    keys: ['Ctrl', 'Shift', 'W'],
    description: 'Export as Word document',
    requiresModifier: true,
    requiresShift: true,
  },
  {
    id: 'export-csv',
    keys: ['Ctrl', 'S'],
    description: 'Export as CSV file',
    requiresModifier: true,
  },
  {
    id: 'shortcuts-help',
    keys: ['?'],
    alternateKeys: ['/'],
    description: 'Show this shortcuts panel',
    requiresShift: true,
  },
  {
    id: 'god-mode-toggle',
    keys: ['Ctrl', 'Shift', 'G'],
    description: 'Toggle GOD MODE on/off',
    requiresModifier: true,
    requiresShift: true,
  },
  {
    id: 'escape-close',
    keys: ['Escape'],
    description: 'Close modal / panel',
  },
];

/**
 * Custom shortcut mapping (user-defined overrides)
 */
export interface ShortcutCustomization {
  /** The shortcut ID to customize */
  shortcutId: string;
  /** Custom key combination */
  customKeys: string[];
  /** Alternative key combinations */
  customAlternateKeys?: string[];
  /** Whether the custom shortcut requires a modifier key */
  requiresModifier?: boolean;
  /** Whether the custom shortcut requires Shift */
  requiresShift?: boolean;
}

/**
 * Storage key for custom shortcuts in localStorage
 */
const CUSTOM_SHORTCUTS_STORAGE_KEY = 'oracle-custom-shortcuts';

/**
 * Get custom shortcuts from localStorage
 */
export function getCustomShortcuts(): ShortcutCustomization[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CUSTOM_SHORTCUTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save custom shortcuts to localStorage
 */
export function saveCustomShortcuts(customizations: ShortcutCustomization[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_SHORTCUTS_STORAGE_KEY, JSON.stringify(customizations));
  } catch {
    // localStorage not available or full
  }
}

/**
 * Get the effective keys for a shortcut (custom or default)
 */
export function getEffectiveKeys(shortcutId: string): { keys: string[]; alternateKeys?: string[]; requiresModifier?: boolean; requiresShift?: boolean } {
  const shortcut = KEYBOARD_SHORTCUTS.find(s => s.id === shortcutId);
  if (!shortcut) return { keys: [] };

  const customizations = getCustomShortcuts();
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
}

/**
 * Export customizations as a JSON string for sharing.
 */
export function exportCustomizations(customizations: ShortcutCustomization[]): string {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    customizations,
  }, null, 2);
}

/**
 * Import customizations from a JSON string.
 * Returns the parsed customizations or null if invalid.
 */
export function importCustomizations(json: string): { customizations: ShortcutCustomization[]; errors: string[] } {
  const errors: string[] = [];
  try {
    const parsed = JSON.parse(json);

    // Validate structure
    if (!parsed || typeof parsed !== 'object') {
      errors.push('Invalid format: expected an object');
      return { customizations: [], errors };
    }

    if (!Array.isArray(parsed.customizations)) {
      errors.push('Invalid format: missing customizations array');
      return { customizations: [], errors };
    }

    // Check version for future compatibility
    if (typeof parsed.version === 'number' && parsed.version > 1) {
      errors.push(`Unsupported version: ${parsed.version}. Please update your application.`);
      return { customizations: [], errors };
    }

    // Validate and filter each customization
    const validShortcuts = new Set(KEYBOARD_SHORTCUTS.map(s => s.id));
    const validCustomizations: ShortcutCustomization[] = [];

    for (const item of parsed.customizations) {
      if (!item.shortcutId || typeof item.shortcutId !== 'string') {
        errors.push(`Skipping item: missing shortcutId`);
        continue;
      }

      if (!Array.isArray(item.customKeys) || item.customKeys.length === 0 || !item.customKeys.every((k: unknown) => typeof k === 'string')) {
        errors.push(`Skipping ${item.shortcutId}: invalid customKeys`);
        continue;
      }

      if (!validShortcuts.has(item.shortcutId)) {
        errors.push(`Skipping ${item.shortcutId}: unknown shortcut`);
        continue;
      }

      validCustomizations.push({
        shortcutId: item.shortcutId,
        customKeys: item.customKeys,
        customAlternateKeys: item.customAlternateKeys,
        requiresModifier: item.requiresModifier,
        requiresShift: item.requiresShift,
      });
    }

    return { customizations: validCustomizations, errors };
  } catch {
    return { customizations: [], errors: ['Invalid JSON format'] };
  }
}

/**
 * Conflict detection result for a single shortcut
 */
export interface ShortcutConflict {
  /** The shortcut ID with the conflict */
  shortcutId: string;
  /** IDs of conflicting shortcuts */
  conflictingIds: string[];
  /** The key combination that conflicts */
  conflictingKeys: string[];
}

/**
 * Detect all key combination conflicts between shortcuts.
 * Takes a function to get effective keys for each shortcut.
 * @param getKeysForShortcut - Function that returns effective keys for a shortcut ID
 * @returns Array of conflicts found
 */
export function detectShortcutConflicts(
  getKeysForShortcut: (id: string) => { keys: string[] }
): ShortcutConflict[] {
  const keyMap = new Map<string, string[]>();

  for (const shortcut of KEYBOARD_SHORTCUTS) {
    const keys = getKeysForShortcut(shortcut.id).keys;
    if (keys.length === 0) continue;
    const keyStr = keys.join('+');
    const existing = keyMap.get(keyStr) || [];
    keyMap.set(keyStr, [...existing, shortcut.id]);
  }

  const conflicts: ShortcutConflict[] = [];
  for (const [keyStr, ids] of keyMap) {
    if (ids.length > 1) {
      for (const id of ids) {
        conflicts.push({
          shortcutId: id,
          conflictingIds: ids.filter((otherId) => otherId !== id),
          conflictingKeys: keyStr.split('+'),
        });
      }
    }
  }
  return conflicts;
}

/**
 * Check if a specific key combination would conflict with existing shortcuts.
 * @param shortcutId - The shortcut ID being tested
 * @param keys - The proposed key combination
 * @param getKeysForShortcut - Function that returns effective keys for a shortcut ID
 * @returns The conflicting shortcut ID, or null if no conflict
 */
export function findConflictForKeys(
  shortcutId: string,
  keys: string[],
  getKeysForShortcut: (id: string) => { keys: string[] }
): string | null {
  const keyStr = keys.join('+');
  for (const shortcut of KEYBOARD_SHORTCUTS) {
    if (shortcut.id === shortcutId) continue;
    const otherKeys = getKeysForShortcut(shortcut.id).keys;
    if (otherKeys.join('+') === keyStr) {
      return shortcut.id;
    }
  }
  return null;
}

/**
 * Check if a keyboard event matches a shortcut definition.
 * Handles both primary keys and alternate key combinations.
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut
): boolean {
  // Check primary key combination
  if (checkKeyCombination(event, shortcut.keys, shortcut.requiresModifier, shortcut.requiresShift)) {
    return true;
  }

  // Check alternate key combination if provided
  if (shortcut.alternateKeys) {
    return checkAlternateCombination(event, shortcut);
  }

  return false;
}

function checkKeyCombination(
  event: KeyboardEvent,
  keys: string[],
  requiresModifier?: boolean,
  requiresShift?: boolean
): boolean {
  const isMod = event.ctrlKey || event.metaKey;

  // Check modifier requirement
  if (requiresModifier && !isMod) return false;
  if (!requiresModifier && isMod) return false;

  // Check shift requirement
  if (requiresShift && !event.shiftKey) return false;
  if (!requiresShift && event.shiftKey) return false;

  // Check the key (case-insensitive for letters)
  const key = keys[keys.length - 1];
  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const shortcutKey = key.length === 1 ? key.toLowerCase() : key;

  return eventKey === shortcutKey;
}

function checkAlternateCombination(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  if (!shortcut.alternateKeys) return false;

  const isMod = event.ctrlKey || event.metaKey;

  // For ? key, the alternate is Shift+/ which doesn't require a modifier
  // The alternate keys array contains just the base key, shift is implied
  if (shortcut.requiresShift && event.shiftKey && !isMod) {
    const altKey = shortcut.alternateKeys[0];
    const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const altKeyNormalized = altKey.length === 1 ? altKey.toLowerCase() : altKey;
    return eventKey === altKeyNormalized;
  }

  return false;
}
