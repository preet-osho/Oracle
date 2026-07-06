// ═══════════════════════════════════════
// ORACLE — Social Media Analytics API
// GET  /api/social-media/analytics      — Query analytics data
// POST /api/social-media/analytics      — Trigger collection
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { collectAllAnalytics, getLatestSnapshot, getRecentSnapshots, getTrends, getAggregatedStats, collectPlatformAnalytics } from '@/lib/social-media/analytics-collector';
import type { SocialPlatform } from '@/lib/social-media/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('SocialMediaAnalyticsAPI');

// ─── GET /api/social-media/analytics ──

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'latest';

    switch (action) {
      case 'latest': {
        const snapshot = getLatestSnapshot();
        return NextResponse.json({
          success: true,
          data: snapshot,
          message: snapshot ? 'Latest snapshot retrieved' : 'No snapshots available. Trigger a collection first.',
        });
      }

      case 'recent': {
        const count = parseInt(searchParams.get('count') || '30', 10);
        const snapshots = getRecentSnapshots(count);
        return NextResponse.json({
          success: true,
          data: { snapshots, count: snapshots.length },
        });
      }

      case 'trends': {
        const trends = getTrends();
        return NextResponse.json({
          success: true,
          data: { trends, count: trends.length },
        });
      }

      case 'aggregate': {
        const period = searchParams.get('period') || 'daily';
        const periodMs = period === 'weekly' ? 7 * 86400000 : period === 'monthly' ? 30 * 86400000 : 86400000;
        const endDate = Date.now();
        const startDate = endDate - periodMs;
        const stats = getAggregatedStats(startDate, endDate);
        return NextResponse.json({
          success: true,
          data: { ...stats, period, startDate, endDate },
        });
      }

      case 'platform': {
        const platform = searchParams.get('platform') as SocialPlatform | null;
        if (!platform || !['linkedin', 'instagram', 'facebook'].includes(platform)) {
          return NextResponse.json(
            { success: false, error: 'Invalid platform. Must be: linkedin, instagram, facebook' },
            { status: 400 },
          );
        }
        const platformData = await collectPlatformAnalytics(platform);
        return NextResponse.json({ success: true, data: platformData });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Valid: latest, recent, trends, aggregate, platform` },
          { status: 400 },
        );
    }
  } catch (error) {
    log.error('Analytics GET error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve analytics data' },
      { status: 500 },
    );
  }
}

// ─── POST /api/social-media/analytics ─

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = (body.action as string) || 'collect-all';

    switch (action) {
      case 'collect-all': {
        log.info('Triggering full analytics collection');
        const snapshot = await collectAllAnalytics();
        return NextResponse.json({
          success: true,
          data: snapshot,
          message: 'Analytics collected from all configured platforms',
        });
      }

      case 'collect-platform': {
        const platform = body.platform as SocialPlatform;
        if (!platform || !['linkedin', 'instagram', 'facebook'].includes(platform)) {
          return NextResponse.json(
            { success: false, error: 'Invalid platform' },
            { status: 400 },
          );
        }
        log.info('Triggering platform analytics collection', { platform });
        const data = await collectPlatformAnalytics(platform);
        return NextResponse.json({
          success: true,
          data,
          message: `Analytics collected from ${platform}`,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Valid: collect-all, collect-platform` },
          { status: 400 },
        );
    }
  } catch (error) {
    log.error('Analytics POST error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json(
      { success: false, error: 'Failed to collect analytics' },
      { status: 500 },
    );
  }
}
