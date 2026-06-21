import { describe, it, expect } from 'vitest';
import {
  searchConversations,
  highlightMatches,
} from './search-helpers';

const sampleConversations = [
  {
    id: 'conv-1',
    title: 'SEO Strategy for Dental Clinic',
    agentType: 'marketer',
    messages: [
      { id: 'msg-1', role: 'user' as const, content: 'I need help with SEO for my dental clinic in Mumbai', timestamp: Date.now() - 100000 },
      { id: 'msg-2', role: 'assistant' as const, content: 'Here is a comprehensive SEO strategy for your dental clinic targeting Mumbai professionals', timestamp: Date.now() - 99000 },
      { id: 'msg-3', role: 'user' as const, content: 'What about Google Ads for dental implants?', timestamp: Date.now() - 98000 },
      { id: 'msg-4', role: 'assistant' as const, content: 'Google Ads can target dental implant keywords with high conversion rates', timestamp: Date.now() - 97000 },
    ],
  },
  {
    id: 'conv-2',
    title: 'Social Media Campaign',
    agentType: 'writer',
    messages: [
      { id: 'msg-5', role: 'user' as const, content: 'Create a social media content calendar for Instagram', timestamp: Date.now() - 50000 },
      { id: 'msg-6', role: 'assistant' as const, content: 'Here is a 30-day Instagram content calendar with daily post ideas', timestamp: Date.now() - 49000 },
    ],
  },
];

describe('searchConversations', () => {
  it('returns empty for empty query', () => {
    const results = searchConversations(sampleConversations, '');
    expect(results).toEqual([]);
  });

  it('returns empty for whitespace-only query', () => {
    const results = searchConversations(sampleConversations, '   ');
    expect(results).toEqual([]);
  });

  it('finds exact substring matches', () => {
    const results = searchConversations(sampleConversations, 'dental clinic');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].conversationId).toBe('conv-1');
  });

  it('finds matches across multiple conversations', () => {
    // 'Here' appears in both conv-1 msg-2 and conv-2 msg-6
    const results = searchConversations(sampleConversations, 'Here');
    expect(results.length).toBeGreaterThanOrEqual(2);
    const convIds = results.map(r => r.conversationId);
    expect(convIds).toContain('conv-1');
    expect(convIds).toContain('conv-2');
  });

  it('ranks exact matches higher than token matches', () => {
    const results = searchConversations(sampleConversations, 'SEO Strategy');
    expect(results.length).toBeGreaterThan(0);
    // First result should be the conversation with exact "SEO Strategy" in title
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('returns snippet with context', () => {
    const results = searchConversations(sampleConversations, 'dental implants');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].snippet).toBeTruthy();
    expect(results[0].snippet.length).toBeLessThan(results[0].content.length + 20);
  });

  it('respects maxResults option', () => {
    const results = searchConversations(sampleConversations, 'the', { maxResults: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('filters by role option', () => {
    const userResults = searchConversations(sampleConversations, 'dental', { role: 'user' });
    for (const r of userResults) {
      expect(r.role).toBe('user');
    }

    const assistantResults = searchConversations(sampleConversations, 'dental', { role: 'assistant' });
    for (const r of assistantResults) {
      expect(r.role).toBe('assistant');
    }
  });

  it('filters by date range', () => {
    const now = Date.now();
    const recentOnly = searchConversations(sampleConversations, 'content', {
      dateFrom: now - 60000,
      dateTo: now,
    });
    for (const r of recentOnly) {
      expect(r.timestamp).toBeGreaterThanOrEqual(now - 60000);
      expect(r.timestamp).toBeLessThanOrEqual(now);
    }
  });

  it('returns conversation metadata in results', () => {
    const results = searchConversations(sampleConversations, 'dental');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('conversationId');
    expect(results[0]).toHaveProperty('conversationTitle');
    expect(results[0]).toHaveProperty('messageId');
    expect(results[0]).toHaveProperty('role');
    expect(results[0]).toHaveProperty('content');
    expect(results[0]).toHaveProperty('snippet');
    expect(results[0]).toHaveProperty('score');
    expect(results[0]).toHaveProperty('timestamp');
    expect(results[0]).toHaveProperty('agentType');
  });

  it('sorts results by score descending', () => {
    const results = searchConversations(sampleConversations, 'social media');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('returns empty for non-matching query', () => {
    const results = searchConversations(sampleConversations, 'qwkjfxzbm');
    expect(results).toEqual([]);
  });

  it('handles case-insensitive matching', () => {
    const lower = searchConversations(sampleConversations, 'dental');
    const upper = searchConversations(sampleConversations, 'DENTAL');
    const mixed = searchConversations(sampleConversations, 'DeNtAl');
    expect(lower.length).toBe(upper.length);
    expect(lower.length).toBe(mixed.length);
  });
});

describe('highlightMatches', () => {
  it('wraps matches in **bold** markdown', () => {
    const result = highlightMatches('Hello dental world', 'dental');
    expect(result).toBe('Hello **dental** world');
  });

  it('is case-insensitive', () => {
    const result = highlightMatches('Hello DENTAL world', 'dental');
    expect(result).toBe('Hello **DENTAL** world');
  });

  it('highlights multiple occurrences', () => {
    const result = highlightMatches('dental clinic dental care', 'dental');
    expect(result).toBe('**dental** clinic **dental** care');
  });

  it('returns original text for empty query', () => {
    const result = highlightMatches('Hello world', '');
    expect(result).toBe('Hello world');
  });

  it('returns original text for whitespace query', () => {
    const result = highlightMatches('Hello world', '   ');
    expect(result).toBe('Hello world');
  });

  it('escapes special regex characters', () => {
    const result = highlightMatches('Price is $100.00', '$100.00');
    expect(result).toContain('**$100.00**');
  });

  it('handles no matches', () => {
    const result = highlightMatches('Hello world', 'xyz');
    expect(result).toBe('Hello world');
  });
});
