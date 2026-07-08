// ═══════════════════════════════════════
// ORACLE — LinkedIn Client Tests
// Posts, analytics, engagement, listing
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockFetchWithTimeout } = vi.hoisted(() => ({
  mockFetchWithTimeout: vi.fn(),
}));

vi.mock('@/lib/fetch-utils', () => ({
  fetchWithTimeout: mockFetchWithTimeout,
  TIMEOUT_MODERATE_MS: 15000,
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  isLinkedInConfigured,
  postText,
  postImage,
  postLink,
  getPageAnalytics,
  getPostEngagement,
  listRecentPosts,
} from './linkedin';

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) process.env[k] = v;
}

function cleanEnv() {
  delete process.env.LINKEDIN_ACCESS_TOKEN;
  delete process.env.LINKEDIN_AUTHOR_URN;
  delete process.env.LINKEDIN_API_VERSION;
}

function mockResponse(ok: boolean, body?: unknown, headers?: Record<string, string>) {
  const h = new Headers(headers);
  return {
    ok,
    status: ok ? 200 : 400,
    headers: h,
    json: () => Promise.resolve(body ?? {}),
    text: () => Promise.resolve(JSON.stringify(body ?? {})),
  };
}

describe('LinkedIn Client', () => {
  afterEach(() => { cleanEnv(); vi.clearAllMocks(); });

  describe('isLinkedInConfigured', () => {
    it('returns true when both tokens are set', () => {
      setEnv({ LINKEDIN_ACCESS_TOKEN: 'tok', LINKEDIN_AUTHOR_URN: 'urn:li:organization:123' });
      expect(isLinkedInConfigured()).toBe(true);
    });
    it('returns false when access token is missing', () => {
      setEnv({ LINKEDIN_AUTHOR_URN: 'urn:li:organization:123' });
      expect(isLinkedInConfigured()).toBe(false);
    });
    it('returns false when author URN is missing', () => {
      setEnv({ LINKEDIN_ACCESS_TOKEN: 'tok' });
      expect(isLinkedInConfigured()).toBe(false);
    });
    it('returns false when both are missing', () => {
      expect(isLinkedInConfigured()).toBe(false);
    });
  });

  describe('postText', () => {
    beforeEach(() => {
      setEnv({ LINKEDIN_ACCESS_TOKEN: 'tok', LINKEDIN_AUTHOR_URN: 'urn:li:organization:123' });
    });

    it('sends text post and returns success', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResponse(true, {}, { 'x-restli-post-id': 'urn:li:share:456' }));
      const result = await postText('Hello LinkedIn!');
      expect(result.success).toBe(true);
      expect(result.postId).toBe('urn:li:share:456');
      expect(result.postUrl).toContain('linkedin.com');
    });

    it('returns error when not configured', async () => {
      cleanEnv();
      const result = await postText('Hello');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('handles HTTP error', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResponse(false, { message: 'Unauthorized' }));
      const result = await postText('Hello');
      expect(result.success).toBe(false);
      expect(result.error).toContain('400');
    });

    it('handles network error', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Timeout'));
      const result = await postText('Hello');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout');
    });

    it('handles non-Error throw', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce('string');
      const result = await postText('Hello');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('passes visibility option', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResponse(true, {}, { 'x-restli-post-id': 'urn:li:share:789' }));
      await postText('Private post', { visibility: 'CONNECTIONS' });
      const body = JSON.parse(mockFetchWithTimeout.mock.calls[0][1].body);
      expect(body.visibility).toBe('CONNECTIONS');
    });

    it('uses custom author URN', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResponse(true, {}, { 'x-restli-post-id': 'urn:li:share:999' }));
      await postText('Custom author', { authorUrn: 'urn:li:person:456' });
      const body = JSON.parse(mockFetchWithTimeout.mock.calls[0][1].body);
      expect(body.author).toBe('urn:li:person:456');
    });
  });

  describe('postLink', () => {
    beforeEach(() => {
      setEnv({ LINKEDIN_ACCESS_TOKEN: 'tok', LINKEDIN_AUTHOR_URN: 'urn:li:organization:123' });
    });

    it('sends link post with article content', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResponse(true, {}, { 'x-restli-post-id': 'urn:li:share:link1' }));
      const result = await postLink('Check this out', 'https://example.com', { title: 'My Article' });
      expect(result.success).toBe(true);
      const body = JSON.parse(mockFetchWithTimeout.mock.calls[0][1].body);
      expect(body.content.article.source).toBe('https://example.com');
      expect(body.content.article.title).toBe('My Article');
    });

    it('returns error when not configured', async () => {
      cleanEnv();
      const result = await postLink('Text', 'https://example.com');
      expect(result.success).toBe(false);
    });
  });

  describe('getPageAnalytics', () => {
    beforeEach(() => {
      setEnv({ LINKEDIN_ACCESS_TOKEN: 'tok', LINKEDIN_AUTHOR_URN: 'urn:li:organization:123' });
    });

    it('returns follower count and stats', async () => {
      mockFetchWithTimeout
        .mockResolvedValueOnce(mockResponse(true, { followerCount: 5000 }))
        .mockResolvedValueOnce(mockResponse(true, { elements: [{ totalImpressionsCount: 10000, totalLikesCount: 200 }] }));
      const stats = await getPageAnalytics();
      expect(stats.followerCount).toBe(5000);
      expect(stats.impressions).toBe(10000);
      expect(stats.likes).toBe(200);
    });

    it('returns zeros when not configured', async () => {
      cleanEnv();
      const stats = await getPageAnalytics();
      expect(stats.followerCount).toBe(0);
    });

    it('returns zeros on error', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('fail'));
      const stats = await getPageAnalytics();
      expect(stats.followerCount).toBe(0);
    });
  });

  describe('getPostEngagement', () => {
    beforeEach(() => {
      setEnv({ LINKEDIN_ACCESS_TOKEN: 'tok', LINKEDIN_AUTHOR_URN: 'urn:li:organization:123' });
    });

    it('returns engagement metrics', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResponse(true, {
        totalImpressionsCount: 500, totalClicksCount: 20,
        totalLikeCount: 30, totalCommentCount: 10, totalShareCount: 5,
      }));
      const eng = await getPostEngagement('post_1');
      expect(eng.impressions).toBe(500);
      expect(eng.totalEngagement).toBe(45);
    });

    it('returns zeros when not configured', async () => {
      cleanEnv();
      const eng = await getPostEngagement('post_1');
      expect(eng.totalEngagement).toBe(0);
    });
  });

  describe('listRecentPosts', () => {
    beforeEach(() => {
      setEnv({ LINKEDIN_ACCESS_TOKEN: 'tok', LINKEDIN_AUTHOR_URN: 'urn:li:organization:123' });
    });

    it('returns parsed posts', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResponse(true, {
        elements: [{ id: 'post_1', commentary: { text: 'Hello' }, created: { time: 1700000000000 } }],
      }));
      const posts = await listRecentPosts();
      expect(posts).toHaveLength(1);
      expect(posts[0].postId).toBe('post_1');
      expect(posts[0].text).toBe('Hello');
    });

    it('returns empty when not configured', async () => {
      cleanEnv();
      const posts = await listRecentPosts();
      expect(posts).toHaveLength(0);
    });

    it('returns empty on error', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('fail'));
      const posts = await listRecentPosts();
      expect(posts).toHaveLength(0);
    });
  });
});
