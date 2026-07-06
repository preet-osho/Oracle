// ═══════════════════════════════════════
// ORACLE — Social Media Analytics Collector
// Fetches engagement data from all platforms
// Stores snapshots · Provides trend analysis
// ═══════════════════════════════════════

import { createLogger } from '@/lib/logger';
import type {
  SocialPlatform,
  PostEngagement,
} from './types';
import { isLinkedInConfigured, getPageAnalytics as linkedinPageAnalytics, getPostEngagement as linkedinPostEngagement, listRecentPosts as linkedinListPosts } from './linkedin';
import { isInstagramConfigured, getPageAnalytics as instagramPageAnalytics, getPostEngagement as instagramPostEngagement, listRecentMedia as instagramListMedia } from './instagram';
import { isFacebookConfigured, getPageAnalytics as facebookPageAnalytics, getPostEngagement as facebookPostEngagement, listRecentPosts as facebookListPosts } from './facebook';
import { listPosts } from './scheduler';

const log = createLogger('AnalyticsCollector');

// ─── Types ────────────────────────────

export interface AnalyticsSnapshot {
  id: string;
  collectedAt: number;
  platforms: Record<SocialPlatform, PlatformSnapshot | null>;
}

export interface PlatformSnapshot {
  platform: SocialPlatform;
  accountId: string;
  collectedAt: number;

  // Page-level stats
  totalFollowers: number;
  followersGained: number;

  // Engagement totals (period)
  totalImpressions: number;
  totalReach: number;
  totalEngagement: number;
  avgEngagementRate: number;

  // Per-post engagement (top posts)
  topPosts: PostEngagement[];

  // Content counts
  postCount: number;
  contentMix: {
    text: number;
    image: number;
    video: number;
    link: number;
  };

  // Collection metadata
  success: boolean;
  error?: string;
}

export interface AnalyticsTrend {
  platform: SocialPlatform;
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  direction: 'up' | 'down' | 'flat';
}

// ─── In-Memory Snapshot Store ─────────

const snapshots: AnalyticsSnapshot[] = [];
const MAX_SNAPSHOTS = 365; // Keep 1 year of daily snapshots

// ─── Platform Collectors ──────────────

async function collectLinkedIn(): Promise<PlatformSnapshot> {
  const platform: SocialPlatform = 'linkedin';

  if (!isLinkedInConfigured()) {
    return createEmptySnapshot(platform, 'linkedin-org', 'LinkedIn not configured');
  }

  try {
    const [pageStats, recentPosts] = await Promise.all([
      linkedinPageAnalytics(),
      linkedinListPosts(20),
    ]);

    // Fetch engagement for each post (limit concurrency)
    const postEngagements: PostEngagement[] = [];
    const batchSize = 5;

    for (let i = 0; i < recentPosts.length; i += batchSize) {
      const batch = recentPosts.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (post) => {
          const engagement = await linkedinPostEngagement(post.postId);
          return {
            postId: post.postId,
            impressions: engagement.impressions,
            clicks: engagement.clicks,
            likes: engagement.likes,
            comments: engagement.comments,
            shares: engagement.shares,
            reach: 0,
            engagementRate: engagement.impressions > 0
              ? (engagement.totalEngagement / engagement.impressions) * 100
              : 0,
            lastCheckedAt: Date.now(),
          };
        }),
      );
      postEngagements.push(...results);
    }

    const totalEngagement = postEngagements.reduce(
      (sum, p) => sum + p.likes + p.comments + p.shares,
      0,
    );
    const totalImpressions = pageStats.impressions || postEngagements.reduce(
      (sum, p) => sum + p.impressions,
      0,
    );
    const avgEngagementRate = totalImpressions > 0
      ? (totalEngagement / totalImpressions) * 100
      : 0;

    // Find best performing post
    const sortedByEngagement = [...postEngagements].sort(
      (a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares),
    );

    return {
      platform,
      accountId: 'linkedin-org',
      collectedAt: Date.now(),
      totalFollowers: pageStats.followerCount,
      followersGained: 0,
      totalImpressions,
      totalReach: 0,
      totalEngagement,
      avgEngagementRate,
      topPosts: sortedByEngagement.slice(0, 5),
      postCount: recentPosts.length,
      contentMix: { text: recentPosts.length, image: 0, video: 0, link: 0 },
      success: true,
    };
  } catch (error) {
    return createEmptySnapshot(platform, 'linkedin-org', error instanceof Error ? error.message : 'Unknown error');
  }
}

async function collectInstagram(): Promise<PlatformSnapshot> {
  const platform: SocialPlatform = 'instagram';

  if (!isInstagramConfigured()) {
    return createEmptySnapshot(platform, 'ig-account', 'Instagram not configured');
  }

  try {
    const [pageStats, recentMedia] = await Promise.all([
      instagramPageAnalytics(),
      instagramListMedia(20),
    ]);

    // Fetch engagement for each media item
    const postEngagements: PostEngagement[] = [];
    const batchSize = 5;

    for (let i = 0; i < recentMedia.length; i += batchSize) {
      const batch = recentMedia.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (media) => {
          const engagement = await instagramPostEngagement(media.mediaId);
          return {
            postId: media.mediaId,
            impressions: engagement.impressions,
            reach: engagement.reach,
            likes: engagement.likes,
            comments: engagement.comments,
            shares: engagement.shares,
            clicks: 0,
            engagementRate: engagement.reach > 0
              ? (engagement.totalEngagement / engagement.reach) * 100
              : 0,
            lastCheckedAt: Date.now(),
          };
        }),
      );
      postEngagements.push(...results);
    }

    const totalEngagement = postEngagements.reduce(
      (sum, p) => sum + p.likes + p.comments + p.shares,
      0,
    );
    const totalReach = pageStats.reach || postEngagements.reduce(
      (sum, p) => sum + p.reach,
      0,
    );
    const avgEngagementRate = totalReach > 0
      ? (totalEngagement / totalReach) * 100
      : 0;

    const sortedByEngagement = [...postEngagements].sort(
      (a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares),
    );

    return {
      platform,
      accountId: 'ig-account',
      collectedAt: Date.now(),
      totalFollowers: pageStats.followers,
      followersGained: 0,
      totalImpressions: pageStats.impressions,
      totalReach,
      totalEngagement,
      avgEngagementRate,
      topPosts: sortedByEngagement.slice(0, 5),
      postCount: recentMedia.length,
      contentMix: { text: 0, image: recentMedia.length, video: 0, link: 0 },
      success: true,
    };
  } catch (error) {
    return createEmptySnapshot(platform, 'ig-account', error instanceof Error ? error.message : 'Unknown error');
  }
}

async function collectFacebook(): Promise<PlatformSnapshot> {
  const platform: SocialPlatform = 'facebook';

  if (!isFacebookConfigured()) {
    return createEmptySnapshot(platform, 'fb-page', 'Facebook not configured');
  }

  try {
    const [pageStats, recentPosts] = await Promise.all([
      facebookPageAnalytics(),
      facebookListPosts(20),
    ]);

    // Fetch engagement for each post
    const postEngagements: PostEngagement[] = [];
    const batchSize = 5;

    for (let i = 0; i < recentPosts.length; i += batchSize) {
      const batch = recentPosts.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (post) => {
          const engagement = await facebookPostEngagement(post.postId);
          return {
            postId: post.postId,
            impressions: engagement.impressions,
            reach: engagement.reach,
            likes: engagement.likes,
            comments: engagement.comments,
            shares: engagement.shares,
            clicks: 0,
            engagementRate: engagement.reach > 0
              ? (engagement.totalEngagement / engagement.reach) * 100
              : 0,
            lastCheckedAt: Date.now(),
          };
        }),
      );
      postEngagements.push(...results);
    }

    const totalEngagement = postEngagements.reduce(
      (sum, p) => sum + p.likes + p.comments + p.shares,
      0,
    );
    const totalReach = pageStats.reach || postEngagements.reduce(
      (sum, p) => sum + p.reach,
      0,
    );
    const avgEngagementRate = totalReach > 0
      ? (totalEngagement / totalReach) * 100
      : 0;

    const sortedByEngagement = [...postEngagements].sort(
      (a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares),
    );

    return {
      platform,
      accountId: 'fb-page',
      collectedAt: Date.now(),
      totalFollowers: pageStats.followers,
      followersGained: 0,
      totalImpressions: pageStats.impressions,
      totalReach,
      totalEngagement,
      avgEngagementRate,
      topPosts: sortedByEngagement.slice(0, 5),
      postCount: recentPosts.length,
      contentMix: { text: 0, image: 0, video: 0, link: recentPosts.length },
      success: true,
    };
  } catch (error) {
    return createEmptySnapshot(platform, 'fb-page', error instanceof Error ? error.message : 'Unknown error');
  }
}

// ─── Helpers ──────────────────────────

function createEmptySnapshot(
  platform: SocialPlatform,
  accountId: string,
  error: string,
): PlatformSnapshot {
  return {
    platform,
    accountId,
    collectedAt: Date.now(),
    totalFollowers: 0,
    followersGained: 0,
    totalImpressions: 0,
    totalReach: 0,
    totalEngagement: 0,
    avgEngagementRate: 0,
    topPosts: [],
    postCount: 0,
    contentMix: { text: 0, image: 0, video: 0, link: 0 },
    success: false,
    error,
  };
}

function generateSnapshotId(): string {
  return `snapshot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Public API ───────────────────────

/**
 * Collect analytics from all configured platforms.
 * Returns a snapshot with per-platform data.
 */
export async function collectAllAnalytics(): Promise<AnalyticsSnapshot> {
  log.info('Starting analytics collection from all platforms');

  const [linkedin, instagram, facebook] = await Promise.all([
    collectLinkedIn(),
    collectInstagram(),
    collectFacebook(),
  ]);

  const snapshot: AnalyticsSnapshot = {
    id: generateSnapshotId(),
    collectedAt: Date.now(),
    platforms: {
      linkedin,
      instagram,
      facebook,
      whatsapp: null, // WhatsApp doesn't have engagement analytics
    },
  };

  // Store snapshot
  snapshots.push(snapshot);
  if (snapshots.length > MAX_SNAPSHOTS) {
    snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS);
  }

  // Update published posts with fresh engagement data
  await updatePostEngagements(snapshot);

  log.info('Analytics collection complete', {
    linkedin: linkedin.success ? `${linkedin.totalEngagement} engagement` : linkedin.error,
    instagram: instagram.success ? `${instagram.totalEngagement} engagement` : instagram.error,
    facebook: facebook.success ? `${facebook.totalEngagement} engagement` : facebook.error,
  });

  return snapshot;
}

/**
 * Collect analytics for a single platform.
 */
export async function collectPlatformAnalytics(platform: SocialPlatform): Promise<PlatformSnapshot> {
  switch (platform) {
    case 'linkedin': return collectLinkedIn();
    case 'instagram': return collectInstagram();
    case 'facebook': return collectFacebook();
    default: return createEmptySnapshot(platform, '', `Unsupported platform: ${platform}`);
  }
}

/**
 * Get the latest analytics snapshot.
 */
export function getLatestSnapshot(): AnalyticsSnapshot | null {
  return snapshots.length > 0 ? snapshots[snapshots.length - 1]! : null;
}

/**
 * Get analytics snapshots within a date range.
 */
export function getSnapshotsInRange(startDate: number, endDate: number): AnalyticsSnapshot[] {
  return snapshots.filter(
    (s) => s.collectedAt >= startDate && s.collectedAt <= endDate,
  );
}

/**
 * Get the last N snapshots.
 */
export function getRecentSnapshots(count = 30): AnalyticsSnapshot[] {
  return snapshots.slice(-count);
}

/**
 * Calculate trends by comparing current vs previous snapshot.
 */
export function getTrends(): AnalyticsTrend[] {
  if (snapshots.length < 2) return [];

  const current = snapshots[snapshots.length - 1]!;
  const previous = snapshots[snapshots.length - 2]!;

  const trends: AnalyticsTrend[] = [];
  const platforms: SocialPlatform[] = ['linkedin', 'instagram', 'facebook'];

  for (const platform of platforms) {
    const cur = current.platforms[platform];
    const prev = previous.platforms[platform];

    if (!cur || !prev) continue;

    const metrics: Array<{ key: keyof PlatformSnapshot; label: string }> = [
      { key: 'totalFollowers', label: 'Followers' },
      { key: 'totalImpressions', label: 'Impressions' },
      { key: 'totalEngagement', label: 'Engagement' },
      { key: 'totalReach', label: 'Reach' },
      { key: 'avgEngagementRate', label: 'Engagement Rate' },
    ];

    for (const metric of metrics) {
      const curVal = (cur[metric.key] as number) || 0;
      const prevVal = (prev[metric.key] as number) || 0;
      const change = curVal - prevVal;
      const changePercent = prevVal > 0 ? (change / prevVal) * 100 : 0;

      trends.push({
        platform,
        metric: metric.label,
        current: curVal,
        previous: prevVal,
        change,
        changePercent,
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
      });
    }
  }

  return trends;
}

/**
 * Get aggregated stats across all platforms for a period.
 */
export function getAggregatedStats(startDate: number, endDate: number): {
  totalFollowers: number;
  totalImpressions: number;
  totalEngagement: number;
  totalReach: number;
  avgEngagementRate: number;
  byPlatform: Record<SocialPlatform, {
    followers: number;
    impressions: number;
    engagement: number;
    reach: number;
  }>;
} {
  const periodSnapshots = getSnapshotsInRange(startDate, endDate);
  const latest = periodSnapshots[periodSnapshots.length - 1];

  if (!latest) {
    return {
      totalFollowers: 0,
      totalImpressions: 0,
      totalEngagement: 0,
      totalReach: 0,
      avgEngagementRate: 0,
      byPlatform: {
        linkedin: { followers: 0, impressions: 0, engagement: 0, reach: 0 },
        instagram: { followers: 0, impressions: 0, engagement: 0, reach: 0 },
        facebook: { followers: 0, impressions: 0, engagement: 0, reach: 0 },
        whatsapp: { followers: 0, impressions: 0, engagement: 0, reach: 0 },
      },
    };
  }

  let totalFollowers = 0;
  let totalImpressions = 0;
  let totalEngagement = 0;
  let totalReach = 0;

  const byPlatform: Record<SocialPlatform, {
    followers: number;
    impressions: number;
    engagement: number;
    reach: number;
  }> = {
    linkedin: { followers: 0, impressions: 0, engagement: 0, reach: 0 },
    instagram: { followers: 0, impressions: 0, engagement: 0, reach: 0 },
    facebook: { followers: 0, impressions: 0, engagement: 0, reach: 0 },
    whatsapp: { followers: 0, impressions: 0, engagement: 0, reach: 0 },
  };

  const platforms: SocialPlatform[] = ['linkedin', 'instagram', 'facebook'];

  for (const platform of platforms) {
    const data = latest.platforms[platform];
    if (!data || !data.success) continue;

    totalFollowers += data.totalFollowers;
    totalImpressions += data.totalImpressions;
    totalEngagement += data.totalEngagement;
    totalReach += data.totalReach;

    byPlatform[platform] = {
      followers: data.totalFollowers,
      impressions: data.totalImpressions,
      engagement: data.totalEngagement,
      reach: data.totalReach,
    };
  }

  const avgEngagementRate = totalReach > 0
    ? (totalEngagement / totalReach) * 100
    : 0;

  return {
    totalFollowers,
    totalImpressions,
    totalEngagement,
    totalReach,
    avgEngagementRate,
    byPlatform,
  };
}

/**
 * Update published posts in the scheduler with fresh engagement data.
 */
async function updatePostEngagements(snapshot: AnalyticsSnapshot): Promise<void> {
  const publishedPosts = listPosts({ status: 'published' });

  for (const post of publishedPosts) {
    if (!post.providerPostId) continue;

    const platformData = snapshot.platforms[post.platform];
    if (!platformData || !platformData.success) continue;

    const engagement = platformData.topPosts.find(
      (p) => p.postId === post.providerPostId,
    );

    if (engagement) {
      post.engagement = {
        postId: engagement.postId,
        impressions: engagement.impressions,
        clicks: engagement.clicks,
        likes: engagement.likes,
        comments: engagement.comments,
        shares: engagement.shares,
        reach: engagement.reach,
        engagementRate: engagement.engagementRate,
        lastCheckedAt: engagement.lastCheckedAt,
      };
    }
  }
}

/**
 * Clear all stored snapshots (for testing).
 */
export function clearSnapshots(): void {
  snapshots.length = 0;
}
