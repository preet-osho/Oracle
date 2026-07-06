import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatMarkdownForAI,
  extractKeyContent,
} from './scraping';

describe('formatMarkdownForAI', () => {
  it('returns empty string for empty input', () => {
    expect(formatMarkdownForAI('')).toBe('');
  });

  it('trims excessive newlines', () => {
    const input = 'Hello\n\n\n\n\nWorld';
    expect(formatMarkdownForAI(input)).toBe('Hello\n\nWorld');
  });

  it('removes navigation/footer markers', () => {
    const input = '# Title\n\nContent\n\n## Navigation\nLink1\nLink2\n\n## Footer\nCopyright 2024';
    const result = formatMarkdownForAI(input);
    expect(result).toContain('# Title');
    expect(result).toContain('Content');
    expect(result).not.toContain('## Navigation');
    expect(result).not.toContain('## Footer');
  });

  it('truncates content exceeding maxLength', () => {
    const input = 'A'.repeat(10000);
    const result = formatMarkdownForAI(input, 100);
    expect(result.length).toBeLessThanOrEqual(130);
    expect(result).toContain('[Content truncated...]');
  });

  it('preserves content within maxLength', () => {
    const input = 'Short content';
    expect(formatMarkdownForAI(input, 1000)).toBe('Short content');
  });
});

describe('extractKeyContent', () => {
  it('extracts headings', () => {
    const md = '# Main Title\nSome text\n## Subtitle\nMore text';
    const result = extractKeyContent(md);
    expect(result.headings).toEqual(['Main Title', 'Subtitle']);
  });

  it('extracts paragraphs', () => {
    const md = '# Title\n\nFirst paragraph\n\nSecond paragraph';
    const result = extractKeyContent(md);
    expect(result.paragraphs).toContain('First paragraph');
    expect(result.paragraphs).toContain('Second paragraph');
  });

  it('extracts links', () => {
    const md = 'Check [Google](https://google.com) and [GitHub](https://github.com)';
    const result = extractKeyContent(md);
    expect(result.links).toHaveLength(2);
    expect(result.links[0]).toEqual({ text: 'Google', url: 'https://google.com' });
    expect(result.links[1]).toEqual({ text: 'GitHub', url: 'https://github.com' });
  });

  it('extracts images', () => {
    const md = 'Some text\n![Logo](https://example.com/logo.png)\nMore text\n![Banner](https://example.com/banner.jpg)';
    const result = extractKeyContent(md);
    expect(result.images.length).toBeGreaterThanOrEqual(1);
    expect(result.images[0]).toEqual({ alt: 'Logo', src: 'https://example.com/logo.png' });
  });

  it('handles empty markdown', () => {
    const result = extractKeyContent('');
    expect(result.headings).toEqual([]);
    expect(result.paragraphs).toEqual([]);
    expect(result.links).toEqual([]);
    expect(result.images).toEqual([]);
  });
});
