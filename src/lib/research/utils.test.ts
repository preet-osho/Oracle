// ═══════════════════════════════════════
// ORACLE — Research Utils Tests
// normalizeUrl, extractDomain, isPrivateHost, extractTitleFromUrl
// ═══════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { normalizeUrl, extractDomain, isPrivateHost, extractTitleFromUrl } from './utils';

// ─── normalizeUrl ─────────────────────

describe('normalizeUrl', () => {
  it('adds https:// when no protocol specified', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
  });

  it('preserves https:// protocol', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('preserves http:// protocol', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('trims whitespace', () => {
    expect(normalizeUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('blocks file:// protocol', () => {
    expect(() => normalizeUrl('file:///etc/passwd')).toThrow('Unsupported protocol: file://');
  });

  it('blocks ftp:// protocol', () => {
    expect(() => normalizeUrl('ftp://example.com')).toThrow('Unsupported protocol: ftp://');
  });

  it('blocks javascript: protocol', () => {
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow('Unsupported protocol: javascript:');
  });

  it('blocks data: protocol', () => {
    expect(() => normalizeUrl('data:text/html,<h1>hi</h1>')).toThrow('Unsupported protocol: data://');
  });

  it('handles paths and query strings', () => {
    expect(normalizeUrl('example.com/page?q=test')).toBe('https://example.com/page?q=test');
  });

  it('handles subdomains', () => {
    expect(normalizeUrl('sub.example.com')).toBe('https://sub.example.com');
  });
});

// ─── extractDomain ────────────────────

describe('extractDomain', () => {
  it('extracts domain from https URL', () => {
    expect(extractDomain('https://example.com')).toBe('example.com');
  });

  it('extracts domain from http URL', () => {
    expect(extractDomain('http://example.com')).toBe('example.com');
  });

  it('strips www. prefix', () => {
    expect(extractDomain('https://www.example.com')).toBe('example.com');
  });

  it('preserves subdomains (non-www)', () => {
    expect(extractDomain('https://blog.example.com')).toBe('blog.example.com');
  });

  it('handles URLs with paths', () => {
    expect(extractDomain('https://example.com/page/path')).toBe('example.com');
  });

  it('handles URLs with ports', () => {
    expect(extractDomain('https://example.com:3000')).toBe('example.com');
  });

  it('falls back to first 50 chars for invalid URLs', () => {
    const invalid = 'not-a-valid-url-that-is-very-long-and-should-be-truncated';
    expect(extractDomain(invalid)).toBe(invalid.slice(0, 50));
  });

  it('handles empty string', () => {
    expect(extractDomain('')).toBe('');
  });
});

// ─── isPrivateHost ────────────────────

describe('isPrivateHost', () => {
  it('blocks localhost', () => {
    expect(isPrivateHost('localhost')).toBe(true);
  });

  it('blocks 127.0.0.1', () => {
    expect(isPrivateHost('127.0.0.1')).toBe(true);
  });

  it('blocks IPv6 loopback', () => {
    expect(isPrivateHost('::1')).toBe(true);
  });

  it('blocks 10.x.x.x range', () => {
    expect(isPrivateHost('10.0.0.1')).toBe(true);
    expect(isPrivateHost('10.255.255.255')).toBe(true);
    expect(isPrivateHost('10.1.2.3')).toBe(true);
  });

  it('blocks 192.168.x.x range', () => {
    expect(isPrivateHost('192.168.0.1')).toBe(true);
    expect(isPrivateHost('192.168.1.100')).toBe(true);
    expect(isPrivateHost('192.168.255.255')).toBe(true);
  });

  it('blocks 172.16-31.x.x range (172.16.0.0/12)', () => {
    expect(isPrivateHost('172.16.0.1')).toBe(true);
    expect(isPrivateHost('172.20.50.100')).toBe(true);
    expect(isPrivateHost('172.31.255.255')).toBe(true);
  });

  it('allows 172.0-15.x.x (outside /12 range)', () => {
    expect(isPrivateHost('172.0.0.1')).toBe(false);
    expect(isPrivateHost('172.15.255.255')).toBe(false);
  });

  it('allows 172.32+ (outside /12 range)', () => {
    expect(isPrivateHost('172.32.0.1')).toBe(false);
    expect(isPrivateHost('172.100.0.1')).toBe(false);
  });

  it('blocks 169.254.x.x (link-local)', () => {
    expect(isPrivateHost('169.254.1.1')).toBe(true);
    expect(isPrivateHost('169.254.169.254')).toBe(true);
  });

  it('blocks .local domains', () => {
    expect(isPrivateHost('mycomputer.local')).toBe(true);
    expect(isPrivateHost('service.local')).toBe(true);
  });

  it('blocks .internal domains', () => {
    expect(isPrivateHost('db.internal')).toBe(true);
    expect(isPrivateHost('service.internal')).toBe(true);
  });

  it('allows public IPs', () => {
    expect(isPrivateHost('8.8.8.8')).toBe(false);
    expect(isPrivateHost('1.1.1.1')).toBe(false);
    expect(isPrivateHost('203.0.113.1')).toBe(false);
  });

  it('allows public domains', () => {
    expect(isPrivateHost('example.com')).toBe(false);
    expect(isPrivateHost('google.com')).toBe(false);
    expect(isPrivateHost('api.stripe.com')).toBe(false);
  });
});

// ─── extractTitleFromUrl ──────────────

describe('extractTitleFromUrl', () => {
  it('extracts hostname from URL', () => {
    expect(extractTitleFromUrl('https://example.com')).toBe('example.com');
  });

  it('strips www. prefix', () => {
    expect(extractTitleFromUrl('https://www.example.com')).toBe('example.com');
  });

  it('preserves subdomains', () => {
    expect(extractTitleFromUrl('https://blog.example.com')).toBe('blog.example.com');
  });

  it('falls back to first 50 chars for invalid URLs', () => {
    const invalid = 'not-a-url';
    expect(extractTitleFromUrl(invalid)).toBe(invalid.slice(0, 50));
  });

  it('handles URLs with paths', () => {
    expect(extractTitleFromUrl('https://example.com/about')).toBe('example.com');
  });
});
