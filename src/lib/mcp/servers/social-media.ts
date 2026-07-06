// ═══════════════════════════════════════
// ORACLE — Social Media MCP Server
// Post creation · Scheduling · Publishing · Analytics
// ═══════════════════════════════════════

import { McpServer } from '../server';
import type { Tool, ToolResult } from '../protocol';
import { createLogger } from '@/lib/logger';
import type { SocialPlatform, PostType, PostPriority } from '@/lib/social-media/types';
import {
  getPlatformStatus,
  createPost,
  quickPost,
  schedulePost as hubSchedulePost,
  crossPost,
  listPosts,
  getPost,
  updatePost,
  deletePost,
  publishPost,
  getPostStats,
  getQueue,
  processQueue,
  scheduleBulk,
} from '@/lib/social-media/hub';
import {
  collectAllAnalytics,
  getLatestSnapshot,
  getTrends,
} from '@/lib/social-media/analytics-collector';
import { postsToCSV, postsToICS } from '@/lib/social-media/calendar-export';

const log = createLogger('MCP:SocialMedia');

// ─── Helpers ──────────────────────────

const PLATFORMS: SocialPlatform[] = ['linkedin', 'instagram', 'facebook', 'whatsapp'];

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Tool Definitions ─────────────────

const PLATFORM_STATUS_TOOL: Tool = {
  name: 'social_status',
  title: 'Platform Status',
  description: 'Check which social media platforms are connected and configured (LinkedIn, Instagram, Facebook, WhatsApp).',
  inputSchema: { type: 'object', properties: {}, required: [] },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const CREATE_POST_TOOL: Tool = {
  name: 'social_create_post',
  title: 'Create Post',
  description: 'Create a new social media post as a draft. Use social_publish to send it immediately, or social_schedule to queue it for later.',
  inputSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: 'Target platform: linkedin, instagram, facebook, whatsapp', enum: ['linkedin', 'instagram', 'facebook', 'whatsapp'] },
      text: { type: 'string', description: 'Post content text' },
      postType: { type: 'string', description: 'Post type: text, image, video, link, carousel', enum: ['text', 'image', 'video', 'link', 'carousel'], default: 'text' },
      imageUrl: { type: 'string', description: 'Image URL for image/carousel posts' },
      linkUrl: { type: 'string', description: 'Link URL for link posts' },
      linkTitle: { type: 'string', description: 'Title for link posts' },
      hashtags: { type: 'string', description: 'Comma-separated hashtags (e.g., #marketing, #seo)' },
      priority: { type: 'string', description: 'Post priority: low, normal, high, urgent', enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
      clientId: { type: 'string', description: 'Client ID to associate with this post' },
      notes: { type: 'string', description: 'Internal notes about this post' },
    },
    required: ['platform', 'text'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const QUICK_POST_TOOL: Tool = {
  name: 'social_quick_post',
  title: 'Quick Post (Publish Now)',
  description: 'Create and immediately publish a post to a single platform. The post goes live right away.',
  inputSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: 'Target platform: linkedin, instagram, facebook', enum: ['linkedin', 'instagram', 'facebook'] },
      text: { type: 'string', description: 'Post content text' },
      postType: { type: 'string', description: 'Post type: text, image, link', enum: ['text', 'image', 'link'], default: 'text' },
      imageUrl: { type: 'string', description: 'Image URL for image posts' },
      linkUrl: { type: 'string', description: 'Link URL for link posts' },
      hashtags: { type: 'string', description: 'Comma-separated hashtags' },
    },
    required: ['platform', 'text'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const SCHEDULE_POST_TOOL: Tool = {
  name: 'social_schedule_post',
  title: 'Schedule Post',
  description: 'Create and schedule a post for future publishing. The post will be published automatically at the scheduled time.',
  inputSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: 'Target platform: linkedin, instagram, facebook', enum: ['linkedin', 'instagram', 'facebook'] },
      text: { type: 'string', description: 'Post content text' },
      scheduledAt: { type: 'string', description: 'When to publish (ISO 8601 date string, e.g. 2025-01-15T09:00:00)' },
      postType: { type: 'string', description: 'Post type: text, image, link', enum: ['text', 'image', 'link'], default: 'text' },
      imageUrl: { type: 'string', description: 'Image URL' },
      linkUrl: { type: 'string', description: 'Link URL' },
      hashtags: { type: 'string', description: 'Comma-separated hashtags' },
      priority: { type: 'string', description: 'Priority: low, normal, high, urgent', enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    },
    required: ['platform', 'text', 'scheduledAt'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const CROSS_POST_TOOL: Tool = {
  name: 'social_cross_post',
  title: 'Cross-Post',
  description: 'Publish the same content to multiple platforms simultaneously or schedule for later.',
  inputSchema: {
    type: 'object',
    properties: {
      platforms: { type: 'string', description: 'Comma-separated platforms (e.g. linkedin,instagram,facebook)' },
      text: { type: 'string', description: 'Post content text' },
      imageUrl: { type: 'string', description: 'Image URL' },
      linkUrl: { type: 'string', description: 'Link URL' },
      scheduledAt: { type: 'string', description: 'Schedule for later (ISO 8601). If omitted, posts immediately.' },
    },
    required: ['platforms', 'text'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const LIST_POSTS_TOOL: Tool = {
  name: 'social_list_posts',
  title: 'List Posts',
  description: 'List all posts with optional filters by platform and status.',
  inputSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: 'Filter by platform' },
      status: { type: 'string', description: 'Filter by status: draft, scheduled, published, failed', enum: ['draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'] },
      limit: { type: 'string', description: 'Max results (default 20)' },
    },
    required: [],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const GET_POST_TOOL: Tool = {
  name: 'social_get_post',
  title: 'Get Post',
  description: 'Get details of a specific post including engagement data if available.',
  inputSchema: {
    type: 'object',
    properties: {
      postId: { type: 'string', description: 'Post ID' },
    },
    required: ['postId'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const PUBLISH_POST_TOOL: Tool = {
  name: 'social_publish',
  title: 'Publish Post',
  description: 'Publish an existing draft or scheduled post immediately. Use after social_create_post to send a draft live.',
  inputSchema: {
    type: 'object',
    properties: {
      postId: { type: 'string', description: 'Post ID to publish' },
    },
    required: ['postId'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const DELETE_POST_TOOL: Tool = {
  name: 'social_delete_post',
  title: 'Delete Post',
  description: 'Delete a draft or scheduled post. Published posts cannot be deleted via API.',
  inputSchema: {
    type: 'object',
    properties: {
      postId: { type: 'string', description: 'Post ID to delete' },
    },
    required: ['postId'],
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
};

const PROCESS_QUEUE_TOOL: Tool = {
  name: 'social_process_queue',
  title: 'Process Publish Queue',
  description: 'Process all due posts in the publish queue. Manually trigger the publishing engine.',
  inputSchema: { type: 'object', properties: {}, required: [] },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const STATS_TOOL: Tool = {
  name: 'social_stats',
  title: 'Post Statistics',
  description: 'Get post count statistics by platform and status.',
  inputSchema: { type: 'object', properties: {}, required: [] },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const QUEUE_VIEW_TOOL: Tool = {
  name: 'social_queue',
  title: 'View Publish Queue',
  description: 'View all posts in the publish queue with their status and scheduled times.',
  inputSchema: { type: 'object', properties: {}, required: [] },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const BULK_SCHEDULE_TOOL: Tool = {
  name: 'social_bulk_schedule',
  title: 'Bulk Schedule Posts',
  description: 'Schedule multiple posts at once with configurable time intervals. Ideal for content calendar workflows — provide a list of posts and a start time with interval, and all posts will be scheduled automatically. Posts are JSON string in format: [{"platform":"linkedin","text":"...",...}]',
  inputSchema: {
    type: 'object',
    properties: {
      postsJson: { type: 'string', description: 'JSON array of posts: [{"platform":"linkedin","text":"Hello","hashtags":"#tag","priority":"high"}]' },
      startAt: { type: 'string', description: 'First post publish time (ISO 8601 date string, e.g. 2025-01-20T09:00:00)' },
      intervalMinutes: { type: 'string', description: 'Minutes between each post (e.g. "120" for 2-hour gaps). Default: 60' },
    },
    required: ['postsJson', 'startAt'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const BULK_UPDATE_TOOL: Tool = {
  name: 'social_bulk_update',
  title: 'Bulk Update Posts',
  description: 'Update multiple posts at once — change priority, status, hashtags, notes, text, imageUrl, or tags. Pass a JSON array of post IDs and a JSON object with the fields to update.',
  inputSchema: {
    type: 'object',
    properties: {
      postIdsJson: { type: 'string', description: 'JSON array of post IDs to update: ["post_abc","post_def"]' },
      updatesJson: { type: 'string', description: 'JSON object with fields to update: {"priority":"high","hashtags":["#new"],"status":"cancelled"}' },
    },
    required: ['postIdsJson', 'updatesJson'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
};

const BULK_DELETE_TOOL: Tool = {
  name: 'social_bulk_delete',
  title: 'Bulk Delete Posts',
  description: 'Delete multiple draft or scheduled posts at once for calendar cleanup. Pass a JSON array of post IDs. Published posts cannot be deleted via API.',
  inputSchema: {
    type: 'object',
    properties: {
      postIdsJson: { type: 'string', description: 'JSON array of post IDs to delete: ["post_abc","post_def"]' },
    },
    required: ['postIdsJson'],
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
};

const EXPORT_CALENDAR_TOOL: Tool = {
  name: 'social_export_calendar',
  title: 'Export Content Calendar',
  description: 'Export scheduled/draft posts as CSV or ICS (iCalendar) format. CSV includes columns for platform, text, status, hashtags, scheduled time. ICS creates calendar events for each scheduled post.',
  inputSchema: {
    type: 'object',
    properties: {
      format: { type: 'string', description: 'Export format: csv or ics', enum: ['csv', 'ics'], default: 'csv' },
      platform: { type: 'string', description: 'Filter by platform (optional)' },
      status: { type: 'string', description: 'Filter by status (optional)' },
    },
    required: [],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const ANALYTICS_COLLECT_TOOL: Tool = {
  name: 'social_collect_analytics',
  title: 'Collect Analytics',
  description: 'Fetch fresh engagement data from all configured platforms and store a snapshot.',
  inputSchema: { type: 'object', properties: {}, required: [] },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};

const ANALYTICS_LATEST_TOOL: Tool = {
  name: 'social_analytics',
  title: 'View Analytics',
  description: 'View the latest analytics snapshot showing followers, impressions, engagement, and top posts per platform.',
  inputSchema: { type: 'object', properties: {}, required: [] },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const ANALYTICS_TRENDS_TOOL: Tool = {
  name: 'social_trends',
  title: 'View Trends',
  description: 'View analytics trends comparing the two most recent snapshots (follower growth, engagement changes, etc.).',
  inputSchema: { type: 'object', properties: {}, required: [] },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

// ─── Server Factory ───────────────────

export function createSocialMediaMcpServer(): McpServer {
  const server = new McpServer('social-media-mcp', '1.0.0', {
    tools: { listChanged: false },
  });

  // ── Platform Status ──────────────

  server.registerTool(PLATFORM_STATUS_TOOL, async () => {
    const status = getPlatformStatus();
    const lines = ['═══ PLATFORM STATUS ═══', ''];
    for (const [key, info] of Object.entries(status)) {
      const icon = info.configured ? '✅' : '⬜';
      lines.push(`${icon} ${info.name} — ${info.configured ? 'Connected' : 'Not configured'}`);
    }
    lines.push('', 'Configure platform credentials in Settings → API Keys to enable posting.');
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  // ── Create Post (Draft) ──────────

  server.registerTool(CREATE_POST_TOOL, async (args) => {
    const platform = args.platform as SocialPlatform;
    const text = args.text as string;
    if (!PLATFORMS.includes(platform)) {
      return { content: [{ type: 'text', text: `Invalid platform: ${platform}. Must be one of: ${PLATFORMS.join(', ')}` }], isError: true };
    }

    const hashtags = args.hashtags ? (args.hashtags as string).split(/[,\s]+/).filter((h: string) => h.startsWith('#')) : [];

    const post = createPost({
      platform,
      postType: (args.postType as PostType) || 'text',
      text,
      imageUrl: args.imageUrl as string | undefined,
      linkUrl: args.linkUrl as string | undefined,
      linkTitle: args.linkTitle as string | undefined,
      priority: (args.priority as PostPriority) || 'normal',
      timezone: 'Asia/Kolkata',
      tags: [],
      hashtags,
      notes: (args.notes as string) || '',
      clientId: args.clientId as string | undefined,
      createdBy: 'mcp-agent',
    });

    log.info('Post created via MCP', { id: post.id, platform, status: post.status });

    return {
      content: [{
        type: 'text',
        text: [
          `Post created as ${post.status}.`,
          `ID: ${post.id}`,
          `Platform: ${platform}`,
          `Type: ${post.postType}`,
          `Priority: ${post.priority}`,
          `Text: ${text.slice(0, 200)}${text.length > 200 ? '…' : ''}`,
          hashtags.length > 0 ? `Hashtags: ${hashtags.join(' ')}` : '',
          '',
          `Use social_publish or social_schedule_post to publish.`,
        ].filter(Boolean).join('\n'),
      }],
    };
  });

  // ── Quick Post (Publish Now) ─────

  server.registerTool(QUICK_POST_TOOL, async (args) => {
    const platform = args.platform as SocialPlatform;
    const text = args.text as string;

    if (!['linkedin', 'instagram', 'facebook'].includes(platform)) {
      return { content: [{ type: 'text', text: `Platform ${platform} does not support quick posting. Use whatsapp for WhatsApp posts.` }], isError: true };
    }

    const hashtags = args.hashtags ? (args.hashtags as string).split(/[,\s]+/).filter((h: string) => h.startsWith('#')) : [];

    const result = await quickPost(platform, text, {
      postType: (args.postType as PostType) || 'text',
      imageUrl: args.imageUrl as string | undefined,
      linkUrl: args.linkUrl as string | undefined,
      hashtags,
    });

    const status = result.success ? '✅ Published' : '❌ Failed';
    const lines = [
      `${status}`,
      `Platform: ${platform}`,
      `Post ID: ${result.post.id}`,
      result.result.postId ? `Provider ID: ${result.result.postId}` : '',
      result.result.postUrl ? `URL: ${result.result.postUrl}` : '',
      result.result.error ? `Error: ${result.result.error}` : '',
    ];

    return { content: [{ type: 'text', text: lines.filter(Boolean).join('\n') }] };
  });

  // ── Schedule Post ────────────────

  server.registerTool(SCHEDULE_POST_TOOL, async (args) => {
    const platform = args.platform as SocialPlatform;
    const text = args.text as string;
    const scheduledAtStr = args.scheduledAt as string;

    if (!['linkedin', 'instagram', 'facebook'].includes(platform)) {
      return { content: [{ type: 'text', text: `Platform ${platform} does not support scheduling.` }], isError: true };
    }

    const scheduledAt = new Date(scheduledAtStr).getTime();
    if (isNaN(scheduledAt) || scheduledAt <= Date.now()) {
      return { content: [{ type: 'text', text: `Invalid scheduled time: ${scheduledAtStr}. Must be a future date.` }], isError: true };
    }

    const hashtags = args.hashtags ? (args.hashtags as string).split(/[,\s]+/).filter((h: string) => h.startsWith('#')) : [];

    const post = hubSchedulePost(platform, text, scheduledAt, {
      postType: (args.postType as PostType) || 'text',
      imageUrl: args.imageUrl as string | undefined,
      linkUrl: args.linkUrl as string | undefined,
      hashtags,
      priority: (args.priority as PostPriority) || 'normal',
    });

    return {
      content: [{
        type: 'text',
        text: [
          `Post scheduled.`,
          `ID: ${post.id}`,
          `Platform: ${platform}`,
          `Scheduled for: ${formatDate(scheduledAt)}`,
          `Status: ${post.status}`,
          `Text: ${text.slice(0, 200)}${text.length > 200 ? '…' : ''}`,
        ].join('\n'),
      }],
    };
  });

  // ── Cross-Post ───────────────────

  server.registerTool(CROSS_POST_TOOL, async (args) => {
    const platformsStr = args.platforms as string;
    const platforms = platformsStr.split(/[,\s]+/).filter(Boolean) as SocialPlatform[];
    const text = args.text as string;

    const invalid = platforms.filter((p) => !['linkedin', 'instagram', 'facebook', 'whatsapp'].includes(p));
    if (invalid.length > 0) {
      return { content: [{ type: 'text', text: `Invalid platforms: ${invalid.join(', ')}` }], isError: true };
    }

    const scheduledAt = args.scheduledAt ? new Date(args.scheduledAt as string).getTime() : undefined;

    const results = await crossPost(platforms, text, {
      imageUrl: args.imageUrl as string | undefined,
      linkUrl: args.linkUrl as string | undefined,
      scheduledAt,
    });

    const isScheduled = !!scheduledAt;
    const lines = ['═══ CROSS-POST RESULTS ═══', ''];
    for (const r of results) {
      const icon = r.success ? (isScheduled ? '📅' : '✅') : '❌';
      const label = r.success ? (isScheduled ? 'Scheduled' : 'Published') : (r.error || 'Failed');
      lines.push(`${icon} ${r.platform} — ${label}`);
      if (r.postId) lines.push(`   Post ID: ${r.postId}`);
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  // ── List Posts ───────────────────

  server.registerTool(LIST_POSTS_TOOL, async (args) => {
    const posts = listPosts({
      platform: args.platform as SocialPlatform | undefined,
      status: args.status as 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled' | undefined,
      limit: args.limit ? parseInt(args.limit as string, 10) : 20,
    });

    if (posts.length === 0) {
      return { content: [{ type: 'text', text: 'No posts found matching criteria.' }] };
    }

    const platformIcons: Record<string, string> = { linkedin: '💼', instagram: '📸', facebook: '📘', whatsapp: '💬' };
    const statusIcons: Record<string, string> = { draft: '📝', scheduled: '📅', publishing: '🔄', published: '✅', failed: '❌', cancelled: '🚫' };

    const lines = [`═══ POSTS (${posts.length}) ═══`, ''];
    for (const post of posts) {
      const icon = platformIcons[post.platform] || '📱';
      const sIcon = statusIcons[post.status] || '❓';
      lines.push(`${icon} ${sIcon} [${post.id.slice(0, 16)}…] ${post.status} — ${post.platform} (${post.postType})`);
      lines.push(`   ${post.text.slice(0, 120)}${post.text.length > 120 ? '…' : ''}`);
      if (post.scheduledAt) lines.push(`   📅 Scheduled: ${formatDate(post.scheduledAt)}`);
      if (post.publishedAt) lines.push(`   ✅ Published: ${formatDate(post.publishedAt)}`);
      if (post.engagement) lines.push(`   📊 Engagement: ${post.engagement.likes} likes, ${post.engagement.comments} comments, ${post.engagement.shares} shares`);
      lines.push('');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  // ── Get Post ─────────────────────

  server.registerTool(GET_POST_TOOL, async (args) => {
    const post = getPost(args.postId as string);
    if (!post) {
      return { content: [{ type: 'text', text: `Post not found: ${args.postId}` }], isError: true };
    }

    const lines = [
      '═══ POST DETAILS ═══',
      '',
      `ID: ${post.id}`,
      `Platform: ${post.platform}`,
      `Type: ${post.postType}`,
      `Status: ${post.status}`,
      `Priority: ${post.priority}`,
      `Created: ${formatDate(post.createdAt)}`,
      post.scheduledAt ? `Scheduled: ${formatDate(post.scheduledAt)}` : '',
      post.publishedAt ? `Published: ${formatDate(post.publishedAt)}` : '',
      '',
      `── Content ──`,
      post.text,
      '',
      post.hashtags.length > 0 ? `Hashtags: ${post.hashtags.join(' ')}` : '',
      post.imageUrl ? `Image: ${post.imageUrl}` : '',
      post.linkUrl ? `Link: ${post.linkUrl}` : '',
      post.providerPostId ? `Provider ID: ${post.providerPostId}` : '',
      post.providerUrl ? `Provider URL: ${post.providerUrl}` : '',
      post.error ? `\nError: ${post.error}` : '',
    ];

    if (post.engagement) {
      lines.push(
        '',
        '── Engagement ──',
        `Impressions: ${post.engagement.impressions.toLocaleString()}`,
        `Likes: ${post.engagement.likes.toLocaleString()}`,
        `Comments: ${post.engagement.comments.toLocaleString()}`,
        `Shares: ${post.engagement.shares.toLocaleString()}`,
        `Engagement Rate: ${post.engagement.engagementRate.toFixed(2)}%`,
      );
    }

    return { content: [{ type: 'text', text: lines.filter(Boolean).join('\n') }] };
  });

  // ── Publish Post (Draft → Live) ──

  server.registerTool(PUBLISH_POST_TOOL, async (args) => {
    const postId = args.postId as string;
    const post = getPost(postId);
    if (!post) {
      return { content: [{ type: 'text', text: `Post not found: ${postId}` }], isError: true };
    }

    if (post.status === 'published') {
      return { content: [{ type: 'text', text: `Post ${postId} is already published.` }] };
    }

    if (!['linkedin', 'instagram', 'facebook'].includes(post.platform)) {
      return { content: [{ type: 'text', text: `Platform ${post.platform} does not support direct publishing via API.` }], isError: true };
    }

    try {
      const result = await publishPost(post);

      if (result.success) {
        updatePost(post.id, { status: 'published' });
        post.providerPostId = result.postId;
        post.providerUrl = result.postUrl;
      } else {
        updatePost(post.id, { status: 'failed' });
        post.error = result.error;
      }

      const status = result.success ? '✅ Published' : '❌ Failed';
      const lines = [
        status,
        `Post ID: ${post.id}`,
        `Platform: ${post.platform}`,
        result.postId ? `Provider ID: ${result.postId}` : '',
        result.postUrl ? `URL: ${result.postUrl}` : '',
        result.error ? `Error: ${result.error}` : '',
      ];

      return { content: [{ type: 'text', text: lines.filter(Boolean).join('\n') }] };
    } catch (error) {
      updatePost(post.id, { status: 'failed' });
      post.error = error instanceof Error ? error.message : 'Unknown error';
      return { content: [{ type: 'text', text: `❌ Publish failed: ${post.error}` }], isError: true };
    }
  });

  // ── Delete Post ──────────────────

  server.registerTool(DELETE_POST_TOOL, async (args) => {
    const success = deletePost(args.postId as string);
    if (!success) {
      return { content: [{ type: 'text', text: `Post not found or could not be deleted: ${args.postId}` }], isError: true };
    }
    return { content: [{ type: 'text', text: `Post deleted: ${args.postId}` }] };
  });

  // ── Process Queue ────────────────

  server.registerTool(PROCESS_QUEUE_TOOL, async () => {
    const result = await processQueue();
    return {
      content: [{
        type: 'text',
        text: [
          '═══ QUEUE PROCESSING ═══',
          '',
          `Published: ${result.published}`,
          `Failed: ${result.failed}`,
          `Skipped: ${result.skipped}`,
        ].join('\n'),
      }],
    };
  });

  // ── Stats ────────────────────────

  server.registerTool(STATS_TOOL, async () => {
    const stats = getPostStats();
    const platformIcons: Record<string, string> = { linkedin: '💼', instagram: '📸', facebook: '📘', whatsapp: '💬' };

    const lines = [
      '═══ POST STATISTICS ═══',
      '',
      `Total Posts: ${stats.total}`,
      `Published: ${stats.publishedCount}`,
      `Scheduled: ${stats.scheduledCount}`,
      `Failed: ${stats.failedCount}`,
      '',
      '── By Platform ──',
    ];

    for (const [platform, count] of Object.entries(stats.byPlatform)) {
      lines.push(`${platformIcons[platform] || '📱'} ${platform}: ${count}`);
    }

    lines.push('', '── By Status ──');
    for (const [status, count] of Object.entries(stats.byStatus)) {
      lines.push(`${status}: ${count}`);
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  // ── Queue View ───────────────────

  server.registerTool(QUEUE_VIEW_TOOL, async () => {
    const queue = getQueue();

    if (queue.length === 0) {
      return { content: [{ type: 'text', text: 'Publish queue is empty.' }] };
    }

    const platformIcons: Record<string, string> = { linkedin: '💼', instagram: '📸', facebook: '📘', whatsapp: '💬' };

    const lines = [`═══ PUBLISH QUEUE (${queue.length}) ═══`, ''];
    for (const item of queue) {
      const icon = platformIcons[item.platform] || '📱';
      const scheduledStr = item.scheduledAt <= Date.now() ? 'Now' : formatDate(item.scheduledAt);
      lines.push(`${icon} [${item.postId.slice(0, 16)}…] ${item.status} — ${item.platform}`);
      lines.push(`   Priority: ${item.priority} | Attempts: ${item.attempts} | Next: ${scheduledStr}`);
      if (item.error) lines.push(`   Error: ${item.error}`);
      lines.push('');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  // ── Bulk Schedule ────────────────

  server.registerTool(BULK_SCHEDULE_TOOL, async (args) => {
    const postsJson = args.postsJson as string;
    let postsData: Array<{
      platform: string;
      text: string;
      postType?: string;
      imageUrl?: string;
      linkUrl?: string;
      hashtags?: string;
      priority?: string;
    }>;
    try {
      postsData = JSON.parse(postsJson);
    } catch {
      return { content: [{ type: 'text', text: 'Invalid posts JSON. Provide a valid JSON array of posts.' }], isError: true };
    }

    if (!Array.isArray(postsData) || postsData.length === 0) {
      return { content: [{ type: 'text', text: 'No posts provided. Pass a JSON array with at least one post.' }], isError: true };
    }

    const startAtStr = args.startAt as string;
    const startAt = new Date(startAtStr).getTime();
    if (isNaN(startAt) || startAt <= Date.now()) {
      return { content: [{ type: 'text', text: `Invalid start time: ${startAtStr}. Must be a future date.` }], isError: true };
    }

    const intervalMinutes = args.intervalMinutes ? parseInt(args.intervalMinutes as string, 10) : 60;
    if (isNaN(intervalMinutes) || intervalMinutes < 5) {
      return { content: [{ type: 'text', text: `Invalid interval: ${args.intervalMinutes} minutes. Minimum is 5 minutes.` }], isError: true };
    }

    // Validate platforms and build post data
    const validPlatforms = ['linkedin', 'instagram', 'facebook'];
    const invalidPlatforms: string[] = [];
    for (let i = 0; i < postsData.length; i++) {
      if (!validPlatforms.includes(postsData[i].platform)) {
        invalidPlatforms.push(`#${i + 1} (${postsData[i].platform})`);
      }
    }
    if (invalidPlatforms.length > 0) {
      return { content: [{ type: 'text', text: `Invalid platform(s): ${invalidPlatforms.join(', ')}. Must be one of: ${validPlatforms.join(', ')}` }], isError: true };
    }

    const postData = postsData.map((p) => {
      const hashtags = p.hashtags ? p.hashtags.split(/[,\s]+/).filter((h: string) => h.startsWith('#')) : [];
      return {
        platform: p.platform as SocialPlatform,
        postType: (p.postType as PostType) || 'text',
        text: p.text,
        imageUrl: p.imageUrl,
        linkUrl: p.linkUrl,
        priority: (p.priority as PostPriority) || 'normal',
        timezone: 'Asia/Kolkata',
        tags: [],
        hashtags,
        notes: '',
        createdBy: 'mcp-agent',
      };
    });

    const posts = scheduleBulk(postData, { startAt, intervalMinutes });

    const platformIcons: Record<string, string> = { linkedin: '💼', instagram: '📸', facebook: '📘' };
    const lines = [
      '═══ BULK SCHEDULE ═══',
      '',
      `${posts.length} posts scheduled`,
      `Starts: ${formatDate(startAt)}`,
      `Interval: ${intervalMinutes} minutes`,
      '',
    ];

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const icon = platformIcons[post.platform] || '📱';
      const time = new Date(startAt + i * intervalMinutes * 60_000);
      lines.push(`${icon} #${i + 1} [${post.id}] — ${post.platform}`);
      lines.push(`   ${post.text.slice(0, 80)}${post.text.length > 80 ? '…' : ''}`);
      lines.push(`   📅 ${formatDate(time.getTime())}`);
      lines.push('');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  // ── Bulk Update ──────────────────

  server.registerTool(BULK_UPDATE_TOOL, async (args) => {
    const postIdsJson = args.postIdsJson as string;
    const updatesJson = args.updatesJson as string;

    let postIds: string[];
    try {
      postIds = JSON.parse(postIdsJson);
    } catch {
      return { content: [{ type: 'text', text: 'Invalid post IDs JSON. Provide a valid JSON array of post ID strings.' }], isError: true };
    }

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return { content: [{ type: 'text', text: 'No post IDs provided. Pass a JSON array with at least one ID.' }], isError: true };
    }

    let rawUpdates: Record<string, unknown>;
    try {
      rawUpdates = JSON.parse(updatesJson);
    } catch {
      return { content: [{ type: 'text', text: 'Invalid updates JSON. Provide a valid JSON object with fields to update.' }], isError: true };
    }

    if (typeof rawUpdates !== 'object' || rawUpdates === null || Array.isArray(rawUpdates)) {
      return { content: [{ type: 'text', text: 'Updates must be a JSON object, not an array or primitive.' }], isError: true };
    }

    // Build allowed updates from the raw input
    const allowedFields = ['priority', 'status', 'hashtags', 'notes', 'text', 'imageUrl', 'tags'] as const;
    const updates: Record<string, unknown> = {};
    const ignoredFields: string[] = [];

    for (const [key, value] of Object.entries(rawUpdates)) {
      if (allowedFields.includes(key as typeof allowedFields[number])) {
        updates[key] = value;
      } else {
        ignoredFields.push(key);
      }
    }

    if (Object.keys(updates).length === 0) {
      return { content: [{ type: 'text', text: `No valid update fields provided. Allowed: ${allowedFields.join(', ')}` }], isError: true };
    }

    // Validate priority
    if (updates.priority && !['low', 'normal', 'high', 'urgent'].includes(updates.priority as string)) {
      return { content: [{ type: 'text', text: `Invalid priority: ${updates.priority}. Must be one of: low, normal, high, urgent` }], isError: true };
    }

    // Validate status
    if (updates.status && !['draft', 'scheduled', 'cancelled'].includes(updates.status as string)) {
      return { content: [{ type: 'text', text: `Invalid status: ${updates.status}. Only draft, scheduled, or cancelled can be set via bulk update.` }], isError: true };
    }

    let updated = 0;
    let notFound = 0;
    const updatedIds: string[] = [];
    const notFoundIds: string[] = [];

    for (const id of postIds) {
      if (typeof id !== 'string' || !id.startsWith('post_')) {
        notFound++;
        notFoundIds.push(id);
        continue;
      }
      const result = updatePost(id, updates as Parameters<typeof updatePost>[1]);
      if (result) {
        updated++;
        updatedIds.push(id);
      } else {
        notFound++;
        notFoundIds.push(id);
      }
    }

    const lines = [
      '═══ BULK UPDATE RESULTS ═══',
      '',
      `Updated: ${updated}`,
      `Not found: ${notFound}`,
      `Total processed: ${postIds.length}`,
      `Fields changed: ${Object.keys(updates).join(', ')}`,
    ];

    if (ignoredFields.length > 0) {
      lines.push(`Ignored fields: ${ignoredFields.join(', ')}`);
    }

    if (updatedIds.length > 0) {
      lines.push('', '── Updated ──');
      for (const id of updatedIds) {
        lines.push(`  ✅ ${id}`);
      }
    }

    if (notFoundIds.length > 0) {
      lines.push('', '── Not Found ──');
      for (const id of notFoundIds) {
        lines.push(`  ❌ ${id}`);
      }
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  // ── Bulk Delete ──────────────────

  server.registerTool(BULK_DELETE_TOOL, async (args) => {
    const postIdsJson = args.postIdsJson as string;
    let postIds: string[];
    try {
      postIds = JSON.parse(postIdsJson);
    } catch {
      return { content: [{ type: 'text', text: 'Invalid post IDs JSON. Provide a valid JSON array of post ID strings.' }], isError: true };
    }

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return { content: [{ type: 'text', text: 'No post IDs provided. Pass a JSON array with at least one ID.' }], isError: true };
    }

    let deleted = 0;
    let notFound = 0;
    const notFoundIds: string[] = [];
    const deletedIds: string[] = [];

    for (const id of postIds) {
      if (typeof id !== 'string' || !id.startsWith('post_')) {
        notFound++;
        notFoundIds.push(id);
        continue;
      }
      const success = deletePost(id);
      if (success) {
        deleted++;
        deletedIds.push(id);
      } else {
        notFound++;
        notFoundIds.push(id);
      }
    }

    const lines = ['═══ BULK DELETE RESULTS ═══', '', `Deleted: ${deleted}`, `Not found: ${notFound}`, `Total processed: ${postIds.length}`];

    if (deletedIds.length > 0) {
      lines.push('', '── Deleted ──');
      for (const id of deletedIds) {
        lines.push(`  ✅ ${id}`);
      }
    }

    if (notFoundIds.length > 0) {
      lines.push('', '── Not Found ──');
      for (const id of notFoundIds) {
        lines.push(`  ❌ ${id}`);
      }
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  // ── Export Calendar ──────────────

  server.registerTool(EXPORT_CALENDAR_TOOL, async (args) => {
    const format = (args.format as string) || 'csv';
    const posts = listPosts({
      platform: args.platform as SocialPlatform | undefined,
      status: args.status as 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled' | undefined,
      limit: 500,
    });

    if (posts.length === 0) {
      return { content: [{ type: 'text', text: 'No posts found to export. Create some posts first.' }] };
    }

    const platformIcons: Record<string, string> = { linkedin: '💼', instagram: '📸', facebook: '📘', whatsapp: '💬' };

    if (format === 'ics') {
      const icsContent = postsToICS(posts);
      return {
        content: [{
          type: 'text',
          text: [
            `═══ ICS EXPORT (${posts.length} events) ═══`,
            '',
            'Generated iCalendar file content:',
            '',
            icsContent,
            '',
            'Copy the content above and save as a .ics file, or import into Google Calendar / Outlook.',
          ].join('\n'),
        }],
      };
    }

    // CSV format
    const csvContent = postsToCSV(posts);
    const byPlatform = posts.reduce<Record<string, number>>((acc, p) => { acc[p.platform] = (acc[p.platform] || 0) + 1; return acc; }, {});
    const lines = [
      `═══ CSV EXPORT (${posts.length} posts) ═══`,
      '',
      'CSV Content:',
      '',
      csvContent,
      '',
      '── Summary ──',
    ];
    for (const [platform, count] of Object.entries(byPlatform)) {
      lines.push(`${platformIcons[platform] || '📱'} ${platform}: ${count}`);
    }
    lines.push('', 'Copy the CSV content above and save as a .csv file.');
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  // ── Analytics Collect ────────────

  server.registerTool(ANALYTICS_COLLECT_TOOL, async () => {
    const snapshot = await collectAllAnalytics();

    const lines = ['═══ ANALYTICS COLLECTED ═══', '', `Snapshot ID: ${snapshot.id}`, ''];

    for (const [platform, data] of Object.entries(snapshot.platforms)) {
      if (platform === 'whatsapp') continue;
      if (!data) {
        lines.push(`${platform}: Not configured`);
        continue;
      }
      if (data.success) {
        lines.push(`${data.platform}: ✅`);
        lines.push(`  Followers: ${data.totalFollowers.toLocaleString()}`);
        lines.push(`  Impressions: ${data.totalImpressions.toLocaleString()}`);
        lines.push(`  Engagement: ${data.totalEngagement.toLocaleString()}`);
        lines.push(`  Avg Rate: ${data.avgEngagementRate.toFixed(2)}%`);
      } else {
        lines.push(`${platform}: ❌ ${data.error}`);
      }
      lines.push('');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  // ── Analytics Latest ─────────────

  server.registerTool(ANALYTICS_LATEST_TOOL, async () => {
    const snapshot = getLatestSnapshot();
    if (!snapshot) {
      return { content: [{ type: 'text', text: 'No analytics data available. Run social_collect_analytics first.' }] };
    }

    const lines = [`═══ LATEST ANALYTICS ═══`, '', `Collected: ${formatDate(snapshot.collectedAt)}`, ''];

    for (const [platform, data] of Object.entries(snapshot.platforms)) {
      if (platform === 'whatsapp') continue;
      if (!data) continue;
      if (!data.success) {
        lines.push(`${platform}: ❌ ${data.error}`);
        continue;
      }
      lines.push(`${data.platform.toUpperCase()}`);
      lines.push(`  👥 Followers: ${data.totalFollowers.toLocaleString()}`);
      lines.push(`  👁 Impressions: ${data.totalImpressions.toLocaleString()}`);
      lines.push(`  📊 Engagement: ${data.totalEngagement.toLocaleString()}`);
      lines.push(`  📈 Avg Rate: ${data.avgEngagementRate.toFixed(2)}%`);
      if (data.topPosts.length > 0) {
        lines.push(`  🏆 Top Post: ${data.topPosts[0].likes} likes, ${data.topPosts[0].comments} comments`);
      }
      lines.push('');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  // ── Analytics Trends ─────────────

  server.registerTool(ANALYTICS_TRENDS_TOOL, async () => {
    const trends = getTrends();
    if (trends.length === 0) {
      return { content: [{ type: 'text', text: 'No trend data available. Need at least 2 analytics snapshots.' }] };
    }

    const directionIcon: Record<string, string> = { up: '📈', down: '📉', flat: '➡️' };
    const lines = ['═══ ANALYTICS TRENDS ═══', ''];

    for (const trend of trends) {
      const icon = directionIcon[trend.direction] || '➡️';
      const changeStr = trend.changePercent > 0 ? `+${trend.changePercent.toFixed(1)}%` : `${trend.changePercent.toFixed(1)}%`;
      lines.push(`${icon} ${trend.platform} — ${trend.metric}: ${trend.current.toLocaleString()} (${changeStr})`);
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  });

  return server;
}
