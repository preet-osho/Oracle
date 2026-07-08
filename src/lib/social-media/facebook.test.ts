// ═══════════════════════════════════════
// ORACLE — Facebook Client Tests
// Text/image/link posts, scheduling, analytics
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
  isFacebookConfigured,
  postText,
  postImage,
  postLink,
  schedulePost,
  getPageAnalytics,
  getPostEngagement,
  listRecentPosts,
} from './facebook';

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) process.env[k] = v;
}

function cleanEnv() {
  delete process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
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

describe('Facebook Client', () => {
  afterEach(() => { cleanEnv(); vi.clearAllMocks(); });

  describe('isFacebookConfigured', () => {
    it('returns true when tokens set', () => {
      setEnv({ FACEBOOK_PAGE_ACCESS_TOKEN: 'tok', FACEBOOK_PAGE_ID: 'pg_1' });
      expect(isFacebookConfigured()).toBe(true);
    });
    it('returns false when missing', () => {
      expect(isFacebookConfigured()).toBe(false);
    });
  });

  describe('postText', () => {
    beforeEach(() => setEnv({ FACEBOOK_PAGE_ACCESS_TOKEN: 'tok', FACEBOOK_PAGE_ID: 'pg_1' }));

    it('posts text and returns success', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(true, { id: 'pg_1_123' }));
      const result = await postText('Hello Facebook!');
      expect(result.success).toBe(true);
      expect(result.postId).toBe('pg_1_123');
      expect(result.postUrl).toContain('facebook.com');
    });

    it('returns error when not configured', async () => {
      cleanEnv();
      const result = await postText('Hello');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('handles API error', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(false, { error: { message: 'Invalid token' } }));
      const result = await postText('Hello');
      expect(result.success).toBe(false);
    });

    it('handles network error', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Timeout'));
      const result = await postText('Hello');
      expect(result.success).toBe(false);
    });
  });

  describe('postImage', () => {
    beforeEach(() => setEnv({ FACEBOOK_PAGE_ACCESS_TOKEN: 'tok', FACEBOOK_PAGE_ID: 'pg_1' }));

    it('posts image via /photos endpoint', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(true, { id: 'photo_1' }));
      const result = await postImage('https://img.jpg', 'Caption');
      expect(result.success).toBe(true);
      expect(result.postId).toBe('photo_1');
      const url = mockFetchWithTimeout.mock.calls[0][0];
      expect(url).toContain('/photos');
    });

    it('returns error when not configured', async () => {
      cleanEnv();
      const result = await postImage('https://img.jpg');
      expect(result.success).toBe(false);
    });
  });

  describe('postLink', () => {
    beforeEach(() => setEnv({ FACEBOOK_PAGE_ACCESS_TOKEN: 'tok', FACEBOOK_PAGE_ID: 'pg_1' }));

    it('posts link with message', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(true, { id: 'pg_1_link1' }));
      const result = await postLink('https://example.com', 'Check this out', { title: 'My Article' });
      expect(result.success).toBe(true);
      const body = JSON.parse(mockFetchWithTimeout.mock.calls[0][1].body);
      expect(body.link).toBe('https://example.com');
      expect(body.name).toBe('My Article');
    });

    it('returns error when not configured', async () => {
      cleanEnv();
      const result = await postLink('https://example.com', 'Text');
      expect(result.success).toBe(false);
    });
  });

  describe('schedulePost', () => {
    beforeEach(() => setEnv({ FACEBOOK_PAGE_ACCESS_TOKEN: 'tok', FACEBOOK_PAGE_ID: 'pg_1' }));

    it('schedules post with published=false', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(true, { id: 'sched_1' }));
      const scheduledTime = Date.now() + 3600000;
      const result = await schedulePost('Scheduled message', scheduledTime);
      expect(result.success).toBe(true);
      const body = JSON.parse(mockFetchWithTimeout.mock.calls[0][1].body);
      expect(body.published).toBe('false');
      expect(body.scheduled_publish_time).toBe(Math.floor(scheduledTime / 1000));
    });

    it('returns error when not configured', async () => {
      cleanEnv();
      const result = await schedulePost('Hello', Date.now());
      expect(result.success).toBe(false);
    });
  });

  describe('getPageAnalytics', () => {
    beforeEach(() => setEnv({ FACEBOOK_PAGE_ACCESS_TOKEN: 'tok', FACEBOOK_PAGE_ID: 'pg_1' }));

    it('returns page stats', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(true, {
        fan_count: 8000, page_impressions: 40000,
        page_engaged_users: 500, page_views_total: 1000,
      }));
      const stats = await getPageAnalytics();
      expect(stats.followers).toBe(8000);
      expect(stats.impressions).toBe(40000);
    });

    it('returns zeros when not configured', async () => {
      cleanEnv();
      const stats = await getPageAnalytics();
      expect(stats.followers).toBe(0);
    });
  });

  describe('getPostEngagement', () => {
    beforeEach(() => setEnv({ FACEBOOK_PAGE_ACCESS_TOKEN: 'tok', FACEBOOK_PAGE_ID: 'pg_1' }));

    it('returns engagement metrics', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(true, {
        insights: { data: [
          { name: 'post_impressions', values: [{ value: 2000 }] },
          { name: 'post_reach', values: [{ value: 1500 }] },
        ]},
        reactions: { summary: { total_count: 100 } },
        comments: { summary: { total_count: 30 } },
        shares: { count: 15 },
      }));
      const eng = await getPostEngagement('post_1');
      expect(eng.impressions).toBe(2000);
      expect(eng.totalEngagement).toBe(145);
    });

    it('returns zeros when not configured', async () => {
      cleanEnv();
      const eng = await getPostEngagement('post_1');
      expect(eng.totalEngagement).toBe(0);
    });
  });

  describe('listRecentPosts', () => {
    beforeEach(() => setEnv({ FACEBOOK_PAGE_ACCESS_TOKEN: 'tok', FACEBOOK_PAGE_ID: 'pg_1' }));

    it('returns parsed posts', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(mockResp(true, {
        data: [{ id: 'pg_1_post1', message: 'Hello', created_time: '2024-01-01' }],
      }));
      const posts = await listRecentPosts();
      expect(posts).toHaveLength(1);
      expect(posts[0].message).toBe('Hello');
    });

    it('returns empty when not configured', async () => {
      cleanEnv();
      expect(await listRecentPosts()).toHaveLength(0);
    });

    it('returns empty on error', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('fail'));
      expect(await listRecentPosts()).toHaveLength(0);
    });
  });
});
