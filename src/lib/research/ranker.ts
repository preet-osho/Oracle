// ═══════════════════════════════════════
// ORACLE — Cross-Source Result Ranker
// Deduplication · URL normalization · Relevance scoring
// ═══════════════════════════════════════

import type { RankedResult } from './types';

// ─── Main Ranking Function ────────────

/**
 * Rank and deduplicate results from multiple search providers.
 *
 * Steps:
 * 1. Normalize URLs for dedup detection
 * 2. Merge duplicates (keep highest score, track sources)
 * 3. Boost results that appear across multiple sources
 * 4. Apply query-term relevance boost
 * 5. Sort by final score and return top N
 */
export function rankAndDeduplicate(
  results: RankedResult[],
  query: string,
  maxResults: number = 15,
): RankedResult[] {
  if (results.length === 0) return [];

  // Step 1: Group by normalized URL
  const urlGroups = groupByNormalizedUrl(results);

  // Step 2: Merge duplicates and boost cross-source results
  const merged = mergeGroups(urlGroups, query);

  // Step 3: Sort by score descending
  merged.sort((a, b) => b.score - a.score);

  // Step 4: Return top N
  return merged.slice(0, maxResults);
}

// ─── URL Normalization ────────────────

/**
 * Normalize a URL for deduplication.
 * Strips trailing slashes, www prefix, fragments, and query params.
 */
export function normalizeSearchUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Lowercase host
    let host = parsed.hostname.toLowerCase();

    // Strip www.
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }

    // Strip trailing slash from pathname
    let pathname = parsed.pathname || '/';
    if (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }

    // Rebuild without search params or hash
    return pathname === '/' ? host : `${host}${pathname!}`;
  } catch {
    // If URL parsing fails, do basic normalization
    return url
      .toLowerCase()
      .replace(/^https?:\/\/(www\.)?/, '')
      .replace(/\/+$/, '')
      .split('?')[0]!
      .split('#')[0]!;
  }
}

// ─── URL Grouping ─────────────────────

function groupByNormalizedUrl(results: RankedResult[]): Map<string, RankedResult[]> {
  const groups = new Map<string, RankedResult[]>();

  for (const result of results) {
    const normalized = normalizeSearchUrl(result.url);
    const existing = groups.get(normalized);
    if (existing) {
      existing.push(result);
    } else {
      groups.set(normalized, [result]);
    }
  }

  return groups;
}

// ─── Group Merging ────────────────────

function mergeGroups(
  groups: Map<string, RankedResult[]>,
  query: string,
): RankedResult[] {
  const merged: RankedResult[] = [];
  const queryTerms = extractQueryTerms(query);

  for (const [, group] of groups) {
    if (group.length === 1) {
      // Single result — apply relevance boost and keep
      const result = { ...group[0]! };
      result.score = applyRelevanceBoost(result.score, result, queryTerms);
      merged.push(result);
    } else {
      // Multiple results for the same URL — merge
      const best = mergeGroup(group, queryTerms);
      merged.push(best);
    }
  }

  return merged;
}

/**
 * Merge a group of duplicate results into one.
 * Keeps the best title/snippet, boosts score for cross-source presence.
 */
function mergeGroup(group: RankedResult[], queryTerms: string[]): RankedResult {
  // Sort by score to find the best base result (copy to avoid mutating input)
  const sorted = [...group].sort((a, b) => b.score - a.score);
  const best = sorted[0]!;

  // Collect all unique sources
  const sources = [...new Set(group.map((r) => r.source))];

  // Cross-source boost: +15 per additional source (max +30)
  const crossSourceBoost = Math.min((sources.length - 1) * 15, 30);

  // Use the longest snippet (most information)
  const longestSnippet = sorted.reduce((acc, r) =>
    r.snippet.length > acc.snippet.length ? r : acc,
  );

  // Use the best title (longest is usually most descriptive)
  const bestTitle = sorted.reduce((acc, r) =>
    r.title.length > acc.title.length ? r : acc,
  );

  // Use the most recent published date
  const mostRecent = sorted
    .filter((r) => r.publishedDate)
    .sort((a, b) => (b.publishedDate ?? '').localeCompare(a.publishedDate ?? ''))[0];

  const mergedScore = best.score + crossSourceBoost;

  const result: RankedResult = {
    title: bestTitle.title,
    url: best.url,
    snippet: longestSnippet.snippet,
    score: applyRelevanceBoost(mergedScore, best, queryTerms),
    source: sources.join('+'),
    publishedDate: mostRecent?.publishedDate || best.publishedDate,
    duplicateOf: group.length > 1 ? best.url : undefined,
  };
  return result;
}

// ─── Query Relevance Boost ────────────

function applyRelevanceBoost(
  baseScore: number,
  result: RankedResult,
  queryTerms: string[],
): number {
  if (queryTerms.length === 0) return baseScore;

  const titleLower = result.title.toLowerCase();
  const snippetLower = result.snippet.toLowerCase();
  const combined = `${titleLower} ${snippetLower}`;

  let matchCount = 0;
  let titleMatchCount = 0;

  for (const term of queryTerms) {
    if (combined.includes(term)) {
      matchCount++;
    }
    if (titleLower.includes(term)) {
      titleMatchCount++;
    }
  }

  // Boost for query term matches in snippet (up to +20)
  const termRatio = matchCount / queryTerms.length;
  const snippetBoost = termRatio * 20;

  // Extra boost for query term matches in title (up to +15)
  const titleRatio = titleMatchCount / queryTerms.length;
  const titleBoost = titleRatio * 15;

  return baseScore + snippetBoost + titleBoost;
}

// ─── Query Term Extraction ────────────

/**
 * Extract meaningful terms from a query string.
 * Removes common stop words and extracts individual words.
 */
function extractQueryTerms(query: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these',
    'those', 'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your',
    'he', 'she', 'they', 'them', 'what', 'which', 'who', 'whom', 'how',
    'when', 'where', 'why', 'not', 'no', 'nor', 'so', 'too', 'very',
  ]);

  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((term) => term.length > 1 && !stopWords.has(term));
}

// ─── Score Normalization ──────────────

/**
 * Normalize scores to a 0–100 scale across different providers.
 * Each provider uses different scoring systems, so we normalize
 * relative to the best result in the set.
 */
export function normalizeScores(results: RankedResult[]): RankedResult[] {
  if (results.length === 0) return [];

  const maxScore = Math.max(...results.map((r) => r.score));
  const minScore = Math.min(...results.map((r) => r.score));
  const range = maxScore - minScore;

  if (range === 0) {
    return results.map((r) => ({ ...r, score: 50 }));
  }

  return results.map((r) => ({
    ...r,
    score: Math.round(((r.score - minScore) / range) * 100),
  }));
}
