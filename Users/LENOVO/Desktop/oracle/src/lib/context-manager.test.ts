import { describe, it, expect, vi } from 'vitest';
import {
  calculateMessageTokens,
  buildOptimizedContext,
  type ContextMessage,
} from './context-manager';

vi.mock('@/lib/utils', () => ({
  estimateTokens: (text: string) => Math.ceil(text.length / 4),
}));

function makeMsg(content: string, role: 'user' | 'assistant' = 'user', ts = Date.now()): ContextMessage {
  return { id: `msg-${Math.random()}`, role, content, timestamp: ts };
}

describe('calculateMessageTokens', () => {
  it('returns 0 for empty array', () => {
    expect(calculateMessageTokens([])).toBe(0);
  });

  it('estimates tokens from content length', () => {
    const msgs = [makeMsg('hello world')]; // 11 chars → ceil(11/4) = 3
    expect(calculateMessageTokens(msgs)).toBe(3);
  });

  it('sums tokens across multiple messages', () => {
    const msgs = [
      makeMsg('abcd'),  // 4 chars → 1
      makeMsg('efghij'), // 6 chars → 2
    ];
    expect(calculateMessageTokens(msgs)).toBe(3);
  });
});

describe('buildOptimizedContext', () => {
  it('returns all messages when within token budget', () => {
    const msgs = [makeMsg('short'), makeMsg('also short')];
    const result = buildOptimizedContext(msgs, { maxTokens: 10000 });
    expect(result.wasSummarized).toBe(false);
    expect(result.summarizedCount).toBe(0);
    expect(result.messages.length).toBe(2);
  });

  it('returns all messages when few messages exist', () => {
    const msgs = Array.from({ length: 5 }, (_, i) => makeMsg(`message ${i}`));
    const result = buildOptimizedContext(msgs, { maxTokens: 1, recentMessageCount: 10 });
    // 5 messages < recentMessageCount * 2 (20), so no summarization
    expect(result.wasSummarized).toBe(false);
    expect(result.messages.length).toBe(5);
  });

  it('summarizes old messages when over budget', () => {
    // Create 30 messages with short content to stay under maxTokens
    // but enough messages to trigger summarization (recentMessageCount * 2 = 20)
    const msgs = Array.from({ length: 30 }, (_, i) =>
      makeMsg(`message content ${i}`, i % 2 === 0 ? 'user' : 'assistant', Date.now() + i)
    );
    const result = buildOptimizedContext(msgs, {
      maxTokens: 5, // Very low to force summarization
      recentMessageCount: 5,
      summaryMaxTokens: 100,
    });
    expect(result.wasSummarized).toBe(true);
    expect(result.summarizedCount).toBe(20);
    // First message should be a system summary
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[0].content).toContain('Conversation Summary');
    expect(result.messages[0].content).toContain('20 earlier messages');
    // Should have 10 recent messages after the summary
    expect(result.messages.length).toBe(11); // 1 summary + 10 recent
  });

  it('includes summary metadata', () => {
    const msgs = Array.from({ length: 30 }, (_, i) =>
      makeMsg(`msg ${i}`, i % 2 === 0 ? 'user' : 'assistant', Date.now() + i * 1000)
    );
    const result = buildOptimizedContext(msgs, {
      maxTokens: 5,
      recentMessageCount: 5,
      summaryMaxTokens: 100,
    });
    const summaryContent = result.messages[0].content;
    expect(summaryContent).toContain('Total earlier messages: 20');
    expect(summaryContent).toContain('User requests:');
  });

  it('preserves role of recent messages', () => {
    const msgs = Array.from({ length: 30 }, (_, i) =>
      makeMsg(`msg ${i}`, i % 2 === 0 ? 'user' : 'assistant', Date.now() + i * 1000)
    );
    const result = buildOptimizedContext(msgs, {
      maxTokens: 5,
      recentMessageCount: 5,
      summaryMaxTokens: 100,
    });
    // Check that recent messages have roles
    const recentMsgs = result.messages.slice(1);
    for (const m of recentMsgs) {
      expect(['user', 'assistant']).toContain(m.role);
    }
  });

  it('uses default config when none provided', () => {
    const msgs = [makeMsg('hello')];
    const result = buildOptimizedContext(msgs);
    expect(result.wasSummarized).toBe(false);
  });

  it('handles all assistant messages in summary', () => {
    const msgs = Array.from({ length: 30 }, (_, i) =>
      makeMsg(`assistant msg ${i}`, 'assistant', Date.now() + i * 1000)
    );
    const result = buildOptimizedContext(msgs, {
      maxTokens: 5,
      recentMessageCount: 5,
      summaryMaxTokens: 200,
    });
    expect(result.wasSummarized).toBe(true);
    expect(result.messages[0].content).toContain('Key responses:');
  });

  it('handles all user messages in summary', () => {
    const msgs = Array.from({ length: 30 }, (_, i) =>
      makeMsg(`user msg ${i}`, 'user', Date.now() + i * 1000)
    );
    const result = buildOptimizedContext(msgs, {
      maxTokens: 5,
      recentMessageCount: 5,
      summaryMaxTokens: 200,
    });
    expect(result.wasSummarized).toBe(true);
    expect(result.messages[0].content).toContain('User requests:');
  });

  it('truncates summary when exceeding maxTokens', () => {
    const msgs = Array.from({ length: 30 }, (_, i) =>
      makeMsg('x'.repeat(500), i % 2 === 0 ? 'user' : 'assistant', Date.now() + i * 1000)
    );
    const result = buildOptimizedContext(msgs, {
      maxTokens: 5,
      recentMessageCount: 5,
      summaryMaxTokens: 2, // Very small → maxChars = 8 for the summary part
    });
    expect(result.wasSummarized).toBe(true);
    const summary = result.messages[0].content;
    // The summary portion (after header) should be truncated with ...
    // Header is ~45 chars; summary is truncated to maxChars (8) + '...'
    expect(summary).toContain('...');
    expect(summary).toContain('Conversation Summary');
  });
});
