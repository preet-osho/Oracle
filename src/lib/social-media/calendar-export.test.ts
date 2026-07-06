// ═══════════════════════════════════════
// ORACLE — Calendar Export Tests
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  postsToCSV,
  postsToICS,
  escapeCSVField,
  escapeICSText,
  postToCSVRow,
  CSV_HEADERS,
  downloadFile,
  icsToDataURI,
  googleCalendarImportURL,
  outlookImportURL,
  openCalendarImport,
} from './calendar-export';
import type { SocialMediaPost } from './types';

// ─── Test Fixtures ─────────────────────

function makePost(overrides: Partial<SocialMediaPost> = {}): SocialMediaPost {
  return {
    id: 'post_test_001',
    platform: 'linkedin',
    status: 'scheduled',
    postType: 'text',
    priority: 'normal',
    text: 'Test post content',
    hashtags: ['#test', '#oracle'],
    scheduledAt: Date.now() + 86400000, // tomorrow
    createdAt: Date.now(),
    updatedAt: Date.now(),
    timezone: 'Asia/Kolkata',
    notes: '',
    tags: [],
    retryCount: 0,
    maxRetries: 3,
    createdBy: 'test',
    ...overrides,
  };
}

// ─── CSV Tests ─────────────────────────

describe('escapeCSVField', () => {
  it('returns plain text unchanged', () => {
    expect(escapeCSVField('hello')).toBe('hello');
  });

  it('wraps values with commas in quotes', () => {
    expect(escapeCSVField('a,b')).toBe('"a,b"');
  });

  it('escapes double quotes', () => {
    expect(escapeCSVField('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps values with newlines', () => {
    expect(escapeCSVField('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('postToCSVRow', () => {
  it('converts post to correct row array', () => {
    const post = makePost();
    const row = postToCSVRow(post);
    expect(row).toHaveLength(CSV_HEADERS.length);
    expect(row[0]).toBe('post_test_001');
    expect(row[1]).toBe('linkedin');
    expect(row[2]).toBe('scheduled');
    expect(row[5]).toBe('Test post content');
    expect(row[6]).toBe('#test #oracle');
  });

  it('collapses newlines in text', () => {
    const post = makePost({ text: 'line1\nline2\nline3' });
    const row = postToCSVRow(post);
    expect(row[5]).toBe('line1 line2 line3');
  });
});

describe('postsToCSV', () => {
  it('includes all headers', () => {
    const csv = postsToCSV([]);
    const headers = csv.split('\n')[0];
    for (const h of CSV_HEADERS) {
      expect(headers).toContain(h);
    }
  });

  it('generates correct rows for multiple posts', () => {
    const posts = [
      makePost({ id: 'post_a', text: 'First post' }),
      makePost({ id: 'post_b', text: 'Second post' }),
    ];
    const csv = postsToCSV(posts);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toContain('post_a');
    expect(lines[2]).toContain('post_b');
  });

  it('handles posts with special CSV characters', () => {
    const post = makePost({ text: 'Has "quotes", commas, and\nnewlines' });
    const csv = postsToCSV([post]);
    expect(csv).toContain('"');
  });
});

// ─── ICS Tests ─────────────────────────

describe('escapeICSText', () => {
  it('escapes backslashes', () => {
    expect(escapeICSText('a\\b')).toBe('a\\\\b');
  });

  it('escapes semicolons', () => {
    expect(escapeICSText('a;b')).toBe('a\\;b');
  });

  it('escapes commas', () => {
    expect(escapeICSText('a,b')).toBe('a\\,b');
  });

  it('escapes colons', () => {
    expect(escapeICSText('a:b')).toBe('a\\:b');
  });

  it('escapes newlines', () => {
    expect(escapeICSText('a\nb')).toBe('a\\nb');
  });

  it('handles complex mixed text', () => {
    const input = 'Line 1\\done; with: commas, end';
    const result = escapeICSText(input);
    expect(result).toContain('\\\\');
    expect(result).toContain('\\;');
    expect(result).toContain('\\,');
    expect(result).toContain('\\:');
  });
});

describe('postsToICS', () => {
  it('generates valid VCALENDAR wrapper', () => {
    const ics = postsToICS([]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
  });

  it('generates VEVENT entries for each post', () => {
    const posts = [
      makePost({ text: 'Post one' }),
      makePost({ text: 'Post two' }),
    ];
    const ics = postsToICS(posts);
    const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(eventCount).toBe(2);
    expect(ics).toContain('END:VEVENT');
  });

  it('includes platform in summary', () => {
    const post = makePost({ platform: 'instagram', text: 'Photo post' });
    const ics = postsToICS([post]);
    expect(ics).toContain('[INSTAGRAM]');
  });

  it('includes UID for each event', () => {
    const post = makePost({ id: 'post_uid_123' });
    const ics = postsToICS([post]);
    expect(ics).toContain('UID:post_uid_123@oracle-social');
  });

  it('escapes special characters in description', () => {
    const post = makePost({ text: 'Semi;colon, comma: colon\nnewline' });
    const ics = postsToICS([post]);
    expect(ics).toContain('\\;');
    expect(ics).toContain('\\,');
    expect(ics).toContain('\\:');
    expect(ics).toContain('\\n');
  });

  it('sets DTEND 30 minutes after DTSTART', () => {
    const now = new Date(2025, 0, 15, 10, 0, 0);
    const post = makePost({ scheduledAt: now.getTime() });
    const ics = postsToICS([post]);
    expect(ics).toContain('DTSTART:20250115T100000');
    expect(ics).toContain('DTEND:20250115T103000');
  });
});

// ─── Import URL Tests ──────────────────

describe('icsToDataURI', () => {
  it('produces a base64 data URI by default', () => {
    const ics = 'BEGIN:VCALENDAR\nEND:VCALENDAR';
    const uri = icsToDataURI(ics);
    expect(uri).toMatch(/^data:text\/calendar;base64,/);
  });

  it('base64 encodes the ICS content', () => {
    const ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
    const uri = icsToDataURI(ics, true);
    expect(uri).toMatch(/^data:text\/calendar;base64,/);
    // Verify the base64 content decodes back to the original
    const b64 = uri.replace('data:text/calendar;base64,', '');
    const decoded = decodeURIComponent(escape(atob(b64)));
    expect(decoded).toBe(ics);
  });

  it('falls back to percent-encoding when useBase64 is false', () => {
    const ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
    const uri = icsToDataURI(ics, false);
    expect(uri).toMatch(/^data:text\/calendar;charset=utf-8,/);
    expect(uri).toContain(encodeURIComponent(ics));
  });

  it('base64 is shorter than percent-encoding for large content', () => {
    const largeIcs = 'BEGIN:VCALENDAR\n' + Array(200).fill('DESCRIPTION:Line with unicode café and newlines\n').join('') + 'END:VCALENDAR';
    const b64Uri = icsToDataURI(largeIcs, true);
    const pctUri = icsToDataURI(largeIcs, false);
    expect(b64Uri.length).toBeLessThan(pctUri.length);
  });
});

describe('googleCalendarImportURL', () => {
  it('generates a valid Google Calendar URL', () => {
    const post = makePost({
      scheduledAt: new Date(2025, 5, 15, 10, 0).getTime(),
    });
    const url = googleCalendarImportURL(post);
    expect(url).toContain('https://calendar.google.com/calendar/render');
    expect(url).toContain('action=TEMPLATE');
  });

  it('encodes post title with platform', () => {
    const post = makePost({ platform: 'linkedin', text: 'Hello world' });
    const url = googleCalendarImportURL(post);
    expect(url).toContain(encodeURIComponent('[LINKEDIN] Hello world'));
  });

  it('includes hashtags in details', () => {
    const post = makePost({ hashtags: ['#test', '#oracle'] });
    const url = googleCalendarImportURL(post);
    expect(url).toContain(encodeURIComponent('#test #oracle'));
  });

  it('formats dates as YYYYMMDDTHHMMSS', () => {
    const post = makePost({
      scheduledAt: new Date(2025, 5, 15, 14, 30).getTime(),
    });
    const url = googleCalendarImportURL(post);
    expect(url).toContain('dates=20250615T143000/20250615T150000');
  });
});

describe('outlookImportURL', () => {
  it('generates a valid Outlook URL', () => {
    const post = makePost();
    const url = outlookImportURL(post);
    expect(url).toContain('https://outlook.live.com/calendar/0/action/compose');
  });

  it('includes subject', () => {
    const post = makePost({ platform: 'facebook', text: 'FB post' });
    const url = outlookImportURL(post);
    expect(url).toContain(encodeURIComponent('[FACEBOOK] FB post'));
  });

  it('uses ISO dates for start/end', () => {
    const post = makePost();
    const url = outlookImportURL(post);
    expect(url).toContain('startdt=');
    expect(url).toContain('enddt=');
    // ISO format check
    const startMatch = url.match(/startdt=([^&]+)/);
    expect(startMatch).toBeTruthy();
    expect(new Date(startMatch![1]).toISOString()).toBe(startMatch![1]);
  });

  it('includes body content', () => {
    const post = makePost({ text: 'My content here' });
    const url = outlookImportURL(post);
    expect(url).toContain(encodeURIComponent('My content here'));
  });
});

// ─── Browser Interaction Tests ─────────

describe('downloadFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a blob and triggers download via downloadBlob', () => {
    const clickSpy = vi.fn();
    const mockAnchor = document.createElement('a');
    mockAnchor.click = clickSpy;
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor);

    downloadFile('test content', 'test.csv', 'text/csv');

    expect(appendChildSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
  });
});

describe('openCalendarImport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('opens URL in new tab', () => {
    const openSpy = vi.spyOn(window, 'open');
    openCalendarImport('https://example.com');
    expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
  });
});
