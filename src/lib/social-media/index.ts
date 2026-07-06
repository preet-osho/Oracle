// ═══════════════════════════════════════
// ORACLE — Social Media Module Index
// Platform clients · Scheduler · Hub
// ═══════════════════════════════════════

// Types
export * from './types';

// Platform clients
export { isLinkedInConfigured, postText as linkedinPostText, postImage as linkedinPostImage, postLink as linkedinPostLink } from './linkedin';
export { isInstagramConfigured, postImage as instagramPostImage, postCarousel as instagramPostCarousel, postVideo as instagramPostVideo } from './instagram';
export { isFacebookConfigured, postText as facebookPostText, postImage as facebookPostImage, postLink as facebookPostLink, schedulePost as facebookSchedulePost } from './facebook';
export { isWhatsAppSocialConfigured, sendTextMessage as whatsappSocialSendText, sendTemplateBroadcast, sendMediaMessage } from './whatsapp-social';

// Scheduler
export { createPost, getPost, updatePost, deletePost, listPosts, publishPost, processQueue, scheduleBulk, getPostStats, getQueue } from './scheduler';

// Hub (unified interface)
export { getPlatformStatus, quickPost, schedulePost, crossPost } from './hub';

// Analytics
export {
  collectAllAnalytics,
  collectPlatformAnalytics,
  getLatestSnapshot,
  getRecentSnapshots,
  getTrends,
  getAggregatedStats,
  clearSnapshots,
} from './analytics-collector';
export type { AnalyticsSnapshot, PlatformSnapshot, AnalyticsTrend } from './analytics-collector';

// Platform analytics types
export type { LinkedinEngagement, LinkedinPageStats } from './linkedin';
export type { InstagramEngagement, InstagramPageStats } from './instagram';
export type { FacebookEngagement, FacebookPageStats } from './facebook';
