// ═══════════════════════════════════════
// ORACLE — Communication Hub (Client-Safe)
// Client-side utilities: validation, stats tracking.
// This file is safe to import from 'use client' components.
// Server-side send/health functions live in communication-hub-server.ts
// and should be called via API routes (e.g. /api/communication/send).
// ═══════════════════════════════════════

import type {
  CommunicationChannel,
  SendMessageRequest,
  CommunicationResult,
} from '@/lib/communication-hub-types';

// Re-export shared types for convenience
export type { CommunicationChannel, SendMessageRequest, CommunicationResult } from '@/lib/communication-hub-types';

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

/**
 * Validate email address format.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number for WhatsApp (E.164 format).
 */
export function isValidWhatsAppNumber(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  return /^\+[1-9]\d{6,14}$/.test(cleaned) || /^whatsapp:\+[1-9]\d{6,14}$/.test(phone);
}

/**
 * Get channel icon for display.
 */
export function getChannelIcon(channel: CommunicationChannel): string {
  switch (channel) {
    case 'email': return '📧';
    case 'whatsapp': return '💬';
    default: return '📋';
  }
}

/**
 * Escape HTML special characters to prevent XSS in email bodies.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
