// ═══════════════════════════════════════
// ORACLE — Shared Storage Utilities
// Client-side localStorage helpers with SSR safety
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';

const log = createLogger('StorageUtils');

/**
 * Read an array of items from localStorage.
 * Returns an empty array if running on the server or if parsing fails.
 */
export function getStored<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Write an array of items to localStorage.
 * Silently no-ops on the server or if serialization fails.
 */
export function setStored<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    log.error('Failed to persist data', { key });
  }
}
