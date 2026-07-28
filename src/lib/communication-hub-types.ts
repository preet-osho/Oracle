// ═══════════════════════════════════════
// ORACLE — Communication Hub (Shared Types & Utilities)
// Types and pure utility functions shared between client-safe
// (communication-hub.ts) and server-only (communication-hub-server.ts)
// modules. This file is safe to import from anywhere — it contains no
// server-only package references.
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export type SendChannel = 'email' | 'whatsapp';
export type CommunicationChannel = 'email' | 'whatsapp';

export interface SendMessageRequest {
  channel: SendChannel;
  to: string | string[];
  subject?: string;
  body: string;
  html?: string;
  mediaUrl?: string[];
  templateId?: string;
  templateVariables?: Record<string, string>;
  tags?: Record<string, string>;
  priority?: 'low' | 'normal' | 'high';
}

export interface CommunicationResult {
  success: boolean;
  channel: SendChannel;
  messageId?: string;
  provider: string;
  error?: string;
  timestamp: number;
}

export interface CommunicationHealthStatus {
  email: { resend: boolean; sendgrid: boolean; preferred: string };
  whatsapp: { configured: boolean; fromNumber: string };
}

// ─── Shared Utilities ──────────────────

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
