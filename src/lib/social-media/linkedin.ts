// ═══════════════════════════════════════
// ORACLE — LinkedIn API Client
// Posts API · OAuth2 · Text & Image posts
// ═══════════════════════════════════════

import { fetchWithTimeout, TIMEOUT_MODERATE_MS } from '@/lib/fetch-utils';
import { createLogger } from '@/lib/logger';
import type { LinkedinConfig } from './types';

const log = createLogger('LinkedIn');

// ─── Types ────────────────────────────

export interface LinkedinPostResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface LinkedinEngagement {
  postId: string;
  impressions: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  totalEngagement: number;
}

export interface LinkedinPageStats {
  followerCount: number;
  impressions: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
}

// ─── Helpers ──────────────────────────

function getConfig(): LinkedinConfig | null {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const authorUrn = process.env.LINKEDIN_AUTHOR_URN;

  if (!accessToken || !authorUrn) return null;

  return {
    accessToken,
    authorUrn,
    apiVersion: process.env.LINKEDIN_API_VERSION || '202606',
  };
}

function headers(config: LinkedinConfig): Record<string, string> {
  return {
    'Authorization': `Bearer ${config.accessToken}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': config.apiVersion || '202606',
  };
}

function extractOrgId(config: LinkedinConfig): string {
  return config.authorUrn.replace('urn:li:organization:', '');
}

// ─── Public API ───────────────────────

export function isLinkedInConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Post a text-only update to LinkedIn.
 */
export async function postText(
  text: string,
  options?: { visibility?: 'PUBLIC' | 'CONNECTIONS'; authorUrn?: string },
): Promise<LinkedinPostResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'LinkedIn not configured. Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR_URN.' };
  }

  const author = options?.authorUrn || config.authorUrn;

  try {
    const response = await fetchWithTimeout('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify({
        author,
        commentary: text,
        visibility: options?.visibility || 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED' },
        lifecycleState: 'PUBLISHED',
      }),
      timeoutMs: TIMEOUT_MODERATE_MS,
    });

    const postId = response.headers.get('x-restli-post-id') || '';
    const postUrl = postId
      ? `https://www.linkedin.com/feed/update/${postId}`
      : undefined;

    if (!response.ok && response.status !== 201) {
      const errorBody = await response.text();
      log.error('LinkedIn post failed', { status: response.status, body: errorBody });
      return { success: false, error: `HTTP ${response.status}: ${errorBody}` };
    }

    log.info('LinkedIn text post published', { postId });
    return { success: true, postId, postUrl };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error('LinkedIn post error', { error: msg });
    return { success: false, error: msg };
  }
}

/**
 * Post an image update to LinkedIn (two-step: upload image, then create post).
 */
export async function postImage(
  text: string,
  imageUrl: string,
  options?: { visibility?: 'PUBLIC' | 'CONNECTIONS'; authorUrn?: string },
): Promise<LinkedinPostResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'LinkedIn not configured.' };
  }

  const author = options?.authorUrn || config.authorUrn;

  try {
    // Step 1: Register image upload
    const registerResp = await fetchWithTimeout('https://api.linkedin.com/rest/images?action=initializeUpload', {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify({
        initializeUploadRequest: { owner: author },
      }),
      timeoutMs: TIMEOUT_MODERATE_MS,
    });

    if (!registerResp.ok) {
      const body = await registerResp.text();
      return { success: false, error: `Image register failed: ${body}` };
    }

    const registerData = await registerResp.json() as {
      value: { uploadUrl: string; image: string };
    };

    const { uploadUrl, image: imageUrn } = registerData.value;

    // Step 2: Upload binary image
    const imageResp = await fetchWithTimeout(imageUrl, { timeoutMs: TIMEOUT_MODERATE_MS });
    if (!imageResp.ok) {
      return { success: false, error: `Failed to download image: ${imageResp.status}` };
    }
    const imageBlob = await imageResp.blob();

    const uploadResp = await fetchWithTimeout(uploadUrl, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${config.accessToken}`, 'Content-Type': 'application/octet-stream' },
      body: imageBlob,
      timeoutMs: TIMEOUT_MODERATE_MS,
    });

    if (!uploadResp.ok) {
      return { success: false, error: `Image upload failed: ${uploadResp.status}` };
    }

    // Step 3: Create post with image
    const postResp = await fetchWithTimeout('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify({
        author,
        commentary: text,
        visibility: options?.visibility || 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED' },
        content: { media: { id: imageUrn } },
        lifecycleState: 'PUBLISHED',
      }),
      timeoutMs: TIMEOUT_MODERATE_MS,
    });

    const postId = postResp.headers.get('x-restli-post-id') || '';

    if (!postResp.ok && postResp.status !== 201) {
      const body = await postResp.text();
      return { success: false, error: `Post create failed: ${body}` };
    }

    const postUrl = postId ? `https://www.linkedin.com/feed/update/${postId}` : undefined;
    log.info('LinkedIn image post published', { postId });
    return { success: true, postId, postUrl };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error('LinkedIn image post error', { error: msg });
    return { success: false, error: msg };
  }
}

/**
 * Post a link share to LinkedIn.
 */
export async function postLink(
  text: string,
  linkUrl: string,
  options?: {
    visibility?: 'PUBLIC' | 'CONNECTIONS';
    authorUrn?: string;
    title?: string;
    description?: string;
  },
): Promise<LinkedinPostResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'LinkedIn not configured.' };
  }

  const author = options?.authorUrn || config.authorUrn;

  try {
    const response = await fetchWithTimeout('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify({
        author,
        commentary: text,
        visibility: options?.visibility || 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED' },
        content: {
          article: {
            source: linkUrl,
            title: options?.title,
            description: options?.description,
          },
        },
        lifecycleState: 'PUBLISHED',
      }),
      timeoutMs: TIMEOUT_MODERATE_MS,
    });

    const postId = response.headers.get('x-restli-post-id') || '';
    if (!response.ok && response.status !== 201) {
      const body = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${body}` };
    }

    const postUrl = postId ? `https://www.linkedin.com/feed/update/${postId}` : undefined;
    log.info('LinkedIn link post published', { postId });
    return { success: true, postId, postUrl };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

/**
 * Get LinkedIn page analytics (follower count, impressions, etc.).
 */
export async function getPageAnalytics(): Promise<LinkedinPageStats> {
  const config = getConfig();
  if (!config) return { followerCount: 0, impressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0 };

  try {
    const orgId = extractOrgId(config);

    // Fetch follower count + basic stats
    const [followerResp, statsResp] = await Promise.all([
      fetchWithTimeout(
        `https://api.linkedin.com/rest/organizations/${orgId}?projection=(followerCount)`,
        { headers: headers(config), timeoutMs: TIMEOUT_MODERATE_MS },
      ),
      fetchWithTimeout(
        `https://api.linkedin.com/rest/organizationStatistics/${orgId}?q=organizationalEntity&dateRange.start.day=${new Date(Date.now() - 30 * 86400000).getDate()}&dateRange.start.month=${new Date(Date.now() - 30 * 86400000).getMonth() + 1}&dateRange.start.year=${new Date(Date.now() - 30 * 86400000).getFullYear()}&dateRange.end.day=${new Date().getDate()}&dateRange.end.month=${new Date().getMonth() + 1}&dateRange.end.year=${new Date().getFullYear()}&aggregations=(standardMetric:impressions,standardMetric:clicks,standardMetric:likes,standardMetric:comments,standardMetric:shares)`,
        { headers: headers(config), timeoutMs: TIMEOUT_MODERATE_MS },
      ),
    ]);

    const followerData = followerResp.ok ? await followerResp.json() as { followerCount?: number } : {};
    const statsRaw = statsResp.ok ? await statsResp.json() as {
      elements?: Array<{
        totalImpressionsCount?: number;
        totalClicksCount?: number;
        totalLikesCount?: number;
        totalCommentsCount?: number;
        totalSharesCount?: number;
      }>;
    } : {};

    const stats = statsRaw.elements?.[0] || {};

    return {
      followerCount: followerData.followerCount ?? 0,
      impressions: stats.totalImpressionsCount ?? 0,
      clicks: stats.totalClicksCount ?? 0,
      likes: stats.totalLikesCount ?? 0,
      comments: stats.totalCommentsCount ?? 0,
      shares: stats.totalSharesCount ?? 0,
    };
  } catch (error) {
    log.error('LinkedIn analytics error', { error: error instanceof Error ? error.message : 'Unknown' });
    return { followerCount: 0, impressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0 };
  }
}

/**
 * Get engagement metrics for a specific LinkedIn post.
 */
export async function getPostEngagement(postId: string): Promise<LinkedinEngagement> {
  const config = getConfig();
  if (!config) {
    return { postId, impressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0, totalEngagement: 0 };
  }

  try {
    const response = await fetchWithTimeout(
      `https://api.linkedin.com/rest/socialActions/${postId}?q=organizationalEntity&dateRange.start.day=${new Date(Date.now() - 7 * 86400000).getDate()}&dateRange.start.month=${new Date(Date.now() - 7 * 86400000).getMonth() + 1}&dateRange.start.year=${new Date(Date.now() - 7 * 86400000).getFullYear()}&dateRange.end.day=${new Date().getDate()}&dateRange.end.month=${new Date().getMonth() + 1}&dateRange.end.year=${new Date().getFullYear()}`,
      { headers: headers(config), timeoutMs: TIMEOUT_MODERATE_MS },
    );

    if (!response.ok) {
      return { postId, impressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0, totalEngagement: 0 };
    }

    const data = await response.json() as {
      totalImpressionsCount?: number;
      totalClicksCount?: number;
      totalLikeCount?: number;
      totalCommentCount?: number;
      totalShareCount?: number;
    };

    const likes = data.totalLikeCount ?? 0;
    const comments = data.totalCommentCount ?? 0;
    const shares = data.totalShareCount ?? 0;

    return {
      postId,
      impressions: data.totalImpressionsCount ?? 0,
      clicks: data.totalClicksCount ?? 0,
      likes,
      comments,
      shares,
      totalEngagement: likes + comments + shares,
    };
  } catch (error) {
    return { postId, impressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0, totalEngagement: 0 };
  }
}

/**
 * List recent posts from the LinkedIn organization.
 */
export async function listRecentPosts(count = 10): Promise<Array<{ postId: string; text: string; createdAt: string }>> {
  const config = getConfig();
  if (!config) return [];

  try {
    const response = await fetchWithTimeout(
      `https://api.linkedin.com/rest/posts?q=author&author=urn:li:organization:${extractOrgId(config)}&count=${count}&sort=CREATED`,
      { headers: headers(config), timeoutMs: TIMEOUT_MODERATE_MS },
    );

    if (!response.ok) return [];

    const data = await response.json() as {
      elements?: Array<{
        id?: string;
        commentary?: { text?: string };
        created?: { time?: number };
      }>;
    };

    return (data.elements || []).map((el) => ({
      postId: el.id || '',
      text: el.commentary?.text || '',
      createdAt: el.created?.time ? new Date(el.created.time).toISOString() : '',
    }));
  } catch {
    return [];
  }
}
