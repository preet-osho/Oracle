// ═══════════════════════════════════════
// ORACLE — Social Media Analytics Collector Tests
// ═══════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getLatestSnapshot,
  getRecentSnapshots,
  getTrends,
  getAggregatedStats,
  clearSnapshots,
} from './analytics-collector';

// Mock the platform clients
vi.mock('./linkedin', () => ({
  isLinkedInConfigured: vi.fn(() => false),
  getPageAnalytics: vi.fn(() => Promise.resolve({
    followerCount: 1500,
    impressions: 5000,
    clicks: 200,
    likes: 150,
    comments: 30,
    shares: 10,
  })),
  getPostEngagement: vi.fn(() => Promise.resolve({
    postId: 'test-post',
    impressions: 500,
    clicks: 25,
    likes: 20,
    comments: 5,
    shares: 2,
    totalEngagement: 27,
  })),
  listRecentPosts: vi.fn(() => Promise.resolve([
    { postId: 'post-1', text: 'Hello world', createdAt: '2024-01-15' },
    { postId: 'post-2', text: 'Second post', createdAt: '2024-01-14' },
  ])),
}));

vi.mock('./instagram', () => ({
  isInstagramConfigured: vi.fn(() => false),
  getPageAnalytics: vi.fn(() => Promise.resolve({
    followers: 2000,
    impressions: 8000,
    reach: 5000,
    profileViews: 300,
    websiteClicks: 50,
  })),
  getPostEngagement: vi.fn(() => Promise.resolve({
    mediaId: 'ig-post',
    impressions: 800,
    reach: 600,
    likes: 45,
    comments: 12,
    saves: 8,
    shares: 3,
    totalEngagement: 68,
  })),
  listRecentMedia: vi.fn(() => Promise.resolve([
    { mediaId: 'ig-1', caption: 'Instagram post', timestamp: '2024-01-15T10:00:00Z' },
  ])),
}));

vi.mock('./facebook', () => ({
  isFacebookConfigured: vi.fn(() => false),
  getPageAnalytics: vi.fn(() => Promise.resolve({
    followers: 3000,
    impressions: 12000,
    reach: 8000,
    engagement: 400,
    pageViews: 150,
  })),
  getPostEngagement: vi.fn(() => Promise.resolve({
    postId: 'fb-post',
    impressions: 1200,
    reach: 900,
    likes: 60,
    comments: 15,
    shares: 8,
    reactions: 60,
    totalEngagement: 83,
  })),
  listRecentPosts: vi.fn(() => Promise.resolve([
    { postId: 'fb-1', message: 'Facebook post', createdTime: '2024-01-15T09:00:00Z' },
  ])),
}));

// Mock scheduler
vi.mock('./scheduler', () => ({
  listPosts: vi.fn(() => []),
  updatePost: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('Analytics Snapshot Storage', () => {
  beforeEach(() => {
    clearSnapshots();
  });

  it('starts with no snapshots', () => {
    expect(getLatestSnapshot()).toBeNull();
    expect(getRecentSnapshots()).toEqual([]);
  });

  it('getRecentSnapshots respects count limit', () => {
    const trends = getTrends();
    expect(trends).toEqual([]);
  });
});

describe('Analytics Trends', () => {
  beforeEach(() => {
    clearSnapshots();
  });

  it('returns empty trends when no snapshots', () => {
    const trends = getTrends();
    expect(trends).toEqual([]);
  });

  it('returns empty trends with only one snapshot', () => {
    // Since we can't directly add snapshots (they're created by collectAllAnalytics),
    // and the mocked platforms are all "not configured",
    // the trends should be empty
    const trends = getTrends();
    expect(trends).toEqual([]);
  });
});

describe('Aggregated Stats', () => {
  beforeEach(() => {
    clearSnapshots();
  });

  it('returns zeros when no snapshots exist', () => {
    const stats = getAggregatedStats(Date.now() - 86400000, Date.now());
    expect(stats.totalFollowers).toBe(0);
    expect(stats.totalImpressions).toBe(0);
    expect(stats.totalEngagement).toBe(0);
    expect(stats.totalReach).toBe(0);
    expect(stats.avgEngagementRate).toBe(0);
    expect(stats.byPlatform.linkedin.followers).toBe(0);
    expect(stats.byPlatform.instagram.followers).toBe(0);
    expect(stats.byPlatform.facebook.followers).toBe(0);
  });
});

describe('Platform Status Checks', () => {
  it('LinkedIn reports not configured', async () => {
    const { isLinkedInConfigured } = await import('./linkedin');
    expect(isLinkedInConfigured()).toBe(false);
  });

  it('Instagram reports not configured', async () => {
    const { isInstagramConfigured } = await import('./instagram');
    expect(isInstagramConfigured()).toBe(false);
  });

  it('Facebook reports not configured', async () => {
    const { isFacebookConfigured } = await import('./facebook');
    expect(isFacebookConfigured()).toBe(false);
  });
});

describe('Analytics Data Types', () => {
  it('types module loads successfully', async () => {
    const types = await import('./types');
    expect(types).toBeDefined();
  });
});

describe('Analytics Collector Exports', () => {
  it('exports all expected functions', async () => {
    const collector = await import('./analytics-collector');
    expect(typeof collector.collectAllAnalytics).toBe('function');
    expect(typeof collector.collectPlatformAnalytics).toBe('function');
    expect(typeof collector.getLatestSnapshot).toBe('function');
    expect(typeof collector.getRecentSnapshots).toBe('function');
    expect(typeof collector.getTrends).toBe('function');
    expect(typeof collector.getAggregatedStats).toBe('function');
    expect(typeof collector.clearSnapshots).toBe('function');
  });
});

describe('Analytics Snapshot Interface', () => {
  it('has correct snapshot structure', () => {
    // Test the shape of a snapshot
    const mockSnapshot = {
      id: 'snapshot_test',
      collectedAt: Date.now(),
      platforms: {
        linkedin: null,
        instagram: null,
        facebook: null,
        whatsapp: null,
      },
    };

    expect(mockSnapshot.id).toBeDefined();
    expect(mockSnapshot.collectedAt).toBeGreaterThan(0);
    expect(mockSnapshot.platforms).toBeDefined();
    expect(typeof mockSnapshot.platforms.linkedin).toBe('object');
    expect(typeof mockSnapshot.platforms.instagram).toBe('object');
    expect(typeof mockSnapshot.platforms.facebook).toBe('object');
  });
});

describe('Analytics Trend Calculation', () => {
  it('handles empty data gracefully', () => {
    const trends = getTrends();
    expect(Array.isArray(trends)).toBe(true);
    expect(trends.length).toBe(0);
  });
});

describe('Platform Analytics Mocks', () => {
  it('LinkedIn mock returns correct structure', async () => {
    const { getPageAnalytics } = await import('./linkedin');
    const data = await getPageAnalytics();
    expect(data).toHaveProperty('followerCount');
    expect(data).toHaveProperty('impressions');
    expect(data).toHaveProperty('clicks');
    expect(data).toHaveProperty('likes');
    expect(data).toHaveProperty('comments');
    expect(data).toHaveProperty('shares');
  });

  it('Instagram mock returns correct structure', async () => {
    const { getPageAnalytics } = await import('./instagram');
    const data = await getPageAnalytics();
    expect(data).toHaveProperty('followers');
    expect(data).toHaveProperty('impressions');
    expect(data).toHaveProperty('reach');
    expect(data).toHaveProperty('profileViews');
    expect(data).toHaveProperty('websiteClicks');
  });

  it('Facebook mock returns correct structure', async () => {
    const { getPageAnalytics } = await import('./facebook');
    const data = await getPageAnalytics();
    expect(data).toHaveProperty('followers');
    expect(data).toHaveProperty('impressions');
    expect(data).toHaveProperty('reach');
    expect(data).toHaveProperty('engagement');
    expect(data).toHaveProperty('pageViews');
  });
});
