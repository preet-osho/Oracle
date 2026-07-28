// ═══════════════════════════════════════
// ORACLE — Email Service
// Dual-provider support: Resend (primary) + SendGrid (fallback)
// Handles transactional email, templates, and bulk sends
// ═══════════════════════════════════════

import { Resend } from 'resend';
import * as sgMail from '@sendgrid/mail';
import { render } from '@react-email/render';
import type React from 'react';
import { createLogger } from '@/lib/logger';

import { PasswordResetEmail } from '@/emails/password-reset';
import { InvitationEmail } from '@/emails/invitation';
import { InvoiceEmail, type InvoiceLineItem } from '@/emails/invoice';
import { WeeklyReportEmail, type ReportMetric, type ReportClientSummary } from '@/emails/weekly-report';

const log = createLogger('EmailService');

// ─── Types ─────────────────────────────

export type EmailProvider = 'resend' | 'sendgrid';

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
  tags?: Record<string, string>;
}

export interface SendTemplateEmailOptions {
  to: string | string[];
  templateId: string;
  dynamicData: Record<string, unknown>;
  from?: string;
  replyTo?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  provider: EmailProvider;
  error?: string;
}

export interface EmailServiceConfig {
  preferredProvider: EmailProvider;
  resendApiKey?: string;
  sendgridApiKey?: string;
  defaultFrom: string;
}

// ─── Provider Clients ───────────────────

let resendClient: Resend | null = null;
let sendgridConfigured = false;

function getResendClient(): Resend | null {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log.warn('Resend API key not configured');
    return null;
  }
  resendClient = new Resend(apiKey);
  return resendClient;
}

function configureSendGrid(): boolean {
  if (sendgridConfigured) return true;
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    log.warn('SendGrid API key not configured');
    return false;
  }
  sgMail.setApiKey(apiKey);
  sendgridConfigured = true;
  return true;
}

// ─── Configuration ──────────────────────

function getConfig(): EmailServiceConfig {
  return {
    preferredProvider: (process.env.EMAIL_PROVIDER as EmailProvider) || 'resend',
    resendApiKey: process.env.RESEND_API_KEY,
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    defaultFrom: process.env.EMAIL_FROM || 'Oracle <noreply@oracledigital.in>',
  };
}

// ─── Resend Provider ────────────────────

async function sendWithResend(
  options: SendEmailOptions,
  config: EmailServiceConfig,
): Promise<EmailSendResult> {
  const client = getResendClient();
  if (!client) {
    return { success: false, provider: 'resend', error: 'Resend API key not configured' };
  }

  try {
    const result = await client.emails.send({
      from: options.from || config.defaultFrom,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      reply_to: options.replyTo,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: typeof a.content === 'string' ? Buffer.from(a.content) : a.content,
        content_type: a.contentType,
      })),
      tags: options.tags ? Object.entries(options.tags).map(([name, value]) => ({ name, value: String(value) })) : undefined,
    } as Parameters<typeof client.emails.send>[0]);

    if (result.error) {
      log.error('Resend send error', { error: result.error });
      return { success: false, provider: 'resend', error: result.error.message };
    }

    return { success: true, messageId: result.data?.id, provider: 'resend' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Resend error';
    log.error('Resend exception', { error: message });
    return { success: false, provider: 'resend', error: message };
  }
}

async function sendTemplateWithResend(
  options: SendTemplateEmailOptions,
  config: EmailServiceConfig,
): Promise<EmailSendResult> {
  // Build a SendEmailOptions-compatible object using tags for dynamic data,
  // then delegate to sendWithResend which handles the Resend SDK type cast.
  return sendWithResend(
    {
      to: options.to,
      subject: `Template: ${options.templateId}`,
      from: options.from,
      replyTo: options.replyTo,
      tags: Object.entries(options.dynamicData).reduce<Record<string, string>>(
        (acc, [key, val]) => ({ ...acc, [key]: String(val) }),
        {},
      ),
    },
    config,
  );
}

// ─── SendGrid Provider ──────────────────

async function sendWithSendGrid(
  options: SendEmailOptions,
  config: EmailServiceConfig,
): Promise<EmailSendResult> {
  if (!configureSendGrid()) {
    return { success: false, provider: 'sendgrid', error: 'SendGrid API key not configured' };
  }

  try {
    const msg: sgMail.MailDataRequired = {
      to: options.to,
      from: options.from || config.defaultFrom,
      subject: options.subject,
      content: [{ type: 'text/html', value: options.html || options.text || '' }],
      replyTo: options.replyTo ? { email: options.replyTo } : undefined,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: typeof a.content === 'string' ? Buffer.from(a.content).toString('base64') : a.content.toString('base64'),
        type: a.contentType,
        disposition: 'attachment' as const,
      })),
      customArgs: options.tags,
    };

    const [response] = await sgMail.send(msg);
    return {
      success: true,
      messageId: response.headers['x-message-id'],
      provider: 'sendgrid',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SendGrid error';
    log.error('SendGrid exception', { error: message });
    return { success: false, provider: 'sendgrid', error: message };
  }
}

async function sendTemplateWithSendGrid(
  options: SendTemplateEmailOptions,
  config: EmailServiceConfig,
): Promise<EmailSendResult> {
  if (!configureSendGrid()) {
    return { success: false, provider: 'sendgrid', error: 'SendGrid API key not configured' };
  }

  try {
    const msg: sgMail.MailDataRequired = {
      to: options.to,
      from: options.from || config.defaultFrom,
      templateId: options.templateId,
      dynamicTemplateData: options.dynamicData,
      replyTo: options.replyTo ? { email: options.replyTo } : undefined,
    };

    const [response] = await sgMail.send(msg);
    return {
      success: true,
      messageId: response.headers['x-message-id'],
      provider: 'sendgrid',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SendGrid error';
    return { success: false, provider: 'sendgrid', error: message };
  }
}

// ─── Public API ─────────────────────────

/**
 * Send an email using the preferred provider with automatic fallback.
 * Primary: Resend → Fallback: SendGrid
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
  const config = getConfig();
  const startTime = Date.now();

  // Try preferred provider first
  const primaryResult = config.preferredProvider === 'resend'
    ? await sendWithResend(options, config)
    : await sendWithSendGrid(options, config);

  if (primaryResult.success) {
    log.info('Email sent successfully', {
      provider: primaryResult.provider,
      messageId: primaryResult.messageId,
      duration: Date.now() - startTime,
    });
    return primaryResult;
  }

  // Fallback to the other provider
  log.warn('Primary provider failed, trying fallback', {
    primary: primaryResult.provider,
    error: primaryResult.error,
  });

  const fallbackResult = config.preferredProvider === 'resend'
    ? await sendWithSendGrid(options, config)
    : await sendWithResend(options, config);

  if (fallbackResult.success) {
    log.info('Email sent via fallback provider', {
      provider: fallbackResult.provider,
      messageId: fallbackResult.messageId,
      duration: Date.now() - startTime,
    });
    return fallbackResult;
  }

  log.error('Both email providers failed', {
    primary: primaryResult.error,
    fallback: fallbackResult.error,
    duration: Date.now() - startTime,
  });

  return {
    success: false,
    provider: config.preferredProvider,
    error: `Primary: ${primaryResult.error} | Fallback: ${fallbackResult.error}`,
  };
}

/**
 * Send a template-based email using the preferred provider with automatic fallback.
 */
export async function sendTemplateEmail(options: SendTemplateEmailOptions): Promise<EmailSendResult> {
  const config = getConfig();
  const startTime = Date.now();

  const primaryResult = config.preferredProvider === 'resend'
    ? await sendTemplateWithResend(options, config)
    : await sendTemplateWithSendGrid(options, config);

  if (primaryResult.success) {
    log.info('Template email sent', {
      provider: primaryResult.provider,
      templateId: options.templateId,
      duration: Date.now() - startTime,
    });
    return primaryResult;
  }

  // Fallback
  const fallbackResult = config.preferredProvider === 'resend'
    ? await sendTemplateWithSendGrid(options, config)
    : await sendTemplateWithResend(options, config);

  return fallbackResult.success ? fallbackResult : {
    success: false,
    provider: config.preferredProvider,
    error: `Both providers failed: ${primaryResult.error} | ${fallbackResult.error}`,
  };
}

/**
 * Send bulk emails (up to 100 recipients per call).
 * Uses the primary provider only — no automatic fallback for bulk.
 */
export async function sendBulkEmail(
  recipients: string[],
  subject: string,
  html: string,
  options?: { from?: string; text?: string; tags?: Record<string, string> },
): Promise<EmailSendResult[]> {
  const config = getConfig();
  const results: EmailSendResult[] = [];

  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const result = await sendEmail({
      to: batch,
      subject,
      html,
      from: options?.from || config.defaultFrom,
      text: options?.text,
      tags: options?.tags,
    });
    results.push(result);
  }

  return results;
}

export interface SendReactEmailOptions {
  to: string | string[];
  subject: string;
  react: React.ReactNode;
  from?: string;
  tags?: Record<string, string>;
}

/**
 * Send an email built from a React Email component.
 * Renders the component to HTML and sends via the preferred provider.
 */
export async function sendReactEmail(options: SendReactEmailOptions): Promise<EmailSendResult> {
  const html = await render(options.react as React.ReactElement);
  return sendEmail({
    to: options.to,
    subject: options.subject,
    html,
    from: options.from,
    tags: options.tags,
  });
}

/**
 * Send a password reset email using a React Email template.
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  baseUrl: string,
  options?: { expiryMinutes?: number; requestedBy?: string },
): Promise<EmailSendResult> {
  const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;

  return sendReactEmail({
    to: email,
    subject: 'Reset Your Oracle Password',
    tags: { type: 'password_reset' },
    react: PasswordResetEmail({
      resetUrl,
      expiryMinutes: options?.expiryMinutes ?? 60,
      requestedBy: options?.requestedBy,
    }),
  });
}

/**
 * Send an invitation email using a React Email template.
 */
export async function sendInvitationEmail(
  email: string,
  inviterName: string,
  orgName: string,
  inviteToken: string,
  baseUrl: string,
  options?: { inviterEmail?: string; role?: string; expiryDays?: number },
): Promise<EmailSendResult> {
  const inviteUrl = `${baseUrl}/auth/accept-invite?token=${inviteToken}`;

  return sendReactEmail({
    to: email,
    subject: `You've Been Invited to ${orgName} on Oracle`,
    tags: { type: 'invitation', orgName },
    react: InvitationEmail({
      inviteUrl,
      inviterName,
      inviterEmail: options?.inviterEmail,
      orgName,
      role: options?.role,
      expiryDays: options?.expiryDays,
    }),
  });
}

/**
 * Send an invoice email using a React Email template.
 */
export async function sendInvoiceEmail(options: {
  to: string | string[];
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  items: InvoiceLineItem[];
  subtotal: number;
  total: number;
  tax?: number;
  taxRate?: number;
  discount?: number;
  currency?: string;
  dueDate?: string;
  paymentUrl?: string;
  notes?: string;
  issuedBy?: string;
}): Promise<EmailSendResult> {
  return sendReactEmail({
    to: options.to,
    subject: `Invoice ${options.invoiceNumber} — ${options.currency ?? 'INR'} ${options.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    tags: { type: 'invoice', invoiceNumber: options.invoiceNumber },
    react: InvoiceEmail({
      invoiceNumber: options.invoiceNumber,
      clientName: options.clientName,
      clientEmail: options.clientEmail,
      items: options.items,
      subtotal: options.subtotal,
      total: options.total,
      tax: options.tax,
      taxRate: options.taxRate,
      discount: options.discount,
      currency: options.currency,
      dueDate: options.dueDate,
      paymentUrl: options.paymentUrl,
      notes: options.notes,
      issuedBy: options.issuedBy,
    }),
  });
}

/**
 * Send a weekly report email using a React Email template.
 */
export async function sendWeeklyReportEmail(options: {
  to: string | string[];
  weekLabel: string;
  recipientName: string;
  metrics: ReportMetric[];
  clients: ReportClientSummary[];
  totalRevenue: number;
  revenueChange?: string;
  newLeads?: number;
  pendingInvoices?: number;
  actionItems?: string[];
  dashboardUrl?: string;
  currency?: string;
}): Promise<EmailSendResult> {
  return sendReactEmail({
    to: options.to,
    subject: `📊 Weekly Report — ${options.weekLabel}`,
    tags: { type: 'weekly_report', weekLabel: options.weekLabel },
    react: WeeklyReportEmail({
      weekLabel: options.weekLabel,
      recipientName: options.recipientName,
      metrics: options.metrics,
      clients: options.clients,
      totalRevenue: options.totalRevenue,
      revenueChange: options.revenueChange,
      newLeads: options.newLeads,
      pendingInvoices: options.pendingInvoices,
      actionItems: options.actionItems,
      dashboardUrl: options.dashboardUrl,
      currency: options.currency,
    }),
  });
}

/**
 * Check email service health status.
 */
export async function checkEmailServiceHealth(): Promise<{
  resend: boolean;
  sendgrid: boolean;
  preferred: EmailProvider;
}> {
  const config = getConfig();
  return {
    resend: !!process.env.RESEND_API_KEY,
    sendgrid: !!process.env.SENDGRID_API_KEY,
    preferred: config.preferredProvider,
  };
}
