import { describe, it, expect, vi, afterEach } from 'vitest';
import { chunkText, retrieveRelevant, buildRagContext, buildContext, processDocument, retrieveRelevantTfIdf } from './rag';
import type { KnowledgeDocument, SearchResult, MemoryItem } from '@/types';
import * as embeddingsModule from '@/lib/embeddings';

// Mock embeddings module (no OpenAI key in tests)
vi.mock('@/lib/embeddings', () => ({
  semanticSearch: vi.fn().mockResolvedValue([]),
  storeEmbeddings: vi.fn().mockResolvedValue(0),
  deleteEmbeddings: vi.fn().mockResolvedValue(undefined),
  isSemanticSearchAvailable: vi.fn().mockReturnValue(false),
  generateEmbeddings: vi.fn().mockResolvedValue([]),
  generateEmbedding: vi.fn().mockResolvedValue([]),
}));

// ─── Shared mock state ─────────────────
// processXLSX uses `await import('exceljs')` which resolves to this mock.
// Tests control output by setting `mockSheetMap` before calling processDocument.

interface MockRow {
  values: unknown[];
}
interface MockSheet {
  name: string;
  eachRow(cb: (row: MockRow) => void): void;
}
interface MockWorkbook {
  xlsx: { load(buf: ArrayBuffer): Promise<void> };
  eachSheet(cb: (sheet: MockSheet, id: number) => void): void;
}

let mockSheetMap: Record<string, (string | null | undefined | Record<string, unknown>)[][]> = {};
let shouldLoadFail = false;

vi.mock('exceljs', () => {
  function createWorkbook(): MockWorkbook {
    return {
      xlsx: {
        load: vi.fn().mockImplementation(() => {
          if (shouldLoadFail) return Promise.reject(new Error('Invalid format'));
          return Promise.resolve();
        }),
      },
      eachSheet(cb: (sheet: MockSheet, id: number) => void) {
        Object.entries(mockSheetMap).forEach(([name, rows], i) => {
          const sheet: MockSheet = {
            name,
            eachRow(rowCb: (row: MockRow) => void) {
              for (const row of rows) {
                rowCb({ values: ['', ...row] });
              }
            },
          };
          cb(sheet, i + 1);
        });
      },
    };
  }
  return { default: { Workbook: createWorkbook }, Workbook: createWorkbook };
});

// ─── Other mocks ───────────────────────

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-nanoid-123'),
}));

vi.mock('pdfjs-dist', () => ({
  default: {
    getDocument: vi.fn().mockReturnValue({
      promise: Promise.resolve({ numPages: 0, getPage: vi.fn() }),
    }),
    GlobalWorkerOptions: { workerSrc: '' },
    version: '4.0.0',
  },
}));

vi.mock('mammoth', () => ({
  extractRawText: vi.fn().mockResolvedValue({ value: 'docx content' }),
}));

// ─── Helpers ───────────────────────────

function makeFile(name: string): File {
  return new File([new ArrayBuffer(8)], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ─── Tests ─────────────────────────────

describe('RAG', () => {
  afterEach(() => {
    mockSheetMap = {};
    shouldLoadFail = false;
  });

  // ── chunkText ──

  describe('chunkText', () => {
    it('returns empty array for empty input', () => {
      expect(chunkText('')).toEqual([]);
      expect(chunkText('   ')).toEqual([]);
    });

    it('returns single chunk for short text', () => {
      expect(chunkText('Hello world')).toEqual(['Hello world']);
    });

    it('splits long text into multiple chunks', () => {
      const chunks = chunkText('A'.repeat(2500), 1000, 200);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it('respects custom chunk size', () => {
      const chunks = chunkText('A'.repeat(500), 100, 0);
      expect(chunks.length).toBe(5);
    });

    it('filters out empty chunks', () => {
      const chunks = chunkText('   \n\n   Hello   \n\n   World   ', 1000, 0);
      expect(chunks.every(c => c.length > 0)).toBe(true);
    });

    it('handles text with sentence boundaries', () => {
      const chunks = chunkText('First sentence. Second sentence. Third sentence. Fourth sentence.', 30, 0);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── retrieveRelevant ──

  describe('retrieveRelevant', () => {
    const mockDocs: KnowledgeDocument[] = [
      {
        id: '1', name: 'SEO Guide', content: 'SEO best practices',
        chunks: ['SEO is about search engine optimization', 'Keyword research is important'],
        source: 'upload', createdAt: Date.now(), tags: ['seo'],
      },
      {
        id: '2', name: 'PPC Guide', content: 'Pay per click strategies',
        chunks: ['Google Ads campaigns', 'Meta Ads retargeting'],
        source: 'upload', createdAt: Date.now(), tags: ['ads'],
      },
    ];

    it('returns empty for empty query', async () => {
      expect(await retrieveRelevant('', mockDocs)).toEqual([]);
    });

    it('returns empty for no documents', async () => {
      expect(await retrieveRelevant('SEO', [])).toEqual([]);
    });

    it('returns relevant chunks for matching query', async () => {
      const results = await retrieveRelevant('search engine optimization', mockDocs, 2);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]).toContain('SEO');
    });

    it('returns top K results', async () => {
      const results = await retrieveRelevant('marketing', mockDocs, 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('ranks more relevant chunks higher', async () => {
      const results = await retrieveRelevant('keyword research SEO', mockDocs, 3);
      expect(results.some(r => r.includes('Keyword research'))).toBe(true);
    });
  });

  describe('retrieveRelevant (semantic search path)', () => {
    const mockDocs: KnowledgeDocument[] = [
      {
        id: '1', name: 'SEO Guide', content: 'SEO best practices',
        chunks: ['SEO is about search engine optimization', 'Keyword research is important'],
        source: 'upload', createdAt: Date.now(), tags: ['seo'],
      },
    ];

    it('uses semantic search when available and returns results', async () => {
      vi.mocked(embeddingsModule.isSemanticSearchAvailable).mockReturnValue(true);
      vi.mocked(embeddingsModule.semanticSearch).mockResolvedValue([
        { chunkId: '1', documentId: '1', content: 'SEO is about search engine optimization', similarity: 0.85, chunkIndex: 0 },
      ]);

      const results = await retrieveRelevant('search engine', mockDocs, 3);
      expect(results).toEqual(['SEO is about search engine optimization']);
      expect(embeddingsModule.semanticSearch).toHaveBeenCalled();

      // Reset to default
      vi.mocked(embeddingsModule.isSemanticSearchAvailable).mockReturnValue(false);
      vi.mocked(embeddingsModule.semanticSearch).mockResolvedValue([]);
    });

    it('falls back to TF-IDF when semantic search returns empty', async () => {
      vi.mocked(embeddingsModule.isSemanticSearchAvailable).mockReturnValue(true);
      vi.mocked(embeddingsModule.semanticSearch).mockResolvedValue([]);

      const results = await retrieveRelevant('search engine optimization', mockDocs, 3);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]).toContain('SEO');

      // Reset to default
      vi.mocked(embeddingsModule.isSemanticSearchAvailable).mockReturnValue(false);
      vi.mocked(embeddingsModule.semanticSearch).mockResolvedValue([]);
    });

    it('falls back to TF-IDF when semantic search throws', async () => {
      vi.mocked(embeddingsModule.isSemanticSearchAvailable).mockReturnValue(true);
      vi.mocked(embeddingsModule.semanticSearch).mockRejectedValue(new Error('API error'));

      const results = await retrieveRelevant('search engine optimization', mockDocs, 3);
      expect(results.length).toBeGreaterThanOrEqual(1);

      // Reset to default
      vi.mocked(embeddingsModule.isSemanticSearchAvailable).mockReturnValue(false);
      vi.mocked(embeddingsModule.semanticSearch).mockResolvedValue([]);
    });
  });

  describe('retrieveRelevantTfIdf', () => {
    const mockDocs: KnowledgeDocument[] = [
      {
        id: '1', name: 'SEO Guide', content: 'SEO best practices',
        chunks: ['SEO is about search engine optimization', 'Keyword research is important'],
        source: 'upload', createdAt: Date.now(), tags: ['seo'],
      },
      {
        id: '2', name: 'PPC Guide', content: 'Pay per click strategies',
        chunks: ['Google Ads campaigns', 'Meta Ads retargeting'],
        source: 'upload', createdAt: Date.now(), tags: ['ads'],
      },
    ];

    it('returns empty for empty query', () => {
      expect(retrieveRelevantTfIdf('', mockDocs)).toEqual([]);
    });

    it('returns empty for no documents', () => {
      expect(retrieveRelevantTfIdf('SEO', [])).toEqual([]);
    });

    it('returns relevant chunks for matching query', () => {
      const results = retrieveRelevantTfIdf('search engine optimization', mockDocs, 2);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]).toContain('SEO');
    });

    it('returns top K results', () => {
      const results = retrieveRelevantTfIdf('marketing', mockDocs, 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('ranks more relevant chunks higher', () => {
      const results = retrieveRelevantTfIdf('keyword research SEO', mockDocs, 3);
      expect(results.some(r => r.includes('Keyword research'))).toBe(true);
    });
  });

  // ── buildRagContext ──

  describe('buildRagContext', () => {
    it('returns empty string for empty chunks', () => {
      expect(buildRagContext([])).toBe('');
    });

    it('builds context from chunks', () => {
      const result = buildRagContext(['Chunk 1', 'Chunk 2']);
      expect(result).toContain('RELEVANT DOCUMENT CONTEXT');
      expect(result).toContain('Chunk 1');
    });

    it('respects maxChars limit', () => {
      const result = buildRagContext(['A'.repeat(500), 'B'.repeat(500), 'C'.repeat(500)], 600);
      expect(result.length).toBeLessThanOrEqual(700);
    });
  });

  // ── buildContext ──

  describe('buildContext', () => {
    it('returns empty string for empty inputs', () => {
      expect(buildContext([], [], [])).toBe('');
    });

    it('includes document chunks', () => {
      const result = buildContext(['doc chunk'], [], []);
      expect(result).toContain('Relevant Knowledge Base Documents');
    });

    it('includes search results', () => {
      const result = buildContext([], [{ title: 'R1', url: 'https://example.com', snippet: 'S1' }], []);
      expect(result).toContain('Web Search Results');
      expect(result).toContain('https://example.com');
    });

    it('includes memory items', () => {
      const memory: MemoryItem[] = [
        { id: '1', content: 'Client prefers formal tone', category: 'preference', importance: 2, createdAt: Date.now() },
      ];
      const result = buildContext([], [], memory);
      expect(result).toContain('Client prefers formal tone');
    });

    it('combines all sources', () => {
      const result = buildContext(
        ['doc chunk'],
        [{ title: 'Web', url: 'https://example.com', snippet: 'snippet' }],
        [{ id: '1', content: 'memory', category: 'fact', importance: 1, createdAt: Date.now() }]
      );
      expect(result).toContain('Relevant Knowledge Base Documents');
      expect(result).toContain('Web Search Results');
      expect(result).toContain('Client Memory');
    });
  });

  // ── processDocument (XLSX) ──

  describe('processDocument with XLSX', () => {
    it('processes a single sheet', async () => {
      mockSheetMap = { 'Sheet1': [['Name', 'Value'], ['Row1', '100'], ['Row2', '200']] };
      const result = await processDocument(makeFile('test.xlsx'));

      expect(result.name).toBe('test.xlsx');
      expect(result.content).toContain('[Sheet: Sheet1]');
      expect(result.content).toContain('Name,Value');
      expect(result.content).toContain('Row1,100');
      expect(result.tags).toContain('xlsx');
    });

    it('processes multiple sheets', async () => {
      mockSheetMap = {
        'Data': [['Col1', 'Col2'], ['A', '1']],
        'Summary': [['Metric', 'Score'], ['Quality', '95']],
      };
      const result = await processDocument(makeFile('multi.xlsx'));

      expect(result.content).toContain('[Sheet: Data]');
      expect(result.content).toContain('[Sheet: Summary]');
    });

    it('processes xls files via same path', async () => {
      mockSheetMap = { 'Sheet1': [['Header', 'Data'], ['Val1', 'Val2']] };
      const result = await processDocument(makeFile('legacy.xls'));

      expect(result.name).toBe('legacy.xls');
      expect(result.content).toContain('Header,Data');
      expect(result.tags).toContain('xls');
    });

    it('returns error message on load failure', async () => {
      shouldLoadFail = true;
      const result = await processDocument(makeFile('bad.xlsx'));
      expect(result.content).toContain('[XLSX processing failed');
    });

    it('handles null and undefined cell values', async () => {
      mockSheetMap = { 'Sheet1': [['A', null, undefined, 'E']] };
      const result = await processDocument(makeFile('sparse.xlsx'));

      expect(result.content).toContain('A,,,E');
    });

    it('handles formula cells with result property', async () => {
      mockSheetMap = { 'Sheet1': [[{ result: 42 }, 'plain']] };
      const result = await processDocument(makeFile('formulas.xlsx'));

      expect(result.content).toContain('42');
      expect(result.content).toContain('plain');
    });
  });

  // ── processDocument (txt) ──

  describe('processDocument with txt', () => {
    it('processes txt files', async () => {
      const file = new File(['Hello world'], 'notes.txt', { type: 'text/plain' });
      const result = await processDocument(file);

      expect(result.name).toBe('notes.txt');
      expect(result.content).toBe('Hello world');
      expect(result.tags).toContain('txt');
    });
  });

  // ── processDocument (image) ──

  describe('processDocument with images', () => {
    it('returns placeholder for image files', async () => {
      const result = await processDocument(new File([''], 'photo.png', { type: 'image/png' }));
      expect(result.content).toContain('[Image: photo.png]');
      expect(result.content).toContain('Claude Vision API');
    });
  });

  // ── processDocument (unknown) ──

  describe('processDocument with unknown extension', () => {
    it('reads as text for unknown extensions', async () => {
      const result = await processDocument(new File(['some content'], 'data.xyz', { type: 'application/octet-stream' }));
      expect(result.content).toBe('some content');
    });
  });
});
