// ═══════════════════════════════════════
// ORACLE — RAG (Retrieval-Augmented Generation)
// Semantic Search (OpenAI embeddings + pgvector) · TF-IDF Fallback · Document Processing · Web Search
// ═══════════════════════════════════════

import type { KnowledgeDocument, SearchResult, MemoryItem } from '@/types';
import { nanoid } from 'nanoid';
import { fetchWithTimeout, TIMEOUT_MODERATE_MS } from '@/lib/fetch-utils';
import {
  semanticSearch,
  storeEmbeddings,
  deleteEmbeddings,
  isSemanticSearchAvailable,
  type EmbeddingResult,
} from '@/lib/embeddings';
import { createLogger } from '@/lib/logger';

const log = createLogger('RAG');

// ─── Document Processing ───────────────

export async function processDocument(file: File): Promise<KnowledgeDocument> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  let content = '';

  switch (ext) {
    case 'txt':
    case 'md':
    case 'csv':
    case 'json':
      content = await file.text();
      break;

    case 'pdf':
      content = await processPDF(file);
      break;

    case 'docx':
      content = await processDOCX(file);
      break;

    case 'xlsx':
    case 'xls':
      content = await processXLSX(file);
      break;

    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'webp':
      content = `[Image: ${file.name}] — Image text extraction requires Claude Vision API. Upload as attachment for AI analysis.`;
      break;

    default:
      content = await file.text().catch(() => `[Unsupported file type: ${ext}]`);
  }

  const chunks = chunkText(content);

  return {
    id: nanoid(),
    name: file.name,
    content,
    chunks,
    source: 'upload',
    createdAt: Date.now(),
    tags: [ext],
  };
}

// ─── PDF Processing ────────────────────

async function processPDF(file: File): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    const pdfjs = pdfjsLib.default || pdfjsLib;

    // Set worker source
    if (typeof window !== 'undefined') {
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      textParts.push(`[Page ${i}]\n${pageText}`);
    }

    return textParts.join('\n\n');
  } catch (error) {
    return `[PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}]`;
  }
}

// ─── DOCX Processing ───────────────────

async function processDOCX(file: File): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    return `[DOCX processing failed: ${error instanceof Error ? error.message : 'Unknown error'}]`;
  }
}

// ─── XLSX Processing ───────────────────

async function processXLSX(file: File): Promise<string> {
  try {
    const ExcelJS = await import('exceljs');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const textParts: string[] = [];

    workbook.eachSheet((sheet) => {
      const rows: string[] = [];
      sheet.eachRow((row) => {
        const rawValues: unknown[] = Array.isArray(row.values) ? row.values.slice(1) : [];
        const values = rawValues.map((cell) => {
          if (cell === null || cell === undefined) return '';
          if (typeof cell === 'object' && 'result' in (cell as Record<string, unknown>)) return String((cell as Record<string, unknown>).result ?? '');
          return String(cell);
        });
        rows.push(values.join(','));
      });
      textParts.push(`[Sheet: ${sheet.name}]\n${rows.join('\n')}`);
    });

    return textParts.join('\n\n');
  } catch (error) {
    return `[XLSX processing failed: ${error instanceof Error ? error.message : 'Unknown error'}]`;
  }
}

// ─── Text Chunking ─────────────────────

export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  if (!text || text.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunkEnd = end;

    // Try to break at a sentence or paragraph boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > start + chunkSize * 0.5) {
        chunkEnd = breakPoint + 1;
      }
    }

    chunks.push(text.slice(start, chunkEnd).trim());
    start = chunkEnd - overlap;

    // Break if we've consumed all text, can't make progress, or start is invalid
    if (start >= text.length || start < 0 || chunkEnd >= text.length) break;
  }

  return chunks.filter((c) => c.length > 0);
}

// ═══════════════════════════════════════
// SEMANTIC SEARCH (primary) + TF-IDF (fallback)
// ═══════════════════════════════════════

/**
 * Store document embeddings in pgvector after processing.
 * Call this after processDocument to enable semantic search for the document.
 */
export async function indexDocument(document: KnowledgeDocument): Promise<void> {
  if (!isSemanticSearchAvailable()) return;
  if (document.chunks.length === 0) return;

  try {
    const stored = await storeEmbeddings({
      documentId: document.id,
      chunks: document.chunks,
    });
    log.info('Document indexed for semantic search', {
      documentId: document.id,
      name: document.name,
      chunks: stored,
    });
  } catch (err) {
    log.error('Failed to index document for semantic search', {
      error: err instanceof Error ? err.message : 'Unknown',
      documentId: document.id,
    });
  }
}

/**
 * Remove document embeddings from pgvector.
 * Call this when a document is deleted.
 */
export async function unindexDocument(documentId: string): Promise<void> {
  if (!isSemanticSearchAvailable()) return;

  try {
    await deleteEmbeddings(documentId);
  } catch (err) {
    log.error('Failed to unindex document', {
      error: err instanceof Error ? err.message : 'Unknown',
      documentId,
    });
  }
}

/**
 * Retrieve relevant chunks using semantic search (primary) with TF-IDF fallback.
 *
 * Strategy:
 * 1. If semantic search is available → use pgvector cosine similarity
 * 2. If no results from semantic search or not available → fall back to TF-IDF
 */
export async function retrieveRelevant(
  query: string,
  documents: KnowledgeDocument[],
  topK: number = 3
): Promise<string[]> {
  if (!query || documents.length === 0) return [];

  // ── Strategy 1: Semantic Search (if available) ──
  if (isSemanticSearchAvailable()) {
    try {
      const documentIds = documents.map((d) => d.id);
      const results: EmbeddingResult[] = await semanticSearch(query, {
        matchCount: topK,
        documentIds,
      });

      if (results.length > 0) {
        log.debug('Semantic search returned results', {
          count: results.length,
          topSimilarity: results[0]?.similarity?.toFixed(3),
        });
        return results.map((r) => r.content);
      }
    } catch (err) {
      log.warn('Semantic search failed, falling back to TF-IDF', {
        error: err instanceof Error ? err.message : 'Unknown',
      });
    }
  }

  // ── Strategy 2: TF-IDF Fallback ──
  return retrieveRelevantTfIdf(query, documents, topK);
}

/**
 * Synchronous TF-IDF retrieval (original implementation).
 * Used as fallback when semantic search is unavailable or returns no results.
 */
export function retrieveRelevantTfIdf(
  query: string,
  documents: KnowledgeDocument[],
  topK: number = 3
): string[] {
  if (!query || documents.length === 0) return [];

  const queryTokens = tokenize(query);
  const scoredChunks: Array<{ chunk: string; score: number }> = [];

  for (const doc of documents) {
    for (const chunk of doc.chunks) {
      const chunkTokens = tokenize(chunk);
      const score = computeScore(queryTokens, chunkTokens);
      if (score > 0) {
        scoredChunks.push({ chunk, score });
      }
    }
  }

  // Sort by score descending, take top K
  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.slice(0, topK).map((sc) => sc.chunk);
}

// ─── Tokenizer ─────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

// ─── Score Calculator ──────────────────

function computeScore(queryTokens: string[], chunkTokens: string[]): number {
  if (queryTokens.length === 0 || chunkTokens.length === 0) return 0;

  const chunkFreq = new Map<string, number>();
  for (const token of chunkTokens) {
    chunkFreq.set(token, (chunkFreq.get(token) || 0) + 1);
  }

  let score = 0;
  for (const token of queryTokens) {
    const freq = chunkFreq.get(token) || 0;
    if (freq > 0) {
      // TF component
      const tf = freq / chunkTokens.length;
      // Bonus for exact match
      score += tf + 0.1;
    }
  }

  // Normalize by query length
  return score / queryTokens.length;
}

// ─── Web Search ────────────────────────

export async function webSearch(
  query: string,
  tavilyKey?: string,
  serperKey?: string
): Promise<SearchResult[]> {
  // Try Tavily first (free 1000/month)
  if (tavilyKey) {
    try {
      const response = await fetchWithTimeout('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          max_results: 5,
          include_answer: false,
        }),
        timeoutMs: TIMEOUT_MODERATE_MS,
      });

      if (response.ok) {
        const data = await response.json();
        return (data.results || []).map((r: Record<string, string>) => ({
          title: r.title || '',
          url: r.url || '',
          snippet: r.content || '',
          publishedDate: r.published_date || undefined,
        }));
      }
    } catch (e) {
      console.warn('[RAG] Tavily search failed, falling through:', e);
    }
  }

  // Try Serper (free 2500/month)
  if (serperKey) {
    try {
      const response = await fetchWithTimeout('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': serperKey,
        },
        body: JSON.stringify({
          q: query,
          num: 5,
        }),
        timeoutMs: TIMEOUT_MODERATE_MS,
      });

      if (response.ok) {
        const data = await response.json();
        return (data.organic || []).map((r: Record<string, string>) => ({
          title: r.title || '',
          url: r.link || '',
          snippet: r.snippet || '',
          publishedDate: r.date || undefined,
        }));
      }
    } catch (e) {
      console.warn('[RAG] Serper search failed, falling through:', e);
    }
  }

  // No API keys available — return empty gracefully
  return [];
}

// ─── RAG Context Builder (alias) ──────

export function buildRagContext(chunks: string[], maxChars: number = 3000): string {
  if (chunks.length === 0) return '';

  let result = 'RELEVANT DOCUMENT CONTEXT:\n';
  let currentLength = result.length;

  for (const chunk of chunks) {
    if (currentLength + chunk.length + 10 > maxChars) break;
    result += chunk + '\n---\n';
    currentLength += chunk.length + 10;
  }

  return result.trim();
}

// ─── Process File (alias for processDocument) ──

export async function processFile(file: File): Promise<KnowledgeDocument> {
  return processDocument(file);
}

// ─── Context Builder ───────────────────

export function buildContext(
  relevantChunks: string[],
  searchResults: SearchResult[],
  memory: MemoryItem[]
): string {
  const parts: string[] = [];

  if (relevantChunks.length > 0) {
    parts.push('## Relevant Knowledge Base Documents');
    relevantChunks.forEach((chunk, i) => {
      parts.push(`[Document ${i + 1}]\n${chunk}`);
    });
  }

  if (searchResults.length > 0) {
    parts.push('## Web Search Results');
    searchResults.forEach((result, i) => {
      parts.push(`[${i + 1}] ${result.title}\n${result.url}\n${result.snippet}`);
    });
  }

  if (memory.length > 0) {
    parts.push('## Client Memory');
    memory.forEach((item) => {
      const categoryLabel = item.category.charAt(0).toUpperCase() + item.category.slice(1);
      parts.push(`- [${categoryLabel}] ${item.content}`);
    });
  }

  if (parts.length === 0) return '';

  return parts.join('\n\n');
}
