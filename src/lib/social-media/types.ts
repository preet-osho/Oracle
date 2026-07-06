// ═══════════════════════════════════════
// ORACLE — Social Media Scheduling Types
// LinkedIn · Instagram · Facebook · WhatsApp
// ═══════════════════════════════════════

// ─── Platform Definitions ─────────────

export type SocialPlatform = 'linkedin' | 'instagram' | 'facebook' | 'whatsapp';

export type PostType = 'text' | 'image' | 'video' | 'link' | 'carousel';

export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';

export type PostPriority = 'low' | 'normal' | 'high' | 'urgent';

// ─── Platform Credentials ─────────────

export interface LinkedinConfig {
  accessToken: string;
  /** Organization URN (e.g., "urn:li:organization:12345") or member URN */
  authorUrn: string;
  /** API version (default: 202606) */
  apiVersion?: string;
}

export interface InstagramConfig {
  accessToken: string;
  /** Instagram Business Account ID */
  igAccountId: string;
  /** Facebook Page ID (required for Graph API) */
  facebookPageId?: string;
}

export interface FacebookConfig {
  accessToken: string;
  /** Facebook Page ID */
  pageId: string;
}

export interface WhatsAppSocialConfig {
  phoneNumberId: string;
  accessToken: string;
  /** WhatsApp Business Account ID */
  wabaId: string;
}

export interface SocialPlatformConfig {
  linkedin?: LinkedinConfig;
  instagram?: InstagramConfig;
  facebook?: FacebookConfig;
  whatsapp?: WhatsAppSocialConfig;
}

// ─── Social Media Post ────────────────

export interface SocialMediaPost {
  id: string;
  platform: SocialPlatform;
  postType: PostType;
  status: PostStatus;
  priority: PostPriority;

  // Content
  text: string;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  linkUrl?: string;
  linkTitle?: string;
  linkDescription?: string;

  // Scheduling
  scheduledAt?: number;
  publishedAt?: number;
  timezone: string;

  // Targeting
  authorUrn?: string;        // LinkedIn org/member URN
  igAccountId?: string;      // Instagram account
  pageId?: string;           // Facebook page
  phoneNumberId?: string;    // WhatsApp phone

  // Metadata
  clientId?: string;
  campaignId?: string;
  tags: string[];
  hashtags: string[];
  notes: string;

  // Analytics (populated after publishing)
  engagement?: PostEngagement;

  // Provider response
  providerPostId?: string;
  providerUrl?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;

  // Audit
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Post Engagement ──────────────────

export interface PostEngagement {
  postId: string;
  impressions: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  engagementRate: number;
  lastCheckedAt: number;
}

// ─── Content Calendar ─────────────────

export interface ContentCalendarEntry {
  id: string;
  postId: string;
  date: string;              // YYYY-MM-DD
  timeSlot: string;          // HH:MM
  platform: SocialPlatform;
  topic: string;
  contentType: PostType;
  status: PostStatus;
  pillars: string[];         // Content pillars: educational, entertaining, etc.
  notes: string;
}

export interface ContentCalendar {
  id: string;
  name: string;
  clientId?: string;
  month: number;             // 1-12
  year: number;
  entries: ContentCalendarEntry[];
  createdAt: number;
  updatedAt: number;
}

// ─── Hashtag Strategy ─────────────────

export interface HashtagGroup {
  id: string;
  name: string;
  platform: SocialPlatform;
  hashtags: string[];
  category: string;          // e.g., 'industry', 'location', 'trending'
  usageCount: number;
  lastUsedAt?: number;
  isActive: boolean;
}

// ─── Analytics ────────────────────────

export interface PlatformAnalytics {
  platform: SocialPlatform;
  accountId: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;

  // Engagement
  totalPosts: number;
  totalImpressions: number;
  totalEngagement: number;
  avgEngagementRate: number;

  // Followers
  followersGained: number;
  followersLost: number;
  totalFollowers: number;

  // Best performing
  bestPostId?: string;
  bestPostEngagement?: number;
  bestTimeToPost?: string;
  bestDayOfWeek?: string;

  // Content breakdown
  contentMix: {
    text: number;
    image: number;
    video: number;
    link: number;
  };

  collectedAt: number;
}

// ─── Post Template ────────────────────

export interface SocialPostTemplate {
  id: string;
  name: string;
  platform: SocialPlatform;
  postType: PostType;
  textTemplate: string;       // Supports {{variables}}
  variables: string[];
  hashtags: string[];
  imageUrl?: string;
  category: string;           // 'engagement', 'promotion', 'educational', 'behind-scenes'
  usageCount: number;
  createdAt: number;
}

// ─── Queue / Retry ────────────────────

export interface PostQueueItem {
  postId: string;
  platform: SocialPlatform;
  priority: PostPriority;
  scheduledAt: number;
  attempts: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  status: 'pending' | 'processing' | 'retry' | 'completed' | 'failed';
  error?: string;
}
