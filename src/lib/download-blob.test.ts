// ═══════════════════════════════════════
// ORACLE — Download Blob Utility Tests
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadBlob } from './download-blob';

// ─── Mocks ──────────────────────────────

let capturedBlob: Blob | null = null;

const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  capturedBlob = null;

  vi.spyOn(document, 'createElement').mockReturnValue({
    href: '',
    download: '',
    click: mockClick,
  } as unknown as HTMLAnchorElement);

  vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
  vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
    capturedBlob = blob as Blob;
    return 'blob:mock-download-url';
  });

  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(mockRevokeObjectURL);
});

// ─── SSR Guard ──────────────────────────

describe('SSR guard', () => {
  it('returns early when document is undefined (SSR)', () => {
    const original = globalThis.document;
    // @ts-expect-error Testing SSR environment
    delete globalThis.document;
    try {
      // Should not throw
      downloadBlob('data', 'file.txt', 'text/plain');
      // No DOM calls should have been made
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    } finally {
      globalThis.document = original;
    }
  });
});

// ─── String Content ─────────────────────

describe('downloadBlob with string content', () => {
  it('creates a Blob with the correct MIME type', () => {
    downloadBlob('hello', 'test.txt', 'text/plain');
    expect(capturedBlob).not.toBeNull();
    expect(capturedBlob!.type).toBe('text/plain');
  });

  it('stores the string content in the Blob', async () => {
    downloadBlob('hello world', 'test.txt', 'text/plain');
    const text = await capturedBlob!.text();
    expect(text).toBe('hello world');
  });

  it('sets the correct filename on the anchor', () => {
    downloadBlob('data', 'report.pdf', 'application/pdf');
    const anchor = vi.mocked(document.createElement).mock.results[0].value;
    expect(anchor.download).toBe('report.pdf');
  });

  it('sets the blob URL as href on the anchor', () => {
    downloadBlob('data', 'file.txt', 'text/plain');
    const anchor = vi.mocked(document.createElement).mock.results[0].value;
    expect(anchor.href).toBe('blob:mock-download-url');
  });
});

// ─── Blob Content ───────────────────────

describe('downloadBlob with Blob content', () => {
  it('passes the Blob through without wrapping', () => {
    const originalBlob = new Blob(['binary data'], { type: 'application/octet-stream' });
    downloadBlob(originalBlob, 'data.bin', 'text/csv');
    expect(capturedBlob).toBe(originalBlob);
    // Should use the original Blob's type, not the mimeType parameter
    expect(capturedBlob!.type).toBe('application/octet-stream');
  });
});

// ─── DOM Lifecycle ──────────────────────

describe('DOM lifecycle', () => {
  it('creates an anchor element', () => {
    downloadBlob('data', 'file.txt', 'text/plain');
    expect(document.createElement).toHaveBeenCalledWith('a');
  });

  it('appends the anchor to document.body', () => {
    downloadBlob('data', 'file.txt', 'text/plain');
    expect(mockAppendChild).toHaveBeenCalledTimes(1);
  });

  it('clicks the anchor to trigger download', () => {
    downloadBlob('data', 'file.txt', 'text/plain');
    expect(mockClick).toHaveBeenCalledTimes(1);
  });

  it('removes the anchor from document.body after click', () => {
    downloadBlob('data', 'file.txt', 'text/plain');
    expect(mockRemoveChild).toHaveBeenCalledTimes(1);
  });

  it('creates an object URL for the Blob', () => {
    downloadBlob('data', 'file.txt', 'text/plain');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('revokes the object URL after download', () => {
    downloadBlob('data', 'file.txt', 'text/plain');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-download-url');
  });

  it('revokes URL after click completes', () => {
    let clickDone = false;
    mockClick.mockImplementation(() => { clickDone = true; });
    downloadBlob('data', 'file.txt', 'text/plain');
    expect(clickDone).toBe(true);
    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });
});

// ─── Edge Cases ─────────────────────────

describe('edge cases', () => {
  it('handles empty string content', () => {
    downloadBlob('', 'empty.txt', 'text/plain');
    expect(capturedBlob).not.toBeNull();
    expect(capturedBlob!.size).toBe(0);
  });

  it('handles content with special characters', async () => {
    downloadBlob('line1\nline2\ttab"quotes"', 'special.txt', 'text/plain');
    const text = await capturedBlob!.text();
    expect(text).toBe('line1\nline2\ttab"quotes"');
  });

  it('handles very long content', async () => {
    const long = 'x'.repeat(100_000);
    downloadBlob(long, 'big.txt', 'text/plain');
    const text = await capturedBlob!.text();
    expect(text.length).toBe(100_000);
  });

  it('handles Unicode content', async () => {
    downloadBlob('नमस्ते 🌍 café', 'unicode.txt', 'text/plain');
    const text = await capturedBlob!.text();
    expect(text).toBe('नमस्ते 🌍 café');
  });
});
