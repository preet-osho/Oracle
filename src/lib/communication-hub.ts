// ═══════════════════════════════════════
// ORACLE — Communication Hub (Client-Safe)
// Client-side utilities: validation, stats tracking.
// This file is safe to import from 'use client' components.
// Server-side send/health functions live in communication-hub-server.ts
// and should be called via API routes (e.g. /api/communication/send).
// ═══════════════════════════════════════

import type {
  SendChannel,
} from '@/lib/communication-hub-types';

// Re-export shared types and utilities for backward compatibility
export type { SendChannel, SendMessageRequest, CommunicationResult, CommunicationHealthStatus } from '@/lib/communication-hub-types';
export type { SendChannel as CommunicationChannel } from '@/lib/communication-hub-types';
export { isValidEmail, isValidWhatsAppNumber, escapeHtml } from '@/lib/communication-hub-types';

export interface CommunicationStats {
  totalSent: number;
  emailsSent: number;
  whatsappSent: number;
  failed: number;
  lastSentAt: number | null;
}

// ─── Storage ────────────────────────────

const COMM_STATS_KEY = 'oracle_comm_stats';

function getStoredStats(): CommunicationStats {
  if (typeof window === 'undefined') {
    return { totalSent: 0, emailsSent: 0, whatsappSent: 0, failed: 0, lastSentAt: null };
  }
  try {
    const raw = localStorage.getItem(COMM_STATS_KEY);
    return raw ? JSON.parse(raw) : { totalSent: 0, emailsSent: 0, whatsappSent: 0, failed: 0, lastSentAt: null };
  } catch {
    return { totalSent: 0, emailsSent: 0, whatsappSent: 0, failed: 0, lastSentAt: null };
  }
}

// ─── Client-Safe Exports ───────────────

/**
 * Get communication statistics from localStorage.
 */
export function getCommunicationStats(): CommunicationStats {
  return getStoredStats();
}
