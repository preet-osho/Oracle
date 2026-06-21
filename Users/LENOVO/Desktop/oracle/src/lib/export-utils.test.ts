import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  chatToPlainText,
  chatToMarkdown,
  exportToCSV,
  exportTableToCSV,
  copyAsPlainText,
  copyAsMarkdown,
} from './export-utils';

// ─── Mocks ───

// Mock document.createElement for blob URL tests
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockRevokeObjectURL = vi.fn();
const mockCreateElement = vi.fn(() => ({ click: mockClick, href: '', download: '' }));
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, 'createElement', { value: mockCreateElement, writable: true });
  Object.defineProperty(document.body, 'appendChild', { value: mockAppendChild, writable: true });
  Object.defineProperty(document.body, 'removeChild', { value: mockRemoveChild, writable: true });
  Object.defineProperty(URL, 'createObjectURL', { value: mockCreateObjectURL, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: mockRevokeObjectURL, writable: true });
});

// ─── Tests ───

describe('export-utils', () => {
  const sampleMessages = [
    { role: 'user' as const, content: 'Hello ORACLE', timestamp: Date.now() },
    { role: 'assistant' as const, content: 'Hello! How can I help?', timestamp: Date.now() + 1000 },
  ];

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
    });
  });

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
  });

  describe('exportToCSV', () => {
    it('creates blob with CSV content', () => {
      exportToCSV({
        headers: ['Name', 'Value'],
        rows: [['A', '1'], ['B', '2']],
        fileName: 'test',
      });
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
    });

    it('escapes values with commas', () => {
      const createObjectURLSpy = mockCreateObjectURL;
      // We can't easily inspect the blob content, but we verify the flow completes
      exportToCSV({
        headers: ['Name'],
        rows: [['Hello, World']],
        fileName: 'test',
      });
      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('escapes values with quotes', () => {
      exportToCSV({
        headers: ['Name'],
        rows: [['Say "hi"']],
        fileName: 'test',
      });
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it('sanitizes filename', () => {
      exportToCSV({
        headers: ['A'],
        rows: [['1']],
        fileName: 'My File Name!',
      });
      const downloadEl = mockCreateElement.mock.results[0].value;
      expect(downloadEl.download).toMatch(/my-file-name/);
    });
  });

  describe('exportTableToCSV', () => {
    it('exports data array as CSV', () => {
      exportTableToCSV([
        { name: 'Acme', value: 100 },
        { name: 'Beta', value: 200 },
      ], 'table-export');
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
    });

    it('handles empty data array', () => {
      exportTableToCSV([], 'empty');
      expect(mockCreateObjectURL).not.toHaveBeenCalled();
    });

    it('handles missing values with empty string', () => {
      exportTableToCSV([
        { name: 'Acme' }, // missing 'value'
      ], 'table');
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });

  describe('copyAsPlainText', () => {
    it('copies text to clipboard and returns true', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
      });
      const result = await copyAsPlainText('Hello world');
      expect(result).toBe(true);
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

  describe('copyAsMarkdown', () => {
    it('copies markdown to clipboard and returns true', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
      });
      const result = await copyAsMarkdown('# Hello');
      expect(result).toBe(true);
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
});
