// ═══════════════════════════════════════
// ORACLE — Communication Layer Types
// WhatsApp Business API + Email (Resend)
// ═══════════════════════════════════════

import type { ReactNode } from 'react';

// ─── WhatsApp ──────────────────────────

export interface WhatsAppConfig {
  /** Meta Cloud API base URL (default: https://graph.facebook.com/v21.0) */
  baseUrl: string;
  /** Phone number ID from Meta Business Manager */
  phoneNumberId: string;
  /** WhatsApp Business Account ID */
  wabaId: string;
  /** Access token (permanent or temporary) */
  accessToken: string;
}

export interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'template' | 'image' | 'document' | 'interactive';
  text?: { body: string; preview_url?: boolean };
  template?: WhatsAppTemplateMessage;
  image?: { id: string; caption?: string };
  document?: { id: string; caption?: string; filename?: string };
  interactive?: WhatsAppInteractiveMessage;
}

export interface WhatsAppTemplateMessage {
  name: string;
  language: { code: string };
  components?: WhatsAppTemplateComponent[];
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'quick_reply' | 'url';
  index?: number;
  parameters?: WhatsAppTemplateParameter[];
}

export interface WhatsAppTemplateParameter {
  type: 'text' | 'image' | 'document' | 'currency' | 'date_time';
  text?: string;
  image?: { link: string };
  document?: { link: string; filename?: string };
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
}

export interface WhatsAppInteractiveMessage {
  type: 'button' | 'list';
  header?: { type: 'text'; text: string };
  body: { text: string };
  footer?: { text: string };
  action: {
    buttons?: Array<{ type: 'reply'; reply: { id: string; title: string } }>;
    button?: string;
    rows?: Array<{ id: string; title: string; description?: string }>;
  };
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: number;
  status?: string;
}

export interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        wa_id: string;
        profile: { name: string };
      }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        type: string;
        text?: { body: string };
      }>;
      statuses?: Array<{
        id: string;
        status: 'sent' | 'delivered' | 'read' | 'failed';
        timestamp: string;
        errors?: Array<{ code: number; message: string }>;
      }>;
    };
    field: string;
  }>;
}

// ─── Email (Resend) ────────────────────

export interface EmailConfig {
  /** Resend API key */
  apiKey: string;
  /** Default sender email (must be verified in Resend) */
  fromEmail: string;
  /** Default sender name */
  fromName: string;
}

export interface EmailMessage {
  /** Recipient email(s) */
  to: string | string[];
  /** CC recipients */
  cc?: string | string[];
  /** BCC recipients */
  bcc?: string | string[];
  /** Email subject */
  subject: string;
  /** HTML body */
  html?: string;
  /** Plain text body */
  text?: string;
  /** React email component (Resend native) */
  react?: ReactNode;
  /** Reply-to address */
  replyTo?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Tags for categorization */
  tags?: Array<{ name: string; value: string }>;
}

export interface EmailSendResult {
  success: boolean;
  id?: string;
  error?: string;
}

// ─── Message Templates ─────────────────

export type MessageTemplateCategory =
  | 'cold-outreach'
  | 'follow-up'
  | 'proposal'
  | 'onboarding'
  | 'report'
  | 'review-request'
  | 're-engagement'
  | 'custom';

export interface MessageTemplate {
  id: string;
  name: string;
  category: MessageTemplateCategory;
  channel: 'whatsapp' | 'email' | 'both';
  subject?: string; // Email only
  body: string;
  variables: string[]; // e.g. ['{{client_name}}', '{{service}}']
  language: 'en' | 'hi' | 'hinglish';
  description: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Message Logging ───────────────────

export type MessageDirection = 'outbound' | 'inbound';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MessageLog {
  id: string;
  userId: string;
  clientId?: string;
  leadId?: string;
  channel: 'whatsapp' | 'email';
  direction: MessageDirection;
  to: string;
  from: string;
  subject?: string; // Email only
  body: string;
  templateId?: string;
  providerMessageId?: string; // Meta message ID or Resend email ID
  status: MessageStatus;
  errorCode?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

// ─── Unified Send Options ──────────────

export interface SendMessageOptions {
  channel: 'whatsapp' | 'email';
  to: string;
  subject?: string; // Email only
  body: string;
  templateName?: string; // WhatsApp template name (for template messages)
  templateLanguage?: string; // Default: 'en_US'
  clientId?: string;
  leadId?: string;
  metadata?: Record<string, unknown>;
}

export interface BulkSendOptions {
  channel: 'whatsapp' | 'email';
  recipients: Array<{ to: string; subject?: string; body: string }>;
  clientId?: string;
  leadId?: string;
  /** Delay between sends in ms (default: 1000 for WhatsApp to avoid rate limits) */
  delayMs?: number;
}
