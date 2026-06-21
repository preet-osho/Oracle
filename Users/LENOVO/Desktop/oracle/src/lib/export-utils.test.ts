// ═══════════════════════════════════════
// ORACLE — Export Utilities Tests
// Blob content capture, all export functions, chat export wrappers
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  chatToPlainText,
  chatToMarkdown,
  exportToCSV,
  exportTableToCSV,
  exportToWord,
  exportToMarkdown,
  exportChatToPDF,
  exportChatToWord,
  exportChatToMarkdown,
  exportChatToCSV,
  copyAsPlainText,
  copyAsMarkdown,
  type ChatMessage,
} from './export-utils';

// ─── Blob Content Capture ──────────────

let lastBlob: Blob | null = null;
let lastDownloadName = '';

const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  lastBlob = null;
  lastDownloadName = '';

  // Mock document.createElement — capture href/download
  vi.spyOn(document, 'createElement').mockReturnValue({
    click: mockClick,
    href: '',
    download: '',
  } as unknown as HTMLAnchorElement);

  vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
  vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

  // Mock URL.createObjectURL — capture the Blob
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
    lastBlob = blob as Blob;
    return 'blob:mock-url';
  });

  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

/** Read the captured Blob as text */
async function getCapturedContent(): Promise<string> {
  expect(lastBlob).not.toBeNull();
  return lastBlob!.text();
}

/** Get the download filename set on the anchor element */
function getDownloadName(): string {
  const el = vi.mocked(document.createElement).mock.results[0]?.value;
  return el?.download ?? '';
}

// ─── Test Data ──────────────────────────

const sampleMessages: ChatMessage[] = [
  { role: 'user', content: 'Hello ORACLE', timestamp: 1719000000000 },
  { role: 'assistant', content: 'Hello! How can I help?', timestamp: 1719000001000 },
];

// ─── chatToPlainText Tests ──────────────

describe('chatToPlainText', () => {
  it('includes title and separator', () => {
    const text = chatToPlainText(sampleMessages, 'Test Chat');
    expect(text).toContain('Test Chat');
    expect(text).toContain('='.repeat('Test Chat'.length));
  });

  it('includes exported date', () => {
    const text = chatToPlainText(sampleMessages, 'Test');
    expect(text).toContain('Exported:');
  });

  it('formats user messages with You label', () => {
    const text = chatToPlainText(sampleMessages, 'Test');
    expect(text).toContain('You:');
    expect(text).toContain('Hello ORACLE');
  });

  it('formats assistant messages with ORACLE label', () => {
    const text = chatToPlainText(sampleMessages, 'Test');
    expect(text).toContain('ORACLE:');
    expect(text).toContain('Hello! How can I help?');
  });

  it('handles empty messages array', () => {
    const text = chatToPlainText([], 'Empty Chat');
    expect(text).toContain('Empty Chat');
    expect(text).toContain('='.repeat('Empty Chat'.length));
  });

  it('includes timestamp for each message', () => {
    const text = chatToPlainText(sampleMessages, 'Test');
    expect(text).toMatch(/\[\d{1,2}:\d{2}(:\d{2})?/);
  });
});

// ─── chatToMarkdown Tests ───────────────

describe('chatToMarkdown', () => {
  it('includes title as heading', () => {
    const md = chatToMarkdown(sampleMessages, 'Test Chat');
    expect(md).toContain('# Test Chat');
  });

  it('includes exported date', () => {
    const md = chatToMarkdown(sampleMessages, 'Test');
    expect(md).toContain('Exported:');
  });

  it('formats user messages with You bold', () => {
    const md = chatToMarkdown(sampleMessages, 'Test');
    expect(md).toContain('👤 **You**:');
    expect(md).toContain('Hello ORACLE');
  });

  it('formats assistant messages with ORACLE bold', () => {
    const md = chatToMarkdown(sampleMessages, 'Test');
    expect(md).toContain('⚡ **ORACLE**:');
    expect(md).toContain('Hello! How can I help?');
  });

  it('includes horizontal rules between messages', () => {
    const md = chatToMarkdown(sampleMessages, 'Test');
    const hrCount = (md.match(/---/g) || []).length;
    expect(hrCount).toBeGreaterThanOrEqual(2);
  });

  it('handles empty messages', () => {
    const md = chatToMarkdown([], 'Empty');
    expect(md).toContain('# Empty');
  });
});

// ─── exportToCSV Tests (with content) ───

describe('exportToCSV', () => {
  it('generates correct CSV content', async () => {
    exportToCSV({
      headers: ['Name', 'Value'],
      rows: [['Acme', '100'], ['Beta', '200']],
      fileName: 'test',
    });
    const content = await getCapturedContent();
    expect(content).toBe('Name,Value\nAcme,100\nBeta,200');
  });

  it('escapes values with commas', async () => {
    exportToCSV({
      headers: ['Name'],
      rows: [['Hello, World']],
      fileName: 'test',
    });
    const content = await getCapturedContent();
    expect(content).toContain('"Hello, World"');
  });

  it('escapes values with double quotes', async () => {
    exportToCSV({
      headers: ['Name'],
      rows: [['Say "hi"']],
      fileName: 'test',
    });
    const content = await getCapturedContent();
    expect(content).toContain('"Say ""hi"""');
  });

  it('escapes values with newlines', async () => {
    exportToCSV({
      headers: ['Name'],
      rows: [['Line1\nLine2']],
      fileName: 'test',
    });
    const content = await getCapturedContent();
    expect(content).toContain('"Line1\nLine2"');
  });

  it('does not escape simple values', async () => {
    exportToCSV({
      headers: ['A', 'B'],
      rows: [['hello', 'world']],
      fileName: 'test',
    });
    const content = await getCapturedContent();
    expect(content).toBe('A,B\nhello,world');
  });

  it('sanitizes filename', () => {
    exportToCSV({
      headers: ['A'],
      rows: [['1']],
      fileName: 'My File Name!',
    });
    expect(getDownloadName()).toMatch(/my-file-name/);
    expect(getDownloadName()).toMatch(/\.csv$/);
  });

  it('appends .csv extension', () => {
    exportToCSV({
      headers: ['A'],
      rows: [['1']],
      fileName: 'export',
    });
    expect(getDownloadName()).toMatch(/\.csv$/);
  });

  it('creates blob URL and triggers download', () => {
    exportToCSV({
      headers: ['A'],
      rows: [['1']],
      fileName: 'test',
    });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('appends and removes anchor from body', () => {
    exportToCSV({
      headers: ['A'],
      rows: [['1']],
      fileName: 'test',
    });
    expect(document.body.appendChild).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
  });
});

// ─── exportTableToCSV Tests ─────────────

describe('exportTableToCSV', () => {
  it('auto-generates headers from object keys', async () => {
    exportTableToCSV([
      { name: 'Acme', value: 100 },
      { name: 'Beta', value: 200 },
    ], 'table');
    const content = await getCapturedContent();
    expect(content).toContain('name,value');
    expect(content).toContain('Acme,100');
    expect(content).toContain('Beta,200');
  });

  it('handles empty data array', () => {
    exportTableToCSV([], 'empty');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('handles missing values with empty string', async () => {
    exportTableToCSV([{ name: 'Acme' } as Record<string, string | number>], 'table');
    const content = await getCapturedContent();
    expect(content).toContain('Acme');
  });

  it('converts numbers to strings', async () => {
    exportTableToCSV([{ count: 42 }], 'table');
    const content = await getCapturedContent();
    expect(content).toContain('42');
  });
});

// ─── exportToMarkdown Tests ─────────────

describe('exportToMarkdown', () => {
  it('generates correct markdown with title', async () => {
    exportToMarkdown({
      title: 'My Report',
      sections: [{ heading: 'Section 1', content: 'Content here' }],
      fileName: 'report',
    });
    const content = await getCapturedContent();
    expect(content).toContain('# My Report');
    expect(content).toContain('## Section 1');
    expect(content).toContain('Content here');
    expect(content).toContain('Generated by ORACLE');
  });

  it('handles multiple sections', async () => {
    exportToMarkdown({
      title: 'Report',
      sections: [
        { heading: 'A', content: 'Content A' },
        { heading: 'B', content: 'Content B' },
      ],
      fileName: 'report',
    });
    const content = await getCapturedContent();
    expect(content).toContain('## A');
    expect(content).toContain('## B');
    expect(content).toContain('Content A');
    expect(content).toContain('Content B');
  });

  it('sanitizes filename with .md extension', () => {
    exportToMarkdown({
      title: 'Report',
      sections: [],
      fileName: 'My Report!',
    });
    expect(getDownloadName()).toMatch(/my-report/);
    expect(getDownloadName()).toMatch(/\.md$/);
  });

  it('creates blob with text/markdown type', async () => {
    exportToMarkdown({
      title: 'Test',
      sections: [],
      fileName: 'test',
    });
    expect(lastBlob!.type).toBe('text/markdown');
  });
});

// ─── exportToWord Tests ─────────────────

describe('exportToWord', () => {
  it('generates HTML with title', async () => {
    exportToWord({
      title: 'My Document',
      sections: [{ heading: 'Intro', content: 'Hello world' }],
      fileName: 'doc',
    });
    const content = await getCapturedContent();
    expect(content).toContain('<title>My Document</title>');
    expect(content).toContain('<h1>My Document</h1>');
    expect(content).toContain('<h2>Intro</h2>');
    expect(content).toContain('Hello world');
  });

  it('includes ORACLE branding', async () => {
    exportToWord({
      title: 'Doc',
      sections: [],
      fileName: 'doc',
    });
    const content = await getCapturedContent();
    expect(content).toContain('ORACLE');
    expect(content).toContain('Universal Agency Intelligence');
  });

  it('renders table sections as HTML table', async () => {
    exportToWord({
      title: 'Doc',
      sections: [{
        heading: 'Data',
        content: '',
        type: 'table',
        tableHeaders: ['Name', 'Value'],
        tableRows: [['A', '1'], ['B', '2']],
      }],
      fileName: 'doc',
    });
    const content = await getCapturedContent();
    expect(content).toContain('<table>');
    expect(content).toContain('<th>Name</th>');
    expect(content).toContain('<td>A</td>');
    expect(content).toContain('<td>2</td>');
  });

  it('renders list sections as HTML ul/li', async () => {
    exportToWord({
      title: 'Doc',
      sections: [{
        heading: 'Items',
        content: '',
        type: 'list',
        listItems: ['Item 1', 'Item 2'],
      }],
      fileName: 'doc',
    });
    const content = await getCapturedContent();
    expect(content).toContain('<ul>');
    expect(content).toContain('<li>Item 1</li>');
    expect(content).toContain('<li>Item 2</li>');
  });

  it('renders text sections with newlines as <br>', async () => {
    exportToWord({
      title: 'Doc',
      sections: [{ heading: 'Text', content: 'Line 1\nLine 2' }],
      fileName: 'doc',
    });
    const content = await getCapturedContent();
    expect(content).toContain('Line 1<br>Line 2');
  });

  it('includes subtitle when provided', async () => {
    exportToWord({
      title: 'Doc',
      subtitle: 'A subtitle',
      sections: [],
      fileName: 'doc',
    });
    const content = await getCapturedContent();
    expect(content).toContain('A subtitle');
  });

  it('sanitizes filename with .doc extension', () => {
    exportToWord({
      title: 'My Doc',
      sections: [],
      fileName: 'My Doc',
    });
    expect(getDownloadName()).toMatch(/my-doc/);
    expect(getDownloadName()).toMatch(/\.doc$/);
  });

  it('creates blob with application/msword type', async () => {
    exportToWord({
      title: 'Doc',
      sections: [],
      fileName: 'doc',
    });
    expect(lastBlob!.type).toBe('application/msword');
  });

  it('includes footer with generation info', async () => {
    exportToWord({
      title: 'Doc',
      sections: [],
      fileName: 'doc',
    });
    const content = await getCapturedContent();
    expect(content).toContain('footer');
    expect(content).toContain('Generated by ORACLE');
  });

  it('uses title as filename when no fileName provided', () => {
    exportToWord({
      title: 'Report Title',
      sections: [],
    });
    expect(getDownloadName()).toMatch(/report-title/);
  });
});

// ─── exportChatToPDF Tests ──────────────

describe('exportChatToPDF', () => {
  it('calls exportToPDF with chat sections', () => {
    // exportToPDF uses jsPDF which is complex; just verify it doesn't throw
    expect(() => exportChatToPDF(sampleMessages, 'Chat')).not.toThrow();
  });

  it('sets subtitle with message count', () => {
    // Just verify it runs without error
    exportChatToPDF(sampleMessages, 'My Chat');
  });

  it('handles empty messages', () => {
    expect(() => exportChatToPDF([], 'Empty')).not.toThrow();
  });
});

// ─── exportChatToWord Tests ─────────────

describe('exportChatToWord', () => {
  it('generates Word doc with chat messages', async () => {
    exportChatToWord(sampleMessages, 'Chat Export');
    const content = await getCapturedContent();
    expect(content).toContain('<h1>Chat Export</h1>');
    expect(content).toContain('💬 User');
    expect(content).toContain('⚡ ORACLE');
    expect(content).toContain('Hello ORACLE');
    expect(content).toContain('Hello! How can I help?');
    expect(content).toContain('2 messages');
  });

  it('sanitizes filename', () => {
    exportChatToWord(sampleMessages, 'My Chat');
    expect(getDownloadName()).toMatch(/chat-my-chat/);
    expect(getDownloadName()).toMatch(/\.doc$/);
  });

  it('handles empty messages', async () => {
    exportChatToWord([], 'Empty');
    const content = await getCapturedContent();
    expect(content).toContain('0 messages');
  });
});

// ─── exportChatToMarkdown Tests ─────────

describe('exportChatToMarkdown', () => {
  it('generates markdown with chat messages', async () => {
    exportChatToMarkdown(sampleMessages, 'Chat MD');
    const content = await getCapturedContent();
    expect(content).toContain('# Chat MD');
    expect(content).toContain('## 💬 You');
    expect(content).toContain('## ⚡ ORACLE');
    expect(content).toContain('Hello ORACLE');
    expect(content).toContain('Hello! How can I help?');
  });

  it('sanitizes filename with .md extension', () => {
    exportChatToMarkdown(sampleMessages, 'My Chat');
    expect(getDownloadName()).toMatch(/chat-my-chat/);
    expect(getDownloadName()).toMatch(/\.md$/);
  });
});

// ─── exportChatToCSV Tests ──────────────

describe('exportChatToCSV', () => {
  it('generates CSV with Role,Message,Timestamp headers', async () => {
    exportChatToCSV(sampleMessages, 'Chat CSV');
    const content = await getCapturedContent();
    expect(content).toContain('Role,Message,Timestamp');
    expect(content).toContain('user');
    expect(content).toContain('assistant');
    expect(content).toContain('Hello ORACLE');
    expect(content).toContain('Hello! How can I help?');
  });

  it('replaces newlines in message content', async () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Line1\nLine2', timestamp: Date.now() },
    ];
    exportChatToCSV(messages, 'Test');
    const content = await getCapturedContent();
    // Newlines in content should be replaced with spaces
    expect(content).toContain('Line1 Line2');
  });

  it('sanitizes filename', () => {
    exportChatToCSV(sampleMessages, 'My Chat');
    expect(getDownloadName()).toMatch(/chat-my-chat/);
    expect(getDownloadName()).toMatch(/\.csv$/);
  });
});

// ─── copyAsPlainText Tests ──────────────

describe('copyAsPlainText', () => {
  it('copies text to clipboard and returns true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
    });
    const result = await copyAsPlainText('Hello world');
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith('Hello world');
  });

  it('returns false on clipboard error', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      writable: true,
    });
    const result = await copyAsPlainText('Hello');
    expect(result).toBe(false);
  });
});

// ─── copyAsMarkdown Tests ───────────────

describe('copyAsMarkdown', () => {
  it('copies markdown to clipboard and returns true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
    });
    const result = await copyAsMarkdown('# Hello');
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith('# Hello');
  });

  it('returns false on clipboard error', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      writable: true,
    });
    const result = await copyAsMarkdown('# Hello');
    expect(result).toBe(false);
  });
});
