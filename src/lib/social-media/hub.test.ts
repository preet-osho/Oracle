// ═══════════════════════════════════════
// ORACLE — Social Media Hub Tests
// Platform status, quick post, schedule, cross-post
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted Mocks ─────────────────────

const {
  mockIsLinkedInConfigured,
  mockIsInstagramConfigured,
  mockIsFacebookConfigured,
  mockIsWhatsAppSocialConfigured,
  mockCreatePost,
  mockPublishPost,
  mockUpdatePost,
} = vi.hoisted(() => ({
  mockIsLinkedInConfigured: vi.fn(() => false),
  mockIsInstagramConfigured: vi.fn(() => false),
  mockIsFacebookConfigured: vi.fn(() => false),
  mockIsWhatsAppSocialConfigured: vi.fn(() => false),
  mockCreatePost: vi.fn(),
  mockPublishPost: vi.fn(),
  mockUpdatePost: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('./linkedin', () => ({ isLinkedInConfigured: mockIsLinkedInConfigured }));
vi.mock('./instagram', () => ({ isInstagramConfigured: mockIsInstagramConfigured }));
vi.mock('./facebook', () => ({ isFacebookConfigured: mockIsFacebookConfigured }));
vi.mock('./whatsapp-social', () => ({ isWhatsAppSocialConfigured: mockIsWhatsAppSocialConfigured }));
vi.mock('./scheduler', () => ({
  createPost: mockCreatePost,
  getPost: vi.fn(),
  updatePost: mockUpdatePost,
  deletePost: vi.fn(),
  listPosts: vi.fn(),
  publishPost: mockPublishPost,
  processQueue: vi.fn(),
  scheduleBulk: vi.fn(),
  getPostStats: vi.fn(),
  getQueue: vi.fn(),
}));

// ─── Import after mocks ────────────────

import {
  getPlatformStatus,
  quickPost,
  schedulePost,
  crossPost,
} from './hub';

// ─── Tests ────────────────────────────

describe('Social Media Hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPlatformStatus', () => {
    it('returns status for all platforms', () => {
      const status = getPlatformStatus();

      expect(status).toHaveProperty('linkedin');
      expect(status).toHaveProperty('instagram');
      expect(status).toHaveProperty('facebook');
      expect(status).toHaveProperty('whatsapp');
    });

    it('reports platforms as unavailable by default', () => {
      const status = getPlatformStatus();

      expect(status.linkedin.configured).toBe(false);
      expect(status.instagram.configured).toBe(false);
      expect(status.facebook.configured).toBe(false);
      expect(status.whatsapp.configured).toBe(false);
    });

    it('reports LinkedIn as available when configured', () => {
      mockIsLinkedInConfigured.mockReturnValue(true);

      const status = getPlatformStatus();
      expect(status.linkedin.configured).toBe(true);
    });

    it('includes platform display names', () => {
      const status = getPlatformStatus();

      expect(status.linkedin.name).toBe('LinkedIn');
      expect(status.instagram.name).toBe('Instagram');
      expect(status.facebook.name).toBe('Facebook');
      expect(status.whatsapp.name).toBe('WhatsApp');
    });
  });

  describe('quickPost', () => {
    it('creates and publishes a post', async () => {
      const mockPost = { id: 'post_001', platform: 'linkedin' };
      mockCreatePost.mockReturnValue(mockPost);
      mockPublishPost.mockResolvedValueOnce({ success: true, postId: 'li_123', postUrl: 'https://linkedin.com/post/123' });

      const result = await quickPost('linkedin', 'Hello world!');

      expect(result.success).toBe(true);
      expect(result.post).toBe(mockPost);
      expect(result.result.postId).toBe('li_123');
      expect(mockCreatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'linkedin',
          text: 'Hello world!',
          postType: 'text',
          timezone: 'Asia/Kolkata',
        }),
      );
      expect(mockPublishPost).toHaveBeenCalledWith(mockPost);
      expect(mockUpdatePost).toHaveBeenCalledWith('post_001', { status: 'published' });
    });

    it('marks post as failed when publish fails', async () => {
      const mockPost = { id: 'post_002', platform: 'instagram' };
      mockCreatePost.mockReturnValue(mockPost);
      mockPublishPost.mockResolvedValueOnce({ success: false, error: 'API error' });

      const result = await quickPost('instagram', 'Check this out!');

      expect(result.success).toBe(false);
      expect(result.result.error).toBe('API error');
      expect(mockUpdatePost).toHaveBeenCalledWith('post_002', { status: 'failed' });
    });

    it('passes options through to createPost', async () => {
      const mockPost = { id: 'post_003', platform: 'facebook' };
      mockCreatePost.mockReturnValue(mockPost);
      mockPublishPost.mockResolvedValueOnce({ success: true, postId: 'fb_456' });

      await quickPost('facebook', 'Post with options', {
        postType: 'image',
        imageUrl: 'https://example.com/image.jpg',
        linkUrl: 'https://example.com',
        linkTitle: 'Example',
        priority: 'high',
        clientId: 'client_1',
        hashtags: ['#marketing', '#growth'],
      });

      expect(mockCreatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          postType: 'image',
          imageUrl: 'https://example.com/image.jpg',
          linkUrl: 'https://example.com',
          priority: 'high',
          hashtags: ['#marketing', '#growth'],
        }),
      );
    });
  });

  describe('schedulePost', () => {
    it('creates a scheduled post', () => {
      const scheduledAt = Date.now() + 3600000;
      const mockPost = { id: 'post_sched_001' };
      mockCreatePost.mockReturnValue(mockPost);

      const result = schedulePost('linkedin', 'Scheduled post', scheduledAt);

      expect(result).toBe(mockPost);
      expect(mockCreatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'linkedin',
          text: 'Scheduled post',
          scheduledAt,
          timezone: 'Asia/Kolkata',
        }),
      );
    });

    it('passes options through', () => {
      const scheduledAt = Date.now() + 7200000;
      const mockPost = { id: 'post_sched_002' };
      mockCreatePost.mockReturnValue(mockPost);

      schedulePost('whatsapp', 'WhatsApp scheduled', scheduledAt, {
        postType: 'image',
        imageUrl: 'https://example.com/img.jpg',
        priority: 'low',
        tags: ['campaign'],
        hashtags: ['#whatsapp'],
      });

      expect(mockCreatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          postType: 'image',
          tags: ['campaign'],
          hashtags: ['#whatsapp'],
        }),
      );
    });
  });

  describe('crossPost', () => {
    it('publishes to multiple platforms immediately', async () => {
      const mockPost = { id: 'cp_001' };
      mockCreatePost.mockReturnValue(mockPost);
      mockPublishPost.mockResolvedValue({ success: true, postId: 'ext_001' });

      const results = await crossPost(['linkedin', 'facebook'], 'Cross-posted content');

      expect(results).toHaveLength(2);
      expect(results[0].platform).toBe('linkedin');
      expect(results[0].success).toBe(true);
      expect(results[1].platform).toBe('facebook');
      expect(results[1].success).toBe(true);
      expect(mockPublishPost).toHaveBeenCalledTimes(2);
    });

    it('schedules posts when scheduledAt is provided', async () => {
      const scheduledAt = Date.now() + 3600000;
      const mockPost = { id: 'cp_sched_001' };
      mockCreatePost.mockReturnValue(mockPost);

      const results = await crossPost(['linkedin', 'instagram'], 'Scheduled cross-post', {
        scheduledAt,
      });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true); // Scheduled posts are always "success"
      expect(results[1].success).toBe(true);
      expect(mockPublishPost).not.toHaveBeenCalled(); // Not published immediately
      expect(mockCreatePost).toHaveBeenCalledTimes(2);
    });

    it('handles mixed success and failure', async () => {
      const mockPost1 = { id: 'cp_mix_1' };
      const mockPost2 = { id: 'cp_mix_2' };
      mockCreatePost
        .mockReturnValueOnce(mockPost1)
        .mockReturnValueOnce(mockPost2);
      mockPublishPost
        .mockResolvedValueOnce({ success: true, postId: 'ok_1' })
        .mockResolvedValueOnce({ success: false, error: 'Rate limited' });

      const results = await crossPost(['linkedin', 'facebook'], 'Mixed results');

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Rate limited');
    });

    it('passes options through to each post', async () => {
      const mockPost = { id: 'cp_opts' };
      mockCreatePost.mockReturnValue(mockPost);
      mockPublishPost.mockResolvedValue({ success: true, postId: 'ok' });

      await crossPost(['linkedin', 'facebook'], 'Options test', {
        imageUrl: 'https://example.com/img.jpg',
        linkUrl: 'https://example.com',
        clientId: 'client_1',
      });

      expect(mockCreatePost).toHaveBeenCalledTimes(2);
      expect(mockCreatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl: 'https://example.com/img.jpg',
          linkUrl: 'https://example.com',
        }),
      );
    });
  });
});
