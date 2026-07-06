// ═══════════════════════════════════════
// ORACLE — Facebook Page API Client
// Page posts · Text · Image · Link posts
// ═══════════════════════════════════════

import { fetchWithTimeout, TIMEOUT_MODERATE_MS } from '@/lib/fetch-utils';
import { createLogger } from '@/lib/logger';
import type { FacebookConfig } from './types';

const log = createLogger('Facebook');

// ─── Types ────────────────────────────

export interface FacebookPostResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface FacebookEngagement {
  postId: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  reactions: number;
  totalEngagement: number;
}

export interface FacebookPageStats {
  followers: number;
  impressions: number;
  reach: number;
  engagement: number;
  pageViews: number;
}

// ─── Helpers ──────────────────────────

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

function getConfig(): FacebookConfig | null {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;

  if (!accessToken || !pageId) return null;

  return { accessToken, pageId };
}

// ─── Public API ───────────────────────

export function isFacebookConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Post a text update to a Facebook Page.
 */
export async function postText(
  message: string,
  options?: { pageId?: string },
): Promise<FacebookPostResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'Facebook not configured. Set FACEBOOK_PAGE_ACCESS_TOKEN and FACEBOOK_PAGE_ID.' };
  }

  const pageId = options?.pageId || config.pageId;

  try {
    const response = await fetchWithTimeout(`${GRAPH_API_BASE}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        access_token: config.accessToken,
      }),
      timeoutMs: TIMEOUT_MODERATE_MS,
    });

    const data = await response.json() as { id?: string; error?: { message: string } };

    if (!response.ok || data.error) {
      return { success: false, error: data.error?.message || `HTTP ${response.status}` };
    }

    const postId = data.id || '';
    const postUrl = postId ? `https://www.facebook.com/${postId.replace('_', '/posts/')}` : undefined;

    log.info('Facebook text post published', { postId });
    return { success: true, postId, postUrl };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

/**
 * Post an image to a Facebook Page.
 */
export async function postImage(
  imageUrl: string,
  message?: string,
  options?: { pageId?: string },
): Promise<FacebookPostResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'Facebook not configured.' };
  }

  const pageId = options?.pageId || config.pageId;

  try {
    const response = await fetchWithTimeout(`${GRAPH_API_BASE}/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: imageUrl,
        message: message || '',
        access_token: config.accessToken,
      }),
      timeoutMs: TIMEOUT_MODERATE_MS,
    });

    const data = await response.json() as { id?: string; error?: { message: string } };

    if (!response.ok || data.error) {
      return { success: false, error: data.error?.message || `HTTP ${response.status}` };
    }

    const postId = data.id || '';
    log.info('Facebook image post published', { postId });
    return { success: true, postId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

/**
 * Post a link share to a Facebook Page.
 */
export async function postLink(
  linkUrl: string,
  message: string,
  options?: { pageId?: string; title?: string; description?: string },
): Promise<FacebookPostResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'Facebook not configured.' };
  }

  const pageId = options?.pageId || config.pageId;

  try {
    const response = await fetchWithTimeout(`${GRAPH_API_BASE}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        link: linkUrl,
        name: options?.title,
        description: options?.description,
        access_token: config.accessToken,
      }),
      timeoutMs: TIMEOUT_MODERATE_MS,
    });

    const data = await response.json() as { id?: string; error?: { message: string } };

    if (!response.ok || data.error) {
      return { success: false, error: data.error?.message || `HTTP ${response.status}` };
    }

    const postId = data.id || '';
    const postUrl = postId ? `https://www.facebook.com/${postId.replace('_', '/posts/')}` : undefined;

    log.info('Facebook link post published', { postId });
    return { success: true, postId, postUrl };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

/**
 * Schedule a post on a Facebook Page (native scheduling).
 */
export async function schedulePost(
  message: string,
  scheduledTime: number,
  options?: { pageId?: string; link?: string; imageUrl?: string },
): Promise<FacebookPostResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'Facebook not configured.' };
  }

  const pageId = options?.pageId || config.pageId;

  try {
    const body: Record<string, unknown> = {
      message,
      published: 'false',
      scheduled_publish_time: Math.floor(scheduledTime / 1000),
      access_token: config.accessToken,
    };

    if (options?.link) body.link = options.link;

    const endpoint = options?.imageUrl
      ? `${GRAPH_API_BASE}/${pageId}/photos`
      : `${GRAPH_API_BASE}/${pageId}/feed`;

    if (options?.imageUrl) {
      (body as Record<string, unknown>).url = options.imageUrl;
    }

    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs: TIMEOUT_MODERATE_MS,
    });

    const data = await response.json() as { id?: string; error?: { message: string } };

    if (!response.ok || data.error) {
      return { success: false, error: data.error?.message || `HTTP ${response.status}` };
    }

    log.info('Facebook post scheduled', { postId: data.id, scheduledTime });
    return { success: true, postId: data.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

/**
 * Get page-level analytics (followers, impressions, reach, engagement, page views).
 */
export async function getPageAnalytics(): Promise<FacebookPageStats> {
  const config = getConfig();
  if (!config) return { followers: 0, impressions: 0, reach: 0, engagement: 0, pageViews: 0 };

  try {
    const since = Math.floor((Date.now() - 30 * 86400000) / 1000);
    const metrics = 'fan_count,page_impressions,page_reactions,page_engaged_users,page_views_total';
    const fields = metrics.split(',').join(',');

    const resp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${config.pageId}?fields=${fields}&since=${since}&access_token=${config.accessToken}`,
      { timeoutMs: TIMEOUT_MODERATE_MS },
    );

    if (!resp.ok) return { followers: 0, impressions: 0, reach: 0, engagement: 0, pageViews: 0 };

    const data = await resp.json() as {
      fan_count?: number;
      page_impressions?: number;
      page_reactions?: number;
      page_engaged_users?: number;
      page_views_total?: number;
    };

    return {
      followers: data.fan_count ?? 0,
      impressions: data.page_impressions ?? 0,
      reach: 0,
      engagement: data.page_engaged_users ?? 0,
      pageViews: data.page_views_total ?? 0,
    };
  } catch {
    return { followers: 0, impressions: 0, reach: 0, engagement: 0, pageViews: 0 };
  }
}

/**
 * Get engagement metrics for a specific Facebook post.
 */
export async function getPostEngagement(postId: string): Promise<FacebookEngagement> {
  const config = getConfig();
  if (!config) {
    return { postId, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, reactions: 0, totalEngagement: 0 };
  }

  try {
    const fields = 'insights.metric(post_impressions,post_reach),reactions.summary(true),comments.summary(true),shares';
    const resp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${postId}?fields=${fields}&access_token=${config.accessToken}`,
      { timeoutMs: TIMEOUT_MODERATE_MS },
    );

    if (!resp.ok) {
      return { postId, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, reactions: 0, totalEngagement: 0 };
    }

    const data = await resp.json() as {
      insights?: {
        data?: Array<{ name: string; values?: Array<{ value: number }> }>;
      };
      reactions?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
    };

    const impressions = data.insights?.data?.find((d) => d.name === 'post_impressions')?.values?.[0]?.value ?? 0;
    const reach = data.insights?.data?.find((d) => d.name === 'post_reach')?.values?.[0]?.value ?? 0;
    const reactions = data.reactions?.summary?.total_count ?? 0;
    const comments = data.comments?.summary?.total_count ?? 0;
    const shares = data.shares?.count ?? 0;

    return {
      postId,
      impressions,
      reach,
      likes: reactions,
      comments,
      shares,
      reactions,
      totalEngagement: reactions + comments + shares,
    };
  } catch {
    return { postId, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, reactions: 0, totalEngagement: 0 };
  }
}

/**
 * List recent posts from the Facebook Page.
 */
export async function listRecentPosts(count = 10): Promise<Array<{ postId: string; message: string; createdTime: string }>> {
  const config = getConfig();
  if (!config) return [];

  try {
    const resp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${config.pageId}/feed?fields=message,created_time&limit=${count}&access_token=${config.accessToken}`,
      { timeoutMs: TIMEOUT_MODERATE_MS },
    );

    if (!resp.ok) return [];

    const data = await resp.json() as {
      data?: Array<{ id?: string; message?: string; created_time?: string }>;
    };

    return (data.data || []).map((el) => ({
      postId: el.id || '',
      message: el.message || '',
      createdTime: el.created_time || '',
    }));
  } catch {
    return [];
  }
}
