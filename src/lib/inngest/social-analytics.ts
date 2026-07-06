// ═══════════════════════════════════════
// ORACLE — Social Media Analytics Inngest Function
// Scheduled engagement data collection
// ═══════════════════════════════════════

import { inngest } from '@/lib/inngest/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('SocialAnalyticsInngest');

// ─── Social Analytics Collection Function ──
// Collects engagement data from LinkedIn, Instagram, and Facebook.
// Triggered by automationTick for 'social-analytics-daily'/'social-analytics-weekly'
// or manually via the API.

export const collectSocialAnalytics = inngest.createFunction(
  {
    id: 'collect-social-analytics',
    name: 'Collect Social Analytics',
    retries: 2,
    triggers: [{ event: 'app/social.analytics' }],
  },
  async ({ event, step }) => {
    const { platform, collectAll = true } = event.data;
    log.info('Social analytics collection started', { platform, collectAll });

    // Step 1: Collect analytics from all or specific platform(s)
    const snapshot = await step.run('collect-analytics', async () => {
      const { collectAllAnalytics, collectPlatformAnalytics } = await import('@/lib/social-media/analytics-collector');

      if (platform && !collectAll) {
        const data = await collectPlatformAnalytics(platform);
        return {
          id: `snapshot_${Date.now()}`,
          collectedAt: Date.now(),
          platform: data,
          platforms: {
            linkedin: data.platform === 'linkedin' ? data : null,
            instagram: data.platform === 'instagram' ? data : null,
            facebook: data.platform === 'facebook' ? data : null,
            whatsapp: null,
          },
        };
      }

      const snapshot = await collectAllAnalytics();
      return snapshot;
    });

    // Step 2: Generate summary
    const summary = await step.run('generate-summary', async () => {
      const platforms = snapshot.platforms;
      const results: Array<{ platform: string; status: string; engagement: number }> = [];

      for (const [key, data] of Object.entries(platforms)) {
        if (key === 'whatsapp') continue;
        if (!data) {
          results.push({ platform: key, status: 'not configured', engagement: 0 });
          continue;
        }
        results.push({
          platform: key,
          status: data.success ? 'collected' : `error: ${data.error}`,
          engagement: data.totalEngagement,
        });
      }

      return { results, collectedAt: snapshot.collectedAt };
    });

    log.info('Social analytics collection completed', {
      platforms: summary.results.length,
      collectedAt: summary.collectedAt,
    });

    return {
      snapshotId: snapshot.id,
      collectedAt: snapshot.collectedAt,
      summary: summary.results,
    };
  },
);
