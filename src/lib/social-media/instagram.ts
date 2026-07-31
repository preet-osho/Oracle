// ═══════════════════════════════════════
// ORACLE — Instagram Graph API Client
// Two-step publishing · Image & Carousel posts
// ═══════════════════════════════════════

import { fetchWithTimeout, TIMEOUT_MODERATE_MS } from '@/lib/fetch-utils';
import { createLogger } from '@/lib/logger';
import type { InstagramConfig } from './types';

const log = createLogger('Instagram');

// ─── Types ────────────────────────────

export interface InstagramPostResult {
  success: boolean;
  mediaId?: string;
  postUrl?: string;
  error?: string;
}

export interface InstagramEngagement {
  mediaId: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  totalEngagement: number;
}

export interface InstagramPageStats {
  followers: number;
  impressions: number;
  reach: number;
  profileViews: number;
  websiteClicks: number;
}

// ─── Helpers ──────────────────────────

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

function getConfig(): InstagramConfig | null {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;

  if (!accessToken || !igAccountId) return null;

  return { accessToken, igAccountId, facebookPageId: process.env.FACEBOOK_PAGE_ID };
}

function _buildParams(config: InstagramConfig, extra?: Record<string, string>): string {
  const base = new URLSearchParams({ access_token: config.accessToken });
  if (extra) {
    for (const [k, v] of Object.entries(extra)) base.set(k, v);
  }
  return base.toString();
}
 
void _buildParams;

// ─── Public API ───────────────────────

export function isInstagramConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Post an image to Instagram (two-step: create container → publish).
 */
export async function postImage(
  imageUrl: string,
  caption: string,
): Promise<InstagramPostResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'Instagram not configured. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID.' };
  }

  try {
    // Step 1: Create media container
    const containerResp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${config.igAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          access_token: config.accessToken,
        }),
        timeoutMs: TIMEOUT_MODERATE_MS,
      },
    );

    if (!containerResp.ok) {
      const body = await containerResp.json() as { error?: { message: string } };
      return { success: false, error: body.error?.message || `Container create failed: ${containerResp.status}` };
    }

    const containerData = await containerResp.json() as { id: string };
    const containerId = containerData.id;

    // Step 2: Publish the container
    const publishResp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${config.igAccountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: config.accessToken,
        }),
        timeoutMs: TIMEOUT_MODERATE_MS,
      },
    );

    if (!publishResp.ok) {
      const body = await publishResp.json() as { error?: { message: string } };
      return { success: false, error: body.error?.message || `Publish failed: ${publishResp.status}` };
    }

    const publishData = await publishResp.json() as { id: string };
    const postUrl = `https://www.instagram.com/p/${publishData.id}/`;

    log.info('Instagram image posted', { mediaId: publishData.id });
    return { success: true, mediaId: publishData.id, postUrl };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error('Instagram post error', { error: msg });
    return { success: false, error: msg };
  }
}

/**
 * Post a carousel (multiple images) to Instagram.
 */
export async function postCarousel(
  imageUrls: string[],
  caption: string,
): Promise<InstagramPostResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'Instagram not configured.' };
  }

  try {
    // Step 1: Create a container for each image
    const children: string[] = [];

    for (const url of imageUrls) {
      const resp = await fetchWithTimeout(
        `${GRAPH_API_BASE}/${config.igAccountId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: url,
            is_carousel_item: true,
            access_token: config.accessToken,
          }),
          timeoutMs: TIMEOUT_MODERATE_MS,
        },
      );

      if (!resp.ok) {
        const body = await resp.json() as { error?: { message: string } };
        return { success: false, error: body.error?.message || 'Carousel child create failed' };
      }

      const data = await resp.json() as { id: string };
      children.push(data.id);
    }

    // Step 2: Create carousel container
    const carouselResp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${config.igAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'CAROUSEL',
          children: children.join(','),
          caption,
          access_token: config.accessToken,
        }),
        timeoutMs: TIMEOUT_MODERATE_MS,
      },
    );

    if (!carouselResp.ok) {
      const body = await carouselResp.json() as { error?: { message: string } };
      return { success: false, error: body.error?.message || 'Carousel container create failed' };
    }

    const carouselData = await carouselResp.json() as { id: string };

    // Step 3: Publish carousel
    const publishResp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${config.igAccountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: carouselData.id,
          access_token: config.accessToken,
        }),
        timeoutMs: TIMEOUT_MODERATE_MS,
      },
    );

    if (!publishResp.ok) {
      const body = await publishResp.json() as { error?: { message: string } };
      return { success: false, error: body.error?.message || 'Carousel publish failed' };
    }

    const publishData = await publishResp.json() as { id: string };
    const postUrl = `https://www.instagram.com/p/${publishData.id}/`;

    log.info('Instagram carousel posted', { mediaId: publishData.id, images: imageUrls.length });
    return { success: true, mediaId: publishData.id, postUrl };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

/**
 * Post a video (Reel) to Instagram.
 */
export async function postVideo(
  videoUrl: string,
  caption: string,
): Promise<InstagramPostResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'Instagram not configured.' };
  }

  try {
    // Step 1: Create video container
    const containerResp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${config.igAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'REELS',
          video_url: videoUrl,
          caption,
          share_to_feed: true,
          access_token: config.accessToken,
        }),
        timeoutMs: TIMEOUT_MODERATE_MS,
      },
    );

    if (!containerResp.ok) {
      const body = await containerResp.json() as { error?: { message: string } };
      return { success: false, error: body.error?.message || 'Video container create failed' };
    }

    const containerData = await containerResp.json() as { id: string };

    // Wait for video processing (poll status)
    let status = 'INIT';
    let attempts = 0;
    while (status !== 'FINISHED' && attempts < 30) {
      await new Promise((r) => setTimeout(r, 5000));
      const statusResp = await fetchWithTimeout(
        `${GRAPH_API_BASE}/${containerData.id}?fields=status_code&access_token=${config.accessToken}`,
        { timeoutMs: TIMEOUT_MODERATE_MS },
      );
      const statusData = await statusResp.json() as { status_code: string };
      status = statusData.status_code;
      attempts++;
    }

    if (status !== 'FINISHED') {
      return { success: false, error: `Video processing timed out (status: ${status})` };
    }

    // Step 2: Publish
    const publishResp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${config.igAccountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: containerData.id, access_token: config.accessToken }),
        timeoutMs: TIMEOUT_MODERATE_MS,
      },
    );

    if (!publishResp.ok) {
      const body = await publishResp.json() as { error?: { message: string } };
      return { success: false, error: body.error?.message || 'Video publish failed' };
    }

    const publishData = await publishResp.json() as { id: string };
    const postUrl = `https://www.instagram.com/reel/${publishData.id}/`;

    log.info('Instagram Reel posted', { mediaId: publishData.id });
    return { success: true, mediaId: publishData.id, postUrl };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

/**
 * Check remaining publishing quota (100 posts/24h limit).
 */
export async function getPublishingQuota(): Promise<{ remaining: number; total: number; error?: string }> {
  const config = getConfig();
  if (!config) return { remaining: 0, total: 0, error: 'Instagram not configured.' };

  try {
    const resp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${config.igAccountId}/content_publishing_limit?access_token=${config.accessToken}`,
      { timeoutMs: TIMEOUT_MODERATE_MS },
    );

    if (!resp.ok) return { remaining: 0, total: 0, error: `HTTP ${resp.status}` };
    const data = await resp.json() as { data?: Array<{ quota_usage: number }> };
    const quota = data.data?.[0]?.quota_usage ?? 0;
    return { remaining: 100 - quota, total: 100 };
  } catch (error) {
    return { remaining: 0, total: 0, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

/**
 * Get page-level analytics (followers, impressions, reach, profile views, website clicks).
 */
export async function getPageAnalytics(): Promise<InstagramPageStats> {
  const config = getConfig();
  if (!config) return { followers: 0, impressions: 0, reach: 0, profileViews: 0, websiteClicks: 0 };

  try {
    const since = Math.floor((Date.now() - 30 * 86400000) / 1000);
    const fields = [
      'followers_count',
      'impressions',
      'reach',
      'profile_views',
      'website_clicks',
    ].join(',');

    const resp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${config.igAccountId}?fields=${fields}&metric_period=day&since=${since}&access_token=${config.accessToken}`,
      { timeoutMs: TIMEOUT_MODERATE_MS },
    );

    if (!resp.ok) return { followers: 0, impressions: 0, reach: 0, profileViews: 0, websiteClicks: 0 };

    const data = await resp.json() as {
      followers_count?: number;
      impressions?: number;
      reach?: number;
      profile_views?: number;
      website_clicks?: number;
    };

    return {
      followers: data.followers_count ?? 0,
      impressions: data.impressions ?? 0,
      reach: data.reach ?? 0,
      profileViews: data.profile_views ?? 0,
      websiteClicks: data.website_clicks ?? 0,
    };
  } catch {
    return { followers: 0, impressions: 0, reach: 0, profileViews: 0, websiteClicks: 0 };
  }
}

/**
 * Get engagement metrics for a specific Instagram media post.
 */
export async function getPostEngagement(mediaId: string): Promise<InstagramEngagement> {
  const config = getConfig();
  if (!config) {
    return { mediaId, impressions: 0, reach: 0, likes: 0, comments: 0, saves: 0, shares: 0, totalEngagement: 0 };
  }

  try {
    const metrics = 'impressions,reach,likes,comments,saves,shares';
    const resp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${mediaId}?fields=${metrics}&access_token=${config.accessToken}`,
      { timeoutMs: TIMEOUT_MODERATE_MS },
    );

    if (!resp.ok) {
      return { mediaId, impressions: 0, reach: 0, likes: 0, comments: 0, saves: 0, shares: 0, totalEngagement: 0 };
    }

    const data = await resp.json() as {
      impressions?: number;
      reach?: number;
      like_count?: number;
      comments_count?: number;
      save_count?: number;
    };

    const likes = data.like_count ?? 0;
    const comments = data.comments_count ?? 0;
    const saves = data.save_count ?? 0;

    return {
      mediaId,
      impressions: data.impressions ?? 0,
      reach: data.reach ?? 0,
      likes,
      comments,
      saves,
      shares: 0, // shares not available via basic display API
      totalEngagement: likes + comments + saves,
    };
  } catch {
    return { mediaId, impressions: 0, reach: 0, likes: 0, comments: 0, saves: 0, shares: 0, totalEngagement: 0 };
  }
}

/**
 * List recent media from the Instagram account.
 */
export async function listRecentMedia(count = 10): Promise<Array<{ mediaId: string; caption: string; timestamp: string }>> {
  const config = getConfig();
  if (!config) return [];

  try {
    const resp = await fetchWithTimeout(
      `${GRAPH_API_BASE}/${config.igAccountId}/media?fields=id,caption,timestamp&limit=${count}&access_token=${config.accessToken}`,
      { timeoutMs: TIMEOUT_MODERATE_MS },
    );

    if (!resp.ok) return [];

    const data = await resp.json() as {
      data?: Array<{ id?: string; caption?: string; timestamp?: string }>;
    };

    return (data.data || []).map((el) => ({
      mediaId: el.id || '',
      caption: el.caption || '',
      timestamp: el.timestamp || '',
    }));
  } catch {
    return [];
  }
}
