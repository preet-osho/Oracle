// ═══════════════════════════════════════
// Tests — Research Export Utilities
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  escapeCsvValue,
  findingsToCsv,
  findingsToJson,
  exportToJson,
  exportToCsv,
  downloadFile,
} from './research-export';
import type { ResearchFinding } from './research-export';

// ─── Test Data ────────────────────────

const baseFinding: ResearchFinding = {
  id: 'abc-123',
  userId: 'user-1',
  clientId: 'client-1',
  researchType: 'competitor',
  targetUrl: 'https://example.com',
  targetQuery: undefined,
  findings: { domain: 'example.com', score: 85 },
  reportMarkdown: '# Report\n\nThis is a report.',
  createdAt: 1700000000000,
  expiresAt: 1710000000000,
};

const minimalFinding: ResearchFinding = {
  id: 'def-456',
  userId: 'user-2',
  researchType: 'market',
  findings: {},
  createdAt: 1700000000000,
};

// ─── escapeCsvValue ───────────────────

describe('escapeCsvValue', () => {
  it('returns plain string unchanged', () => {
    expect(escapeCsvValue('hello')).toBe('hello');
  });

  it('wraps value containing comma in double quotes', () => {
    expect(escapeCsvValue('a,b')).toBe('"a,b"');
  });

  it('wraps value containing double quote and escapes it', () => {
    const input = '"quoted"'; // string with 2 double-quote chars
    const result = escapeCsvValue(input);
    // Replace each " → "": ""quoted""
    // Wrap in outer quotes: """"quoted""""
    const expected = '"' + input.replace(/"/g, '""') + '"';
    expect(result).toBe(expected);
  });

  it('wraps value containing newline in double quotes', () => {
    expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
  });

  it('wraps value containing carriage return in double quotes', () => {
    expect(escapeCsvValue('line1\rline2')).toBe('"line1\rline2"');
  });

  it('handles empty string', () => {
    expect(escapeCsvValue('')).toBe('');
  });

  it('handles value with multiple special characters', () => {
    const result = escapeCsvValue('a,"b"\nc');
    expect(result).toBe('"a,""b""\nc"');
  });

  it('wraps value containing only a comma', () => {
    expect(escapeCsvValue(',')).toBe('","');
  });
});

// ─── findingsToCsv ────────────────────

describe('findingsToCsv', () => {
  it('generates header row', () => {
    const csv = findingsToCsv([]);
    const header = csv.split('\n')[0];
    expect(header).toBe('id,researchType,targetUrl,targetQuery,clientId,createdAt,expiresAt,findingsJson');
  });

  it('generates correct row for a single finding', () => {
    const csv = findingsToCsv([baseFinding]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('abc-123');
    expect(lines[1]).toContain('competitor');
    expect(lines[1]).toContain('https://example.com');
  });

  it('handles null optional fields as empty strings', () => {
    const csv = findingsToCsv([minimalFinding]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('def-456');
    expect(lines[1]).toContain('market');
  });

  it('escapes commas in findingsJson', () => {
    const finding: ResearchFinding = {
      ...minimalFinding,
      findings: { tags: ['a,b', 'c'] },
    };
    const csv = findingsToCsv([finding]);
    expect(csv).toContain('"a,b"');
  });

  it('escapes double quotes in findings data', () => {
    const finding: ResearchFinding = {
      ...minimalFinding,
      findings: { note: 'say "hello"' },
    };
    const csv = findingsToCsv([finding]);
    // findingsJson is JSON: {"note":"say \"hello\""}
    // escapeCsvValue wraps it and doubles internal quotes
    // The CSV cell contains escaped double quotes from the JSON
    const lines = csv.split('\n');
    const dataLine = lines[1];
    // The findingsJson field should be quoted (it contains commas from JSON)
    // Check it's properly escaped — the JSON contains quotes which get doubled
    expect(dataLine).toContain('""'); // Has doubled quotes from escaping
  });

  it('generates correct number of rows for multiple findings', () => {
    const csv = findingsToCsv([baseFinding, minimalFinding]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
  });

  it('converts createdAt to ISO string', () => {
    const csv = findingsToCsv([baseFinding]);
    expect(csv).toContain(new Date(1700000000000).toISOString());
  });

  it('converts expiresAt to ISO string', () => {
    const csv = findingsToCsv([baseFinding]);
    expect(csv).toContain(new Date(1710000000000).toISOString());
  });

  it('handles finding with no expiresAt (empty field)', () => {
    const csv = findingsToCsv([minimalFinding]);
    const lines = csv.split('\n');
    // expiresAt should be empty → two consecutive commas
    expect(lines[1]).toContain(',,');
  });
});

// ─── findingsToJson ───────────────────

describe('findingsToJson', () => {
  it('returns valid JSON array', () => {
    const parsed = JSON.parse(findingsToJson([baseFinding]));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
  });

  it('maps fields correctly', () => {
    const parsed = JSON.parse(findingsToJson([baseFinding]))[0];
    expect(parsed.id).toBe('abc-123');
    expect(parsed.researchType).toBe('competitor');
    expect(parsed.targetUrl).toBe('https://example.com');
    expect(parsed.clientId).toBe('client-1');
    expect(parsed.findings).toEqual({ domain: 'example.com', score: 85 });
  });

  it('converts timestamps to ISO strings', () => {
    const parsed = JSON.parse(findingsToJson([baseFinding]))[0];
    expect(parsed.createdAt).toBe(new Date(1700000000000).toISOString());
    expect(parsed.expiresAt).toBe(new Date(1710000000000).toISOString());
  });

  it('converts null optional fields to null', () => {
    const parsed = JSON.parse(findingsToJson([minimalFinding]))[0];
    expect(parsed.targetUrl).toBeNull();
    expect(parsed.targetQuery).toBeNull();
    expect(parsed.clientId).toBeNull();
    expect(parsed.reportMarkdown).toBeNull();
    expect(parsed.expiresAt).toBeNull();
  });

  it('returns pretty-printed JSON', () => {
    const json = findingsToJson([baseFinding]);
    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });

  it('handles empty array', () => {
    expect(findingsToJson([])).toBe('[]');
  });

  it('handles multiple findings', () => {
    const parsed = JSON.parse(findingsToJson([baseFinding, minimalFinding]));
    expect(parsed).toHaveLength(2);
  });
});

// ─── DOM Download Helpers ─────────────

function setupDownloadMocks() {
  const clickSpy = vi.fn();
  const mockAnchor = {
    href: '',
    download: '',
    click: clickSpy,
  } as unknown as HTMLAnchorElement;

  const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
  const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor);
  const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor);
  const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

  return {
    clickSpy,
    createElementSpy,
    appendChildSpy,
    removeChildSpy,
    createObjectURLSpy,
    revokeObjectURLSpy,
  };
}

// ─── downloadFile ─────────────────────

describe('downloadFile', () => {
  let mocks: ReturnType<typeof setupDownloadMocks>;

  beforeEach(() => { mocks = setupDownloadMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('creates an anchor element and triggers download', () => {
    downloadFile('test content', 'test.txt', 'text/plain');
    expect(mocks.createElementSpy).toHaveBeenCalledWith('a');
    expect(mocks.clickSpy).toHaveBeenCalled();
  });

  it('creates object URL with correct blob type', () => {
    downloadFile('test content', 'test.txt', 'text/plain');
    const blobArg = mocks.createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('text/plain');
  });

  it('sets correct filename on anchor', () => {
    downloadFile('content', 'file.csv', 'text/csv');
    const anchor = mocks.createElementSpy.mock.results[0].value as HTMLAnchorElement;
    expect(anchor.download).toBe('file.csv');
  });

  it('appends and removes anchor from body', () => {
    downloadFile('content', 'file.json', 'application/json');
    expect(mocks.appendChildSpy).toHaveBeenCalled();
    expect(mocks.removeChildSpy).toHaveBeenCalled();
  });

  it('revokes object URL after download', () => {
    downloadFile('content', 'file.json', 'application/json');
    expect(mocks.revokeObjectURLSpy).toHaveBeenCalled();
  });
});

// ─── exportToJson ─────────────────────

describe('exportToJson', () => {
  let mocks: ReturnType<typeof setupDownloadMocks>;

  beforeEach(() => { mocks = setupDownloadMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('triggers download with application/json MIME type', () => {
    exportToJson([baseFinding]);
    expect(mocks.clickSpy).toHaveBeenCalled();
    const blobArg = mocks.createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('application/json');
  });

  it('triggers download with date-stamped filename', () => {
    exportToJson([baseFinding]);
    const anchor = mocks.createElementSpy.mock.results[0].value as HTMLAnchorElement;
    expect(anchor.download).toMatch(/^research-findings-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('exports valid JSON content with correct data', async () => {
    exportToJson([baseFinding]);
    const blobArg = mocks.createObjectURLSpy.mock.calls[0][0] as Blob;
    const text = await blobArg.text();
    const parsed = JSON.parse(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('abc-123');
    expect(parsed[0].researchType).toBe('competitor');
  });
});

// ─── exportToCsv ──────────────────────

describe('exportToCsv', () => {
  let mocks: ReturnType<typeof setupDownloadMocks>;

  beforeEach(() => { mocks = setupDownloadMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('triggers download with text/csv MIME type', () => {
    exportToCsv([baseFinding]);
    expect(mocks.clickSpy).toHaveBeenCalled();
    const blobArg = mocks.createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('text/csv');
  });

  it('triggers download with date-stamped CSV filename', () => {
    exportToCsv([baseFinding]);
    const anchor = mocks.createElementSpy.mock.results[0].value as HTMLAnchorElement;
    expect(anchor.download).toMatch(/^research-findings-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('exports CSV with header and data rows', async () => {
    exportToCsv([baseFinding]);
    const blobArg = mocks.createObjectURLSpy.mock.calls[0][0] as Blob;
    const text = await blobArg.text();
    const lines = text.split('\n');
    expect(lines[0]).toContain('id,researchType');
    expect(lines[1]).toContain('abc-123');
    expect(lines).toHaveLength(2);
  });
});
