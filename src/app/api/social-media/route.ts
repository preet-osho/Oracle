// ═══════════════════════════════════════
// ORACLE — Social Media API
// CRUD · Schedule · Publish · Status
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
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
  getPlatformStatus,
  quickPost,
  crossPost,
} from '@/lib/social-media/hub';
import type { SocialPlatform, PostType, PostPriority } from '@/lib/social-media/types';

/**
 * GET /api/social-media
 * List posts, get stats, or check platform status.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'status': {
        const status = getPlatformStatus();
        return NextResponse.json({ success: true, platforms: status });
      }

      case 'stats': {
        const stats = getPostStats();
        return NextResponse.json({ success: true, stats });
      }

      case 'queue': {
        const queue = getQueue();
        return NextResponse.json({ success: true, queue });
      }

      default: {
        const platform = url.searchParams.get('platform') as SocialPlatform | null;
        const status = url.searchParams.get('status') as import('@/lib/social-media/types').PostStatus | null;
        const limit = url.searchParams.get('limit');

        const posts = listPosts({
          platform: platform || undefined,
          status: status || undefined as import('@/lib/social-media/types').PostStatus | undefined,
          limit: limit ? parseInt(limit, 10) : undefined,
        });

        return NextResponse.json({ success: true, posts, count: posts.length });
      }
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/social-media
 * Create a post, schedule, publish, or cross-post.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create': {
        const post = createPost({
          platform: data.platform as SocialPlatform,
          postType: data.postType as PostType,
          text: data.text,
          imageUrl: data.imageUrl,
          imageUrls: data.imageUrls,
          videoUrl: data.videoUrl,
          linkUrl: data.linkUrl,
          linkTitle: data.linkTitle,
          linkDescription: data.linkDescription,
          scheduledAt: data.scheduledAt,
          authorUrn: data.authorUrn,
          pageId: data.pageId,
          clientId: data.clientId,
          campaignId: data.campaignId,
          tags: data.tags || [],
          hashtags: data.hashtags || [],
          notes: data.notes || '',
          priority: (data.priority as PostPriority) || 'normal',
          timezone: data.timezone || 'Asia/Kolkata',
          engagement: undefined,
          providerPostId: undefined,
          providerUrl: undefined,
          error: undefined,
          createdBy: data.createdBy || 'api',
        });

        return NextResponse.json({ success: true, post });
      }

      case 'quick-post': {
        const result = await quickPost(
          data.platform as SocialPlatform,
          data.text,
          {
            postType: data.postType as PostType,
            imageUrl: data.imageUrl,
            linkUrl: data.linkUrl,
            linkTitle: data.linkTitle,
            priority: data.priority as PostPriority,
            clientId: data.clientId,
            hashtags: data.hashtags,
          },
        );

        return NextResponse.json(result);
      }

      case 'cross-post': {
        const results = await crossPost(
          data.platforms as SocialPlatform[],
          data.text,
          {
            imageUrl: data.imageUrl,
            linkUrl: data.linkUrl,
            scheduledAt: data.scheduledAt,
            clientId: data.clientId,
          },
        );

        return NextResponse.json({ success: true, results });
      }

      case 'schedule-bulk': {
        const posts = scheduleBulk(data.posts, {
          startAt: data.startAt,
          intervalMinutes: data.intervalMinutes,
        });

        return NextResponse.json({ success: true, posts, count: posts.length });
      }

      case 'publish': {
        const post = getPost(data.postId);
        if (!post) {
          return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
        }

        const result = await publishPost(post);
        return NextResponse.json({ success: true, result });
      }

      case 'process-queue': {
        const result = await processQueue();
        return NextResponse.json({ success: true, result });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/social-media
 * Update a post or change its status.
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { postId, ...rawUpdates } = body;

    if (!postId) {
      return NextResponse.json({ success: false, error: 'Missing postId' }, { status: 400 });
    }

    // Whitelist allowed update fields to prevent property injection
    const allowedFields = ['text', 'imageUrl', 'imageUrls', 'scheduledAt', 'status', 'tags', 'hashtags', 'notes', 'priority'] as const;
    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in rawUpdates) updates[key] = rawUpdates[key];
    }

    const post = updatePost(postId, updates as Parameters<typeof updatePost>[1]);
    if (!post) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, post });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/social-media
 * Delete a post.
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const postId = url.searchParams.get('postId');

    if (!postId) {
      return NextResponse.json({ success: false, error: 'Missing postId' }, { status: 400 });
    }

    const deleted = deletePost(postId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
