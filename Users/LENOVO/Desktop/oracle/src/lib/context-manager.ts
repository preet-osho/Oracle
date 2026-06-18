// ═══════════════════════════════════════
// ORACLE — Context Window Manager
// Summarize old messages to save tokens when context is long
// ═══════════════════════════════════════

import { estimateTokens } from '@/lib/utils';

// ─── Types ─────────────────────────────

export interface ContextMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ContextWindowConfig {
  /** Maximum tokens allowed in context before summarization kicks in */
  maxTokens: number;
  /** Number of recent messages to keep intact (never summarized) */
  recentMessageCount: number;
  /** Maximum tokens for the summary itself */
  summaryMaxTokens: number;
}

export interface ManagedContext {
  /** The messages to send to the API (summary + recent messages) */
  messages: Array<{ role: string; content: string }>;
  /** Number of messages summarized */
  summarizedCount: number;
  /** Total tokens in the managed context */
  totalTokens: number;
  /** Whether summarization was applied */
  wasSummarized: boolean;
}

// ─── Defaults ──────────────────────────

const DEFAULT_CONFIG: ContextWindowConfig = {
  maxTokens: 8000,
  recentMessageCount: 10,
  summaryMaxTokens: 500,
};

// ─── Core Functions ────────────────────

/**
 * Calculate total tokens in a set of messages
 */
export function calculateMessageTokens(messages: ContextMessage[]): number {
  return messages.reduce((total, msg) => total + estimateTokens(msg.content), 0);
}

/**
 * Build an optimized context by summarizing old messages and keeping recent ones intact.
 * Returns the messages to send, with older messages collapsed into a summary.
 */
export function buildOptimizedContext(
  messages: ContextMessage[],
  config: Partial<ContextWindowConfig> = {}
): ManagedContext {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const totalTokens = calculateMessageTokens(messages);

  // If within budget, return all messages as-is
  if (totalTokens <= cfg.maxTokens || messages.length <= cfg.recentMessageCount * 2) {
    return {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      summarizedCount: 0,
      totalTokens,
      wasSummarized: false,
    };
  }

  // Split into old messages (to summarize) and recent messages (to keep)
  const recentMessages = messages.slice(-cfg.recentMessageCount * 2);
  const oldMessages = messages.slice(0, -cfg.recentMessageCount * 2);

  if (oldMessages.length === 0) {
    return {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      summarizedCount: 0,
      totalTokens,
      wasSummarized: false,
    };
  }

  // Build a deterministic summary of old messages
  const summary = generateContextSummary(oldMessages, cfg.summaryMaxTokens);

  // Build final context: summary + recent messages
  const managedMessages: Array<{ role: string; content: string }> = [
    { role: 'system', content: `[Conversation Summary — ${oldMessages.length} earlier messages]\n${summary}` },
    ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  return {
    messages: managedMessages,
    summarizedCount: oldMessages.length,
    totalTokens: estimateTokens(summary) + calculateMessageTokens(recentMessages),
    wasSummarized: true,
  };
}

/**
 * Generate a deterministic summary of old messages (no AI call needed).
 * Extracts key topics, decisions, and context from the conversation.
 */
function generateContextSummary(messages: ContextMessage[], maxTokens: number): string {
  const parts: string[] = [];

  // Extract key user requests
  const userMessages = messages.filter((m) => m.role === 'user');
  const assistantMessages = messages.filter((m) => m.role === 'assistant');

  // Collect key topics from user messages (first 100 chars each)
  if (userMessages.length > 0) {
    const topics = userMessages.slice(-5).map((m) => {
      const preview = m.content.slice(0, 120).replace(/\n/g, ' ');
      return preview.length < m.content.length ? preview + '...' : preview;
    });
    parts.push(`User requests: ${topics.join(' | ')}`);
  }

  // Collect key points from assistant responses (first 100 chars each)
  if (assistantMessages.length > 0) {
    const keyPoints = assistantMessages.slice(-3).map((m) => {
      const preview = m.content.slice(0, 120).replace(/\n/g, ' ');
      return preview.length < m.content.length ? preview + '...' : preview;
    });
    parts.push(`Key responses: ${keyPoints.join(' | ')}`);
  }

  // Add metadata
  const timeRange = messages.length > 0
    ? `${new Date(messages[0].timestamp).toLocaleString()} → ${new Date(messages[messages.length - 1].timestamp).toLocaleString()}`
    : '';
  if (timeRange) {
    parts.push(`Time range: ${timeRange}`);
  }
  parts.push(`Total earlier messages: ${messages.length}`);

  const summary = parts.join('\n');

  // Truncate to max tokens
  const maxChars = maxTokens * 4;
  if (summary.length > maxChars) {
    return summary.slice(0, maxChars - 3) + '...';
  }
  return summary;
}


