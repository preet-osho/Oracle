// ═══════════════════════════════════════
// ORACLE — Social Media Hub
// Unified interface for all social platforms
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';
import type {
  SocialPlatform,
  SocialPlatformConfig,
  SocialMediaPost,
  PostType,
  PostPriority,
} from './types';
import { isLinkedInConfigured } from './linkedin';
import { isInstagramConfigured } from './instagram';
import { isFacebookConfigured } from './facebook';
import { isWhatsAppSocialConfigured } from './whatsapp-social';
import {
  createPost,
  getPost,
  updatePost,
  deletePost,
  listPosts,
  publishPost,
  processQueue,
  scheduleBulk,
  getPostStats,
  getQueue,
} from './scheduler';

const log = createLogger('SocialHub');

// ─── Platform Status ──────────────────

export function getPlatformStatus(): Record<SocialPlatform, { configured: boolean; name: string }> {
  return {
    linkedin: { configured: isLinkedInConfigured(), name: 'LinkedIn' },
    instagram: { configured: isInstagramConfigured(), name: 'Instagram' },
    facebook: { configured: isFacebookConfigured(), name: 'Facebook' },
    whatsapp: { configured: isWhatsAppSocialConfigured(), name: 'WhatsApp' },
  };
}

// ─── Post Management (Re-exports) ─────

export {
  createPost,
  getPost,
  updatePost,
  deletePost,
  listPosts,
  publishPost,
  processQueue,
  scheduleBulk,
  getPostStats,
  getQueue,
};

// ─── Quick Post (one-liner) ───────────

/**
 * Create and immediately publish a post to a single platform.
 */
export async function quickPost(
  platform: SocialPlatform,
  text: string,
  options?: {
    postType?: PostType;
    imageUrl?: string;
    linkUrl?: string;
    linkTitle?: string;
    priority?: PostPriority;
    clientId?: string;
    hashtags?: string[];
  },
): Promise<{ success: boolean; post: SocialMediaPost; result: { success: boolean; postId?: string; postUrl?: string; error?: string } }> {
  const post = createPost({
    platform,
    postType: options?.postType || 'text',
    text,
    imageUrl: options?.imageUrl,
    linkUrl: options?.linkUrl,
    linkTitle: options?.linkTitle,
    priority: options?.priority || 'normal',
    timezone: 'Asia/Kolkata',
    tags: [],
    hashtags: options?.hashtags || [],
    notes: '',
    createdBy: 'system',
  });

  const result = await publishPost(post);

  if (result.success) {
    updatePost(post.id, {
      status: 'published',
    });
  } else {
    updatePost(post.id, { status: 'failed' });
  }

  post.providerPostId = result.postId;
  post.providerUrl = result.postUrl;
  post.error = result.error;

  return { success: result.success, post, result };
}

/**
 * Create and schedule a post for later publishing.
 */
export function schedulePost(
  platform: SocialPlatform,
  text: string,
  scheduledAt: number,
  options?: {
    postType?: PostType;
    imageUrl?: string;
    linkUrl?: string;
    linkTitle?: string;
    priority?: PostPriority;
    clientId?: string;
    hashtags?: string[];
    tags?: string[];
  },
): SocialMediaPost {
  return createPost({
    platform,
    postType: options?.postType || 'text',
    text,
    imageUrl: options?.imageUrl,
    linkUrl: options?.linkUrl,
    linkTitle: options?.linkTitle,
    scheduledAt,
    priority: options?.priority || 'normal',
    timezone: 'Asia/Kolkata',
    tags: options?.tags || [],
    hashtags: options?.hashtags || [],
    notes: '',
    createdBy: 'system',
  });
}

/**
 * Cross-post the same content to multiple platforms.
 */
export async function crossPost(
  platforms: SocialPlatform[],
  text: string,
  options?: {
    imageUrl?: string;
    linkUrl?: string;
    scheduledAt?: number;
    clientId?: string;
  },
): Promise<Array<{ platform: SocialPlatform; success: boolean; postId?: string; error?: string }>> {
  const results: Array<{ platform: SocialPlatform; success: boolean; postId?: string; error?: string }> = [];

  for (const platform of platforms) {
    if (options?.scheduledAt) {
      const post = schedulePost(platform, text, options.scheduledAt, {
        imageUrl: options.imageUrl,
        linkUrl: options.linkUrl,
        clientId: options.clientId,
      });
      results.push({ platform, success: true, postId: post.id });
    } else {
      const { result } = await quickPost(platform, text, {
        imageUrl: options?.imageUrl,
        linkUrl: options?.linkUrl,
        clientId: options?.clientId,
      });
      results.push({ platform, success: result.success, postId: result.postId, error: result.error });
    }
  }

  log.info('Cross-post complete', { platforms, results: results.map((r) => `${r.platform}:${r.success ? 'ok' : 'fail'}`) });
  return results;
}
