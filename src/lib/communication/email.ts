// ═══════════════════════════════════════
// ORACLE — Email Sending Service
// Resend API integration for transactional
// and outreach emails
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';
import { fetchWithTimeout, TIMEOUT_STANDARD_MS } from '@/lib/fetch-utils';
import type { EmailMessage, EmailSendResult, EmailConfig } from './types';

const log = createLogger('Email');

// ─── Configuration ─────────────────────

function getConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM_ADDRESS || 'oracle@oracle.app';
  const fromName = process.env.EMAIL_FROM_NAME || 'ORACLE';

  if (!apiKey) return null;

  return { apiKey, fromEmail, fromName };
}

/**
 * Check if Resend email is configured.
 */
export function isEmailConfigured(): boolean {
  return getConfig() !== null;
}

// ─── Send Email ────────────────────────

/**
 * Send an email via Resend API.
 * Supports HTML, plain text, and React components.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const config = getConfig();
  if (!config) {
    return {
      success: false,
      error: 'Email not configured. Set RESEND_API_KEY env var.',
    };
  }

  try {
    log.info(`Sending email to ${Array.isArray(message.to) ? message.to.join(', ') : message.to}`);

    const body: Record<string, unknown> = {
      from: `${config.fromName} <${config.fromEmail}>`,
      to: Array.isArray(message.to) ? message.to : [message.to],
      subject: message.subject,
    };

    // Add optional fields
    if (message.cc) body.cc = Array.isArray(message.cc) ? message.cc : [message.cc];
    if (message.bcc) body.bcc = Array.isArray(message.bcc) ? message.bcc : [message.bcc];
    if (message.html) body.html = message.html;
    if (message.text) body.text = message.text;
    if (message.react) body.react = message.react;
    if (message.replyTo) body.reply_to = message.replyTo;
    if (message.headers) body.headers = message.headers;
    if (message.tags) body.tags = message.tags;

    const response = await fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      timeoutMs: TIMEOUT_STANDARD_MS,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data?.message || data?.error || response.statusText;
      log.error(`Resend API error: ${error}`);
      return { success: false, error };
    }

    log.info(`Email sent: ${data.id}`);
    return { success: true, id: data.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Network error';
    log.error(`Email send failed: ${errorMsg}`, { error: String(err) });
    return { success: false, error: errorMsg };
  }
}

// ─── Bulk Send ─────────────────────────

/**
 * Send emails to multiple recipients with rate limiting.
 * Resend free tier: 100 emails/day, 3000/month.
 */
export async function sendBulkEmails(
  messages: EmailMessage[],
  delayMs: number = 100,
): Promise<Array<{ to: string; result: EmailSendResult }>> {
  const results: Array<{ to: string; result: EmailSendResult }> = [];

  for (const message of messages) {
    const result = await sendEmail(message);
    const recipients = Array.isArray(message.to) ? message.to : [message.to];

    for (const to of recipients) {
      results.push({ to, result });
    }

    // Rate limit delay between sends
    if (delayMs > 0 && messages.indexOf(message) < messages.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

// ─── Email Templates ───────────────────

/**
 * Generate HTML for a professional outreach email.
 * Indian agency style with INR pricing.
 */
export function generateOutreachHtml(params: {
  recipientName: string;
  agencyName: string;
  headline: string;
  body: string;
  cta: string;
  ctaUrl?: string;
  signature: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f8fafc;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#ffffff;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <h1 style="font-size:22px;color:#1a1a2e;margin:0 0 8px;">${params.headline}</h1>
      <p style="font-size:14px;color:#64748b;margin:0 0 24px;">Hi ${params.recipientName},</p>
      <div style="font-size:15px;color:#334155;line-height:1.7;">
        ${params.body}
      </div>
      ${params.ctaUrl ? `
      <div style="margin:32px 0;">
        <a href="${params.ctaUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${params.cta}</a>
      </div>` : `
      <p style="font-size:15px;color:#6366f1;font-weight:600;margin:32px 0;">${params.cta}</p>`}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
      <p style="font-size:13px;color:#94a3b8;line-height:1.6;">${params.signature}</p>
      <p style="font-size:11px;color:#cbd5e1;margin:16px 0 0;">Sent via ORACLE — AI Operating System for Digital Agencies</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate HTML for a professional proposal email.
 */
export function generateProposalHtml(params: {
  clientName: string;
  agencyName: string;
  serviceSummary: string;
  priceRange: string;
  timeline: string;
  ctaUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f8fafc;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#ffffff;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;padding:24px;margin-bottom:24px;">
        <h1 style="font-size:20px;color:#ffffff;margin:0;">Your Custom Proposal</h1>
        <p style="font-size:14px;color:rgba(255,255,255,0.8);margin:8px 0 0;">${params.serviceSummary}</p>
      </div>
      <p style="font-size:15px;color:#334155;line-height:1.7;">Hi ${params.clientName},</p>
      <div style="font-size:15px;color:#334155;line-height:1.7;margin:16px 0;">
        <p>Thank you for the opportunity to work with you. Based on our discussion, here's what we propose:</p>
        <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 8px;"><strong>Service:</strong> ${params.serviceSummary}</p>
          <p style="margin:0 0 8px;"><strong>Investment:</strong> ${params.priceRange}</p>
          <p style="margin:0;"><strong>Timeline:</strong> ${params.timeline}</p>
        </div>
        <p>Click below to view the full proposal with detailed deliverables, timeline, and pricing.</p>
      </div>
      <div style="margin:32px 0;">
        <a href="${params.ctaUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">View Full Proposal</a>
      </div>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
      <p style="font-size:13px;color:#94a3b8;">This proposal is valid for 15 days. All prices are in INR and inclusive of applicable taxes.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate HTML for a review/follow-up request email.
 */
export function generateFollowUpHtml(params: {
  recipientName: string;
  context: string;
  cta: string;
  ctaUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f8fafc;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#ffffff;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <p style="font-size:15px;color:#334155;line-height:1.7;">Hi ${params.recipientName},</p>
      <div style="font-size:15px;color:#334155;line-height:1.7;margin:16px 0;">
        ${params.context}
      </div>
      <div style="margin:32px 0;">
        <a href="${params.ctaUrl}" style="display:inline-block;background:#10b981;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${params.cta}</a>
      </div>
      <p style="font-size:14px;color:#64748b;">Looking forward to hearing from you.</p>
    </div>
  </div>
</body>
</html>`;
}
