// ═══════════════════════════════════════
// ORACLE — Social Media Scheduler
// Queue management · Retry logic · Batch scheduling
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';
import { nanoid } from 'nanoid';
import type {
  SocialMediaPost,
  SocialPlatform,
  PostStatus,
  PostPriority,
  PostQueueItem,
} from './types';
import { postText as linkedinPostText, postImage as linkedinPostImage, postLink as linkedinPostLink, isLinkedInConfigured } from './linkedin';
import { postImage as instagramPostImage, postCarousel as instagramPostCarousel, postVideo as instagramPostVideo, isInstagramConfigured } from './instagram';
import { postText as facebookPostText, postImage as facebookPostImage, postLink as facebookPostLink, isFacebookConfigured } from './facebook';
import { sendTextMessage as whatsappSendText, isWhatsAppSocialConfigured } from './whatsapp-social';

const log = createLogger('SocialScheduler');

// ─── In-Memory Store ──────────────────

const posts = new Map<string, SocialMediaPost>();
const queue: PostQueueItem[] = [];

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 60_000; // 1 minute between retries

// ─── CRUD Operations ──────────────────

export function createPost(
  input: Omit<SocialMediaPost, 'id' | 'status' | 'retryCount' | 'maxRetries' | 'createdAt' | 'updatedAt'>,
): SocialMediaPost {
  const now = Date.now();
  const post: SocialMediaPost = {
    ...input,
    id: `post_${nanoid(12)}`,
    status: input.scheduledAt ? 'scheduled' : 'draft',
    retryCount: 0,
    maxRetries: MAX_RETRIES,
    createdAt: now,
    updatedAt: now,
  };

  posts.set(post.id, post);

  if (post.status === 'scheduled') {
    enqueue(post);
  }

  log.info('Post created', { id: post.id, platform: post.platform, status: post.status });
  return post;
}

export function getPost(id: string): SocialMediaPost | undefined {
  return posts.get(id);
}

export function updatePost(
  id: string,
  updates: Partial<Pick<SocialMediaPost, 'text' | 'imageUrl' | 'imageUrls' | 'scheduledAt' | 'status' | 'tags' | 'hashtags' | 'notes' | 'priority'>>,
): SocialMediaPost | undefined {
  const post = posts.get(id);
  if (!post) return undefined;

  Object.assign(post, updates, { updatedAt: Date.now() });

  // Re-enqueue if rescheduled
  if (updates.scheduledAt && post.status === 'scheduled') {
    enqueue(post);
  }

  return post;
}

export function deletePost(id: string): boolean {
  const post = posts.get(id);
  if (!post) return false;

  // Remove from queue
  const queueIdx = queue.findIndex((q) => q.postId === id);
  if (queueIdx !== -1) queue.splice(queueIdx, 1);

  posts.delete(id);
  return true;
}

export function listPosts(filters?: {
  platform?: SocialPlatform;
  status?: PostStatus;
  limit?: number;
}): SocialMediaPost[] {
  let result = Array.from(posts.values());

  if (filters?.platform) result = result.filter((p) => p.platform === filters.platform);
  if (filters?.status) result = result.filter((p) => p.status === filters.status);

  result.sort((a, b) => b.createdAt - a.createdAt);

  if (filters?.limit) result = result.slice(0, filters.limit);

  return result;
}

// ─── Queue Management ─────────────────

function enqueue(post: SocialMediaPost): void {
  // Remove existing queue entry
  const existingIdx = queue.findIndex((q) => q.postId === post.id);
  if (existingIdx !== -1) queue.splice(existingIdx, 1);

  const item: PostQueueItem = {
    postId: post.id,
    platform: post.platform,
    priority: post.priority,
    scheduledAt: post.scheduledAt || Date.now(),
    attempts: 0,
    status: 'pending',
  };

  queue.push(item);
  queue.sort((a, b) => {
    // Sort by priority, then by scheduled time
    const priorityOrder: Record<PostPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return a.scheduledAt - b.scheduledAt;
  });
}

export function getQueue(): PostQueueItem[] {
  return [...queue];
}

// ─── Publishing Engine ────────────────

/**
 * Process all due posts in the queue. Called by the automation scheduler.
 */
export async function processQueue(): Promise<{
  published: number;
  failed: number;
  skipped: number;
}> {
  const now = Date.now();
  let published = 0;
  let failed = 0;
  const skipped = 0;

  const dueItems = queue.filter((q) => q.status === 'pending' && q.scheduledAt <= now);

  for (const item of dueItems) {
    const post = posts.get(item.postId);
    if (!post) {
      item.status = 'failed';
      item.error = 'Post not found';
      failed++;
      continue;
    }

    item.status = 'processing';
    item.attempts++;
    item.lastAttemptAt = now;

    try {
      const result = await publishPost(post);

      if (result.success) {
        post.status = 'published';
        post.publishedAt = now;
        post.providerPostId = result.postId;
        post.providerUrl = result.postUrl;
        item.status = 'completed';
        published++;
        log.info('Post published', { id: post.id, platform: post.platform });
      } else {
        throw new Error(result.error || 'Publish failed');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      log.error('Post publish failed', { id: post.id, error: msg, attempt: item.attempts });

      if (item.attempts < post.maxRetries) {
        item.status = 'retry';
        item.nextRetryAt = now + RETRY_DELAY_MS * item.attempts;
        item.error = msg;
        post.retryCount = item.attempts;
      } else {
        post.status = 'failed';
        post.error = msg;
        item.status = 'failed';
        item.error = msg;
        failed++;
      }
    }
  }

  // Process retries
  const retryItems = queue.filter((q) => q.status === 'retry' && q.nextRetryAt && q.nextRetryAt <= now);
  for (const item of retryItems) {
    item.status = 'pending';
    item.nextRetryAt = undefined;
  }

  // Cleanup completed/failed items older than 24h
  const cutoff = now - 24 * 60 * 60 * 1000;    for (let i = queue.length - 1; i >= 0; i--) {
    const q = queue[i];
    if (q && ['completed', 'failed'].includes(q.status) && q.lastAttemptAt && q.lastAttemptAt < cutoff) {
      queue.splice(i, 1);
    }
  }

  log.info('Queue processed', { published, failed, skipped, due: dueItems.length });
  return { published, failed, skipped };
}

/**
 * Publish a single post to its platform.
 */
export async function publishPost(post: SocialMediaPost): Promise<{
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}> {
  log.info('Publishing post', { id: post.id, platform: post.platform, type: post.postType });

  switch (post.platform) {
    case 'linkedin':
      return publishToLinkedIn(post);
    case 'instagram':
      return publishToInstagram(post);
    case 'facebook':
      return publishToFacebook(post);
    case 'whatsapp':
      return publishToWhatsApp(post);
    default:
      return { success: false, error: `Unknown platform: ${post.platform}` };
  }
}

async function publishToLinkedIn(post: SocialMediaPost): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  if (!isLinkedInConfigured()) return { success: false, error: 'LinkedIn not configured' };

  switch (post.postType) {
    case 'text':
      return linkedinPostText(post.text);
    case 'image':
      return linkedinPostImage(post.text, post.imageUrl || '', { authorUrn: post.authorUrn });
    case 'link':
      return linkedinPostLink(post.text, post.linkUrl || '', {
        authorUrn: post.authorUrn,
        title: post.linkTitle,
        description: post.linkDescription,
      });
    default:
      return { success: false, error: `Unsupported LinkedIn post type: ${post.postType}` };
  }
}

async function publishToInstagram(post: SocialMediaPost): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  if (!isInstagramConfigured()) return { success: false, error: 'Instagram not configured' };

  switch (post.postType) {
    case 'image':
      return instagramPostImage(post.imageUrl || '', post.text);
    case 'carousel':
      return instagramPostCarousel(post.imageUrls || [], post.text);
    case 'video':
      return instagramPostVideo(post.videoUrl || '', post.text);
    case 'text':
      // Instagram doesn't support text-only; auto-create with placeholder
      return instagramPostImage(post.imageUrl || '', post.text);
    default:
      return { success: false, error: `Unsupported Instagram post type: ${post.postType}` };
  }
}

async function publishToFacebook(post: SocialMediaPost): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  if (!isFacebookConfigured()) return { success: false, error: 'Facebook not configured' };

  switch (post.postType) {
    case 'text':
      return facebookPostText(post.text);
    case 'image':
      return facebookPostImage(post.imageUrl || '', post.text);
    case 'link':
      return facebookPostLink(post.linkUrl || '', post.text, {
        title: post.linkTitle,
        description: post.linkDescription,
      });
    default:
      return { success: false, error: `Unsupported Facebook post type: ${post.postType}` };
  }
}

async function publishToWhatsApp(post: SocialMediaPost): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  if (!isWhatsAppSocialConfigured()) return { success: false, error: 'WhatsApp not configured' };

  const result = await whatsappSendText(post.linkUrl || '', post.text);
  return { success: result.success, postId: result.messageId, postUrl: undefined, error: result.error };
}

// ─── Bulk Scheduling ──────────────────

/**
 * Schedule multiple posts at once with configurable intervals.
 */
export function scheduleBulk(
  postData: Array<Omit<SocialMediaPost, 'id' | 'status' | 'retryCount' | 'maxRetries' | 'createdAt' | 'updatedAt'>>,
  options: {
    startAt: number;
    intervalMinutes: number;
  },
): SocialMediaPost[] {
  const results: SocialMediaPost[] = [];

  for (let i = 0; i < postData.length; i++) {
    const scheduledAt = options.startAt + i * options.intervalMinutes * 60 * 1000;

    const item = postData[i];
    if (!item) continue;
    const post = createPost({
      ...item,
      scheduledAt,
    });

    results.push(post);
  }

  log.info('Bulk posts scheduled', { count: results.length, startAt: options.startAt, interval: options.intervalMinutes });
  return results;
}

// ─── Analytics Helpers ────────────────

export function getPostStats(): {
  total: number;
  byPlatform: Record<SocialPlatform, number>;
  byStatus: Record<PostStatus, number>;
  scheduledCount: number;
  publishedCount: number;
  failedCount: number;
} {
  const allPosts = Array.from(posts.values());

  const byPlatform = {} as Record<SocialPlatform, number>;
  const byStatus = {} as Record<PostStatus, number>;

  for (const p of allPosts) {
    byPlatform[p.platform] = (byPlatform[p.platform] || 0) + 1;
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  }

  return {
    total: allPosts.length,
    byPlatform,
    byStatus,
    scheduledCount: byStatus['scheduled'] || 0,
    publishedCount: byStatus['published'] || 0,
    failedCount: byStatus['failed'] || 0,
  };
}
