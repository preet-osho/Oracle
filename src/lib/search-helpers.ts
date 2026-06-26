// ═══════════════════════════════════════
// ORACLE — Chat History Search
// Search across past conversations · Fuzzy matching · Relevance ranking
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────

export interface SearchResult {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  snippet: string;
  score: number;
  timestamp: number;
  agentType?: string;
}

export interface SearchOptions {
  maxResults?: number;
  role?: 'user' | 'assistant';
  dateFrom?: number;
  dateTo?: number;
}

// ─── Core Search ───────────────────────

export function searchConversations(
  conversations: Array<{
    id: string;
    title: string;
    agentType: string;
    messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: number;
    }>;
  }>,
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  const { maxResults = 20, role, dateFrom, dateTo } = options;
  if (!query.trim()) return [];

  const queryLower = query.toLowerCase();
  const queryTokens = tokenizeSearch(queryLower);
  const results: SearchResult[] = [];

  for (const convo of conversations) {
    for (const msg of convo.messages) {
      // Filter by role
      if (role && msg.role !== role) continue;
      // Filter by date
      if (dateFrom && msg.timestamp < dateFrom) continue;
      if (dateTo && msg.timestamp > dateTo) continue;

      const contentLower = msg.content.toLowerCase();
      const tokens = tokenizeSearch(contentLower);

      // Calculate relevance score
      let score = 0;

      // Exact substring match (highest weight)
      if (contentLower.includes(queryLower)) {
        score += 50;
        // Bonus for match at start
        if (contentLower.startsWith(queryLower)) score += 20;
      }

      // Token overlap
      let tokenMatches = 0;
      for (const qt of queryTokens) {
        if (tokens.some((t) => t.includes(qt) || qt.includes(t))) {
          tokenMatches++;
        }
      }
      if (queryTokens.length > 0) {
        score += (tokenMatches / queryTokens.length) * 30;
      }

      // Position bonus (earlier matches score higher)
      const firstMatchIdx = contentLower.indexOf(queryLower);
      if (firstMatchIdx >= 0 && firstMatchIdx < 100) {
        score += 10;
      }

      if (score > 0) {
        // Generate snippet with context
        const snippet = extractSnippet(msg.content, queryLower);
        results.push({
          conversationId: convo.id,
          conversationTitle: convo.title,
          messageId: msg.id,
          role: msg.role,
          content: msg.content,
          snippet,
          score,
          timestamp: msg.timestamp,
          agentType: convo.agentType,
        });
      }
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

// ─── Helpers ───────────────────────────

function tokenizeSearch(text: string): string[] {
  return text
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function extractSnippet(content: string, query: string, contextChars: number = 80): string {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(query);
  if (idx === -1) {
    return content.slice(0, 160) + (content.length > 160 ? '...' : '');
  }
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(content.length, idx + query.length + contextChars);
  let snippet = content.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  return snippet;
}

export function highlightMatches(text: string, query: string): string {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '**$1**');
}
