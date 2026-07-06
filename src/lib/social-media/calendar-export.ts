// ═══════════════════════════════════════
// ORACLE — Calendar Export Helpers
// Shared CSV + ICS generation for MCP tool & UI
// ═══════════════════════════════════════

import type { SocialMediaPost } from './types';
import { downloadBlob } from '@/lib/download-blob';

// ─── CSV Helpers ──────────────────────

export const CSV_HEADERS = ['Post ID', 'Platform', 'Status', 'Type', 'Priority', 'Text', 'Hashtags', 'Scheduled At', 'Published At', 'Image URL', 'Link URL'];

/** Escape a single value for CSV (RFC 4180). */
export function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Convert a SocialMediaPost to a CSV row array. */
export function postToCSVRow(p: SocialMediaPost): string[] {
  return [
    p.id,
    p.platform,
    p.status,
    p.postType,
    p.priority,
    p.text.replace(/\n/g, ' '),
    p.hashtags.join(' '),
    p.scheduledAt ? new Date(p.scheduledAt).toISOString() : '',
    p.publishedAt ? new Date(p.publishedAt).toISOString() : '',
    p.imageUrl || '',
    p.linkUrl || '',
  ];
}

/** Generate a complete CSV string from an array of posts. */
export function postsToCSV(posts: SocialMediaPost[]): string {
  const rows = posts.map((p) => postToCSVRow(p).map(escapeCSVField).join(','));
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

// ─── ICS Helpers ──────────────────────

/** Escape text for ICS content lines (RFC 5545 §3.1). */
export function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/:/g, '\\:')
    .replace(/\n/g, '\\n');
}

/** Format a Date as ICS datetime (local time, YYYYMMDDTHHMMSS). */
function formatICSDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

/** Generate a complete ICS (iCalendar) string from an array of posts. */
export function postsToICS(posts: SocialMediaPost[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ORACLE//Social Media Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:ORACLE Content Calendar',
  ];

  for (const post of posts) {
    const ts = post.scheduledAt || post.publishedAt || post.createdAt;
    const dtStart = new Date(ts);
    const dtEnd = new Date(dtStart.getTime() + 30 * 60_000);

    lines.push(
      'BEGIN:VEVENT',
      `DTSTART:${formatICSDateTime(dtStart)}`,
      `DTEND:${formatICSDateTime(dtEnd)}`,
      `SUMMARY:[${post.platform.toUpperCase()}] ${post.text.slice(0, 80)}`,
      `DESCRIPTION:${escapeICSText(post.text)}`,
      `UID:${post.id}@oracle-social`,
      `CATEGORIES:${post.platform},${post.status}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\n');
}

// ─── Browser Download Helper ──────────

/** Re-export downloadBlob as downloadFile for backward compatibility. */
export { downloadBlob as downloadFile };

// ─── Calendar Import Links ──────────────

/**
 * Encode ICS content as a data URI for calendar import links.
 * RFC 2397: data:[<mediatype>][;base64],<data>
 */
export function icsToDataURI(icsContent: string, useBase64 = true): string {
  if (useBase64) {
    // Base64 encoding is ~3x shorter than encodeURIComponent, avoiding URL length limits
    if (typeof Buffer !== 'undefined') {
      return `data:text/calendar;base64,${Buffer.from(icsContent, 'utf-8').toString('base64')}`;
    }
    // Browser fallback: use btoa on escaped UTF-8
    const b64 = btoa(unescape(encodeURIComponent(icsContent)));
    return `data:text/calendar;base64,${b64}`;
  }
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
}

/**
 * Generate a Google Calendar "Add Event" URL for a single post.
 * Uses the Google Calendar event creation URL scheme.
 */
export function googleCalendarImportURL(post: SocialMediaPost): string {
  const ts = post.scheduledAt || post.publishedAt || post.createdAt;
  const dtStart = new Date(ts);
  const dtEnd = new Date(dtStart.getTime() + 30 * 60_000);

  // Google Calendar uses YYYYMMDDTHHMMSS format (no separators)
  const fmt = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };

  const title = `[${post.platform.toUpperCase()}] ${post.text.slice(0, 80)}`;
  const details = post.text;
  const hashtags = post.hashtags.length > 0 ? `\n\n${post.hashtags.join(' ')}` : '';

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(dtStart)}/${fmt(dtEnd)}&details=${encodeURIComponent(details + hashtags)}`;
}

/**
 * Generate an Outlook.com "New Event" URL for a single post.
 * Uses the Outlook.com calendar compose URL scheme.
 */
export function outlookImportURL(post: SocialMediaPost): string {
  const ts = post.scheduledAt || post.publishedAt || post.createdAt;
  const dtStart = new Date(ts);
  const dtEnd = new Date(dtStart.getTime() + 30 * 60_000);

  // Outlook uses ISO 8601 format
  const title = `[${post.platform.toUpperCase()}] ${post.text.slice(0, 80)}`;
  const details = post.text;
  const hashtags = post.hashtags.length > 0 ? `\n\n${post.hashtags.join(' ')}` : '';

  return `https://outlook.live.com/calendar/0/action/compose?subject=${encodeURIComponent(title)}&startdt=${dtStart.toISOString()}&enddt=${dtEnd.toISOString()}&body=${encodeURIComponent(details + hashtags)}`;
}

/**
 * Open a calendar import link in a new tab.
 * Safe no-op if `document` is unavailable (SSR / test).
 */
export function openCalendarImport(url: string): void {
  if (typeof window === 'undefined') return;
  window.open(url, '_blank', 'noopener,noreferrer');
}
