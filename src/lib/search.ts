// ═══════════════════════════════════════
// ORACLE — Web Search Formatting
// search.ts — only formats results for AI context
// Direct provider calls removed: use /api/web-search proxy instead
// ═══════════════════════════════════════

import type { SearchResult } from '@/types';

// ─── Format Results for AI Context ─────

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return '';

  const header = 'WEB SEARCH RESULTS:\n';
  const items = results.map((r, i) => {
    const parts = [`[${i + 1}] ${r.title}`];
    if (r.url) parts.push(`URL: ${r.url}`);
    if (r.snippet) parts.push(`Snippet: ${r.snippet}`);
    if (r.publishedDate) parts.push(`Published: ${r.publishedDate}`);
    return parts.join('\n');
  });

  return header + items.join('\n\n');
}
