// ═══════════════════════════════════════
// ORACLE — Social Media API Tests
// CRUD · Scheduling · Hub · Platform clients
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialMediaPost } from './types';

// ─── Mock all platform clients ────────
vi.mock('./linkedin', () => ({
  isLinkedInConfigured: vi.fn(() => false),
  postText: vi.fn(() => Promise.resolve({ success: true, postId: 'li-123', postUrl: 'https://linkedin.com/posts/li-123' })),
  postImage: vi.fn(() => Promise.resolve({ success: true, postId: 'li-456' })),
  postLink: vi.fn(() => Promise.resolve({ success: true, postId: 'li-789' })),
}));

vi.mock('./instagram', () => ({
  isInstagramConfigured: vi.fn(() => false),
  postImage: vi.fn(() => Promise.resolve({ success: true, mediaId: 'ig-123', postUrl: 'https://instagram.com/p/ig-123/' })),
  postCarousel: vi.fn(() => Promise.resolve({ success: true, mediaId: 'ig-456' })),
  postVideo: vi.fn(() => Promise.resolve({ success: true, mediaId: 'ig-789' })),
}));

vi.mock('./facebook', () => ({
  isFacebookConfigured: vi.fn(() => false),
  postText: vi.fn(() => Promise.resolve({ success: true, postId: 'fb-123' })),
  postImage: vi.fn(() => Promise.resolve({ success: true, postId: 'fb-456' })),
  postLink: vi.fn(() => Promise.resolve({ success: true, postId: 'fb-789' })),
}));

vi.mock('./whatsapp-social', () => ({
  isWhatsAppSocialConfigured: vi.fn(() => false),
  sendTextMessage: vi.fn(() => Promise.resolve({ success: true, messageId: 'wa-123' })),
}));

// ─── Import after mocks ───────────────
import {
  createPost,
  getPost,
  updatePost,
  deletePost,
  listPosts,
  processQueue,
  getPostStats,
  getQueue,
  quickPost,
  crossPost,
  schedulePost,
  scheduleBulk,
} from './hub';
import { getPlatformStatus } from './hub';

// ═══════════════════════════════════════
// CRUD Operations
// ═══════════════════════════════════════

describe('Social Media CRUD', () => {
  it('creates a draft post', () => {
    const post = createPost({
      platform: 'linkedin',
      postType: 'text',
      text: 'Hello from ORACLE!',
      priority: 'normal',
      timezone: 'Asia/Kolkata',
      tags: ['test'],
      hashtags: ['#oracle'],
      notes: '',
      createdBy: 'test',
    });

    expect(post.id).toMatch(/^post_/);
    expect(post.platform).toBe('linkedin');
    expect(post.status).toBe('draft');
    expect(post.text).toBe('Hello from ORACLE!');
  });

  it('creates a scheduled post', () => {
    const scheduledAt = Date.now() + 3600000;
    const post = createPost({
      platform: 'instagram',
      postType: 'image',
      text: 'Scheduled post',
      imageUrl: 'https://example.com/image.jpg',
      scheduledAt,
      priority: 'high',
      timezone: 'Asia/Kolkata',
      tags: [],
      hashtags: ['#instagram'],
      notes: '',
      createdBy: 'test',
    });

    expect(post.status).toBe('scheduled');
    expect(post.scheduledAt).toBe(scheduledAt);
    expect(getQueue().some((q) => q.postId === post.id)).toBe(true);
  });

  it('gets a post by ID', () => {
    const post = createPost({
      platform: 'facebook',
      postType: 'text',
      text: 'Get me',
      priority: 'normal',
      timezone: 'Asia/Kolkata',
      tags: [],
      hashtags: [],
      notes: '',
      createdBy: 'test',
    });

    const found = getPost(post.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(post.id);
  });

  it('returns undefined for non-existent post', () => {
    expect(getPost('nonexistent')).toBeUndefined();
  });

  it('updates a post', () => {
    const post = createPost({
      platform: 'linkedin',
      postType: 'text',
      text: 'Original',
      priority: 'normal',
      timezone: 'Asia/Kolkata',
      tags: [],
      hashtags: [],
      notes: '',
      createdBy: 'test',
    });

    const updated = updatePost(post.id, { text: 'Updated text', tags: ['updated'] });
    expect(updated?.text).toBe('Updated text');
    expect(updated?.tags).toContain('updated');
  });

  it('deletes a post', () => {
    const post = createPost({
      platform: 'facebook',
      postType: 'text',
      text: 'Delete me',
      priority: 'normal',
      timezone: 'Asia/Kolkata',
      tags: [],
      hashtags: [],
      notes: '',
      createdBy: 'test',
    });

    expect(deletePost(post.id)).toBe(true);
    expect(getPost(post.id)).toBeUndefined();
  });

  it('returns false when deleting non-existent post', () => {
    expect(deletePost('nonexistent')).toBe(false);
  });
});

// ═══════════════════════════════════════
// Listing & Filtering
// ═══════════════════════════════════════

describe('Social Media Listing', () => {
  it('lists all posts', () => {
    const count = listPosts().length;
    createPost({
      platform: 'linkedin',
      postType: 'text',
      text: 'List me',
      priority: 'normal',
      timezone: 'Asia/Kolkata',
      tags: [],
      hashtags: [],
      notes: '',
      createdBy: 'test',
    });

    expect(listPosts().length).toBeGreaterThan(count);
  });

  it('filters by platform', () => {
    createPost({
      platform: 'instagram',
      postType: 'text',
      text: 'IG post',
      priority: 'normal',
      timezone: 'Asia/Kolkata',
      tags: [],
      hashtags: [],
      notes: '',
      createdBy: 'test',
    });

    const igPosts = listPosts({ platform: 'instagram' });
    expect(igPosts.every((p) => p.platform === 'instagram')).toBe(true);
  });

  it('filters by status', () => {
    const post = createPost({
      platform: 'facebook',
      postType: 'text',
      text: 'Draft only',
      priority: 'normal',
      timezone: 'Asia/Kolkata',
      tags: [],
      hashtags: [],
      notes: '',
      createdBy: 'test',
    });

    const drafts = listPosts({ status: 'draft' });
    expect(drafts.some((p) => p.id === post.id)).toBe(true);
  });

  it('respects limit', () => {
    const limited = listPosts({ limit: 2 });
    expect(limited.length).toBeLessThanOrEqual(2);
  });
});

// ═══════════════════════════════════════
// Platform Status
// ═══════════════════════════════════════

describe('Platform Status', () => {
  it('returns status for all platforms', () => {
    const status = getPlatformStatus();
    expect(status).toHaveProperty('linkedin');
    expect(status).toHaveProperty('instagram');
    expect(status).toHaveProperty('facebook');
    expect(status).toHaveProperty('whatsapp');
    expect(status.linkedin.configured).toBe(false);
    expect(status.instagram.configured).toBe(false);
  });
});

// ═══════════════════════════════════════
// Queue & Scheduling
// ═══════════════════════════════════════

describe('Queue & Scheduling', () => {
  it('adds scheduled posts to queue', () => {
    const post = createPost({
      platform: 'linkedin',
      postType: 'text',
      text: 'Queued',
      scheduledAt: Date.now() + 60000,
      priority: 'high',
      timezone: 'Asia/Kolkata',
      tags: [],
      hashtags: [],
      notes: '',
      createdBy: 'test',
    });

    const queue = getQueue();
    expect(queue.some((q) => q.postId === post.id)).toBe(true);
  });

  it('processes empty queue without errors', async () => {
    const result = await processQueue();
    expect(result.published).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('removes deleted post from queue', () => {
    const post = createPost({
      platform: 'facebook',
      postType: 'text',
      text: 'Remove from queue',
      scheduledAt: Date.now() + 120000,
      priority: 'normal',
      timezone: 'Asia/Kolkata',
      tags: [],
      hashtags: [],
      notes: '',
      createdBy: 'test',
    });

    deletePost(post.id);
    expect(getQueue().some((q) => q.postId === post.id)).toBe(false);
  });
});

// ═══════════════════════════════════════
// Hub Functions
// ═══════════════════════════════════════

describe('Social Hub', () => {
  it('quickPost creates and returns a draft (platforms not configured)', async () => {
    const { success, post, result } = await quickPost('linkedin', 'Quick post!');
    expect(post.text).toBe('Quick post!');
    expect(post.platform).toBe('linkedin');
    // Since LinkedIn is not configured, publish fails
    expect(success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('schedulePost creates a scheduled post', () => {
    const scheduledAt = Date.now() + 7200000;
    const post = schedulePost('instagram', 'Scheduled!', scheduledAt, {
      hashtags: ['#insta'],
    });

    expect(post.status).toBe('scheduled');
    expect(post.scheduledAt).toBe(scheduledAt);
    expect(post.hashtags).toContain('#insta');
  });

  it('crossPost creates posts for multiple platforms', async () => {
    const results = await crossPost(['linkedin', 'instagram', 'facebook'], 'Cross-posted!');
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.platform)).toBe(true);
  });
});

// ═══════════════════════════════════════
// Stats
// ═══════════════════════════════════════

describe('Stats', () => {
  it('returns correct stats', () => {
    const stats = getPostStats();
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('byPlatform');
    expect(stats).toHaveProperty('byStatus');
    expect(typeof stats.total).toBe('number');
  });
});

// ═══════════════════════════════════════
// Bulk Scheduling
// ═══════════════════════════════════════

describe('Bulk Scheduling', () => {
  it('schedules multiple posts with intervals', () => {
    const startTime = Date.now() + 3600000;
    const posts = scheduleBulk(
      [
        {
          platform: 'linkedin',
          postType: 'text' as const,
          text: 'Post 1',
          priority: 'normal' as const,
          timezone: 'Asia/Kolkata',
          tags: [],
          hashtags: [],
          notes: '',
          createdBy: 'test',
        },
        {
          platform: 'linkedin',
          postType: 'text' as const,
          text: 'Post 2',
          priority: 'normal' as const,
          timezone: 'Asia/Kolkata',
          tags: [],
          hashtags: [],
          notes: '',
          createdBy: 'test',
        },
        {
          platform: 'linkedin',
          postType: 'text' as const,
          text: 'Post 3',
          priority: 'normal' as const,
          timezone: 'Asia/Kolkata',
          tags: [],
          hashtags: [],
          notes: '',
          createdBy: 'test',
        },
      ],
      { startAt: startTime, intervalMinutes: 60 },
    );

    expect(posts).toHaveLength(3);
    expect(posts[0].scheduledAt).toBe(startTime);
    expect(posts[1].scheduledAt).toBe(startTime + 3600000);
    expect(posts[2].scheduledAt).toBe(startTime + 7200000);
    expect(posts.every((p) => p.status === 'scheduled')).toBe(true);
  });
});
