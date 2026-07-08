// ═══════════════════════════════════════
// ORACLE — Communication Hub (Shared Types)
// Types shared between client-safe (communication-hub.ts) and
// server-only (communication-hub-server.ts) modules.
// This file is safe to import from anywhere — it contains no
// runtime code or server-only package references.
// ═══════════════════════════════════════

export type CommunicationChannel = 'email' | 'whatsapp';

export interface SendMessageRequest {
  channel: CommunicationChannel;
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
  channel: CommunicationChannel;
  messageId?: string;
  provider: string;
  error?: string;
  timestamp: number;
}

export interface CommunicationHealthStatus {
  email: { resend: boolean; sendgrid: boolean; preferred: string };
  whatsapp: { configured: boolean; fromNumber: string };
}
