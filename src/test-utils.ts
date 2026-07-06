import { vi } from 'vitest';

// ─── jsPDF Mock Factory ───────────────────────

/** Creates a mock jsPDF instance with all required methods as spies.
 *  Pass a custom `save` to override the default no-op save spy. */
export function createJsPdfMock(overrides?: { save?: ReturnType<typeof vi.fn> }) {
  return {
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    splitTextToSize: vi.fn().mockImplementation((t: string) => [t]),
    addPage: vi.fn(),
    save: overrides?.save ?? vi.fn(),
    internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
  };
}

// ─── URL Mock Factory ─────────────────────────

/** Mocks URL.createObjectURL and URL.revokeObjectURL.
 *  Returns an object with a `restore()` method to undo the mocks. */
export function createUrlMock() {
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
  return {
    restore() {
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    },
  };
}

// ─── Anchor Download Mock Factory ─────────────

/** Intercepts document.createElement to capture the `download` attribute
 *  value set on `<a>` elements. Useful for asserting download filenames.
 *  Returns an object with `getFilename()` and `restore()`. */
export function createAnchorDownloadMock() {
  const origCreateElement = document.createElement.bind(document);
  let capturedFilename = '';
  document.createElement = ((tag: string) => {
    if (tag === 'a') {
      const anchor = origCreateElement('a');
      Object.defineProperty(anchor, 'download', {
        configurable: true,
        set(v: string) { capturedFilename = v; },
        get() { return capturedFilename; },
      });
      return anchor;
    }
    return origCreateElement(tag);
  }) as typeof document.createElement;
  return {
    getFilename: () => capturedFilename,
    restore() {
      document.createElement = origCreateElement;
    },
  };
}

// ─── Anchor Click Mock Factory ────────────────

/** Intercepts document.createElement to capture the `click` callback
 *  set on `<a>` elements. Useful for asserting download triggers.
 *  Returns `getClickSpy()`, `wasClicked()`, and `restore()`. */
export function createAnchorClickMock() {
  const origCreateElement = document.createElement.bind(document);
  const mockClick = vi.fn();
  document.createElement = ((tag: string) => {
    if (tag === 'a') {
      const el = origCreateElement(tag);
      el.click = mockClick;
      return el;
    }
    return origCreateElement(tag);
  }) as typeof document.createElement;
  return {
    getClickSpy: () => mockClick,
    wasClicked: () => mockClick.mock.calls.length > 0,
    restore() {
      document.createElement = origCreateElement;
    },
  };
}

// ─── Blob Mock Factory ────────────────────────

/** Creates a mock Blob constructor that captures content and MIME type.
 *  Use `getContent()` and `getMime()` to read captured values. */
export function createBlobMock() {
  let content = '';
  let mime = '';
  const MockBlob = vi.fn().mockImplementation(function (parts: string[], options?: { type?: string }) {
    content = parts.join('');
    mime = options?.type || '';
  }) as unknown as typeof Blob;
  return {
    Blob: MockBlob,
    getContent: () => content,
    getMime: () => mime,
  };
}
