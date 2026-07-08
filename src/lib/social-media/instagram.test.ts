// ═══════════════════════════════════════
// ORACLE — Instagram Client Tests
// Image/carousel/video posts, analytics, quota
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
  isInstagramConfigured,
  postImage,
  postCarousel,
  getPublishingQuota,
  getPageAnalytics,
  getPostEngagement,
  listRecentMedia,
} from './instagram';

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) process.env[k] = v;
}

function cleanEnv() {
  delete process.env.INSTAGRAM_ACCESS_TOKEN;
  delete process.env.INSTAGRAM_ACCOUNT_ID;
  delete process.env.FACEBOOK_PAGE_ID;
}

function mockResp(ok: boolean, body?: unknown) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(body ?? {}),
    text: () => Promise.resolve(JSON.stringify(body ?? {})),
  };
}

describe('Instagram Client', () => {
  afterEach(() => { cleanEnv(); vi.clearAllMocks(); });

  describe('isInstagramConfigured', () => {
    it('returns true when tokens set', () => {
      setEnv({ INSTAGRAM_ACCESS_TOKEN: 'tok', INSTAGRAM_ACCOUNT_ID: '123' });
      expect(isInstagramConfigured()).toBe(true);
    });
    it('returns false when missing', () => {
      expect(isInstagramConfigured()).toBe(false);
    });
  });

  describe('postImage', () => {
    beforeEach(() => setEnv({ INSTAGRAM_ACCESS_TOKEN: 'tok', INSTAGRAM_ACCOUNT_ID: '123' }));

    it('creates container then publishes', async () => {
      mockFetchWithTimeout
        .mockResolvedValueOnce(mockResp(true, { id: 'container_1' }))
        .mockResolvedValueOnce(mockResp(true, { id: 'media_1' }));
      const result = await postImage('https://img.jpg', 'Caption');
      expect(result.success).toBe(true);
      expect(result.mediaId).toBe('media_1');
      expect(result.postUrl).toContain('instagram.com');
    });

    it('returns error when not configured', async () => {
      cleanEnv();
      const result = await postImage('https://img.jpg', 'Caption');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('handles container creation failure', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(false, { error: { message: 'Invalid token' } }));
      const result = await postImage('https://img.jpg', 'Caption');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('handles network error', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Timeout'));
      const result = await postImage('https://img.jpg', 'Caption');
      expect(result.success).toBe(false);
    });
  });

  describe('postCarousel', () => {
    beforeEach(() => setEnv({ INSTAGRAM_ACCESS_TOKEN: 'tok', INSTAGRAM_ACCOUNT_ID: '123' }));

    it('creates child containers then publishes', async () => {
      mockFetchWithTimeout
        .mockResolvedValueOnce(mockResp(true, { id: 'child_1' }))
        .mockResolvedValueOnce(mockResp(true, { id: 'child_2' }))
        .mockResolvedValueOnce(mockResp(true, { id: 'carousel_1' }))
        .mockResolvedValueOnce(mockResp(true, { id: 'published_1' }));
      const result = await postCarousel(['https://a.jpg', 'https://b.jpg'], 'Carousel');
      expect(result.success).toBe(true);
      expect(result.mediaId).toBe('published_1');
    });

    it('returns error when not configured', async () => {
      cleanEnv();
      const result = await postCarousel(['https://a.jpg'], 'Caption');
      expect(result.success).toBe(false);
    });

    it('handles child creation failure', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(false, { error: { message: 'Bad image' } }));
      const result = await postCarousel(['https://bad.jpg'], 'Caption');
      expect(result.success).toBe(false);
    });
  });

  describe('getPublishingQuota', () => {
    beforeEach(() => setEnv({ INSTAGRAM_ACCESS_TOKEN: 'tok', INSTAGRAM_ACCOUNT_ID: '123' }));

    it('returns remaining quota', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(true, { data: [{ quota_usage: 15 }] }));
      const quota = await getPublishingQuota();
      expect(quota.remaining).toBe(85);
      expect(quota.total).toBe(100);
    });

    it('returns zeros when not configured', async () => {
      cleanEnv();
      const quota = await getPublishingQuota();
      expect(quota.remaining).toBe(0);
    });
  });

  describe('getPageAnalytics', () => {
    beforeEach(() => setEnv({ INSTAGRAM_ACCESS_TOKEN: 'tok', INSTAGRAM_ACCOUNT_ID: '123' }));

    it('returns follower and engagement stats', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(true, {
        followers_count: 10000, impressions: 50000, reach: 30000,
        profile_views: 200, website_clicks: 50,
      }));
      const stats = await getPageAnalytics();
      expect(stats.followers).toBe(10000);
      expect(stats.impressions).toBe(50000);
    });

    it('returns zeros when not configured', async () => {
      cleanEnv();
      const stats = await getPageAnalytics();
      expect(stats.followers).toBe(0);
    });
  });

  describe('getPostEngagement', () => {
    beforeEach(() => setEnv({ INSTAGRAM_ACCESS_TOKEN: 'tok', INSTAGRAM_ACCOUNT_ID: '123' }));

    it('returns engagement metrics', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(true, {
        impressions: 1000, reach: 800, like_count: 50, comments_count: 10, save_count: 5,
      }));
      const eng = await getPostEngagement('media_1');
      expect(eng.impressions).toBe(1000);
      expect(eng.totalEngagement).toBe(65);
    });

    it('returns zeros when not configured', async () => {
      cleanEnv();
      const eng = await getPostEngagement('media_1');
      expect(eng.totalEngagement).toBe(0);
    });
  });

  describe('listRecentMedia', () => {
    beforeEach(() => setEnv({ INSTAGRAM_ACCESS_TOKEN: 'tok', INSTAGRAM_ACCOUNT_ID: '123' }));

    it('returns parsed media', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(true, {
        data: [{ id: 'm1', caption: 'Post 1', timestamp: '2024-01-01' }],
      }));
      const media = await listRecentMedia();
      expect(media).toHaveLength(1);
      expect(media[0].mediaId).toBe('m1');
    });

    it('returns empty when not configured', async () => {
      cleanEnv();
      expect(await listRecentMedia()).toHaveLength(0);
    });

    it('returns empty on error', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('fail'));
      expect(await listRecentMedia()).toHaveLength(0);
    });
  });
});
