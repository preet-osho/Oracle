// ═══════════════════════════════════════
// ORACLE — Rate Limit Analytics API
// Serves abuse pattern data from audit_logs
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resetUserRateLimits } from '@/lib/rate-limit';

// ─── Singleton service-role client (bypasses RLS) ──

let analyticsClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient | null {
  if (analyticsClient) return analyticsClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  analyticsClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return analyticsClient;
}

// ─── GET Handler ──────────────────────

export async function GET(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });

  const supabase = getServiceClient();
  if (!supabase) {
    return Response.json({ error: 'Analytics unavailable — service credentials not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '24h';
  const userId = searchParams.get('userId');

  // Compute time window
  const now = Date.now();
  const windows: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };
  const windowMs = windows[range] || windows['24h'];
  const since = now - windowMs;

  try {
    // ── User drill-down (if userId param provided) ──
    if (userId) {
      const { data: userEvents } = await supabase
        .from('audit_logs')
        .select('action, entity_type, metadata, created_at')
        .eq('user_id', userId)
        .in('action', ['security.rate_limit_exceeded', 'security.rate_limit_warning'])
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(100);

      return Response.json({
        userId,
        range,
        events: (userEvents || []).map((e) => ({
          action: e.action,
          endpoint: (e.metadata as Record<string, string>)?.entity_type || 'unknown',
          remaining: (e.metadata as Record<string, unknown>)?.remaining ?? null,
          timestamp: new Date(e.created_at).toISOString(),
        })),
        totalEvents: userEvents?.length || 0,
      });
    }

    // ── Top blocked users ──
    const { data: topBlocked } = await supabase
      .from('audit_logs')
      .select('user_id, metadata, created_at')
      .eq('action', 'security.rate_limit_exceeded')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    // Aggregate by user
    const userMap = new Map<string, { blocked: number; endpoints: Set<string>; lastAt: number }>();
    if (topBlocked) {
      for (const row of topBlocked) {
        const uid = row.user_id;
        if (!uid) continue;
        const existing = userMap.get(uid) || { blocked: 0, endpoints: new Set(), lastAt: 0 };
        existing.blocked++;
        existing.endpoints.add((row.metadata as Record<string, string>)?.entity_type || 'unknown');
        existing.lastAt = Math.max(existing.lastAt, row.created_at);
        userMap.set(uid, existing);
      }
    }

    const topUsers = Array.from(userMap.entries())
      .map(([userId, data]) => ({
        userId,
        blockedCount: data.blocked,
        endpointsAffected: data.endpoints.size,
        lastBlocked: new Date(data.lastAt).toISOString(),
      }))
      .sort((a, b) => b.blockedCount - a.blockedCount)
      .slice(0, 20);

    // ── Endpoint summary ──
    const { data: allEvents } = await supabase
      .from('audit_logs')
      .select('action, entity_type')
      .in('action', ['security.rate_limit_exceeded', 'security.rate_limit_warning'])
      .gte('created_at', since);

    const endpointStats = new Map<string, { exceeded: number; warning: number }>();
    if (allEvents) {
      for (const row of allEvents) {
        const key = row.entity_type;
        const existing = endpointStats.get(key) || { exceeded: 0, warning: 0 };
        if (row.action === 'security.rate_limit_exceeded') existing.exceeded++;
        else existing.warning++;
        endpointStats.set(key, existing);
      }
    }

    const endpointSummary = Array.from(endpointStats.entries()).map(([endpoint, stats]) => ({
      endpoint,
      blocked: stats.exceeded,
      warnings: stats.warning,
      total: stats.exceeded + stats.warning,
    }));

    // ── Hourly distribution (last 7d regardless of range param) ──
    const hourlySince = now - windows['7d'];
    const { data: hourlyData } = await supabase
      .from('audit_logs')
      .select('action, entity_type, created_at')
      .in('action', ['security.rate_limit_exceeded', 'security.rate_limit_warning'])
      .gte('created_at', hourlySince);

    const hourlyBuckets = new Map<string, { blocked: number; warning: number }>();
    if (hourlyData) {
      for (const row of hourlyData) {
        const hour = new Date(row.created_at).toISOString().slice(0, 13) + ':00:00Z';
        const existing = hourlyBuckets.get(hour) || { blocked: 0, warning: 0 };
        if (row.action === 'security.rate_limit_exceeded') existing.blocked++;
        else existing.warning++;
        hourlyBuckets.set(hour, existing);
      }
    }

    const hourlyDistribution = Array.from(hourlyBuckets.entries())
      .map(([hour, stats]) => ({ hour, ...stats }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    // ── Total counts ──
    const { count: totalBlocked } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'security.rate_limit_exceeded')
      .gte('created_at', since);

    const { count: totalWarnings } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'security.rate_limit_warning')
      .gte('created_at', since);

    // Count distinct users (Supabase doesn't support countDistinct with head:true)
    const { data: userRows } = await supabase
      .from('audit_logs')
      .select('user_id')
      .in('action', ['security.rate_limit_exceeded', 'security.rate_limit_warning'])
      .gte('created_at', since)
      .not('user_id', 'is', null);
    const uniqueUsers = new Set(userRows?.map((r) => r.user_id)).size;

    // ── Log this analytics access ──
    writeAuditLog({
      userId: auth.user.id,
      action: AUDIT_ACTIONS.CONFIG_UPDATE,
      entityType: 'analytics',
      entityId: 'rate-limit-dashboard',
      metadata: { range, totalBlocked, totalWarnings },
    });

    return Response.json({
      range,
      summary: {
        totalBlocked: totalBlocked || 0,
        totalWarnings: totalWarnings || 0,
        uniqueUsers: uniqueUsers || 0,
      },
      topUsers,
      endpointSummary,
      hourlyDistribution,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Analytics query failed' },
      { status: 500 }
    );
  }
}

// ─── DELETE: Reset rate limits for a user ────

export async function DELETE(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });

  let body: { userId: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId } = body;
  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  const deleted = await resetUserRateLimits(userId);

  writeAuditLog({
    userId: auth.user.id,
    action: AUDIT_ACTIONS.CONFIG_UPDATE,
    entityType: 'rate_limit_reset',
    entityId: userId,
    metadata: { deletedKeys: deleted, targetUserId: userId },
  });

  return Response.json({ success: true, deletedKeys: deleted });
}
