// ═══════════════════════════════════════
// ORACLE — Rate Limit Config API
// Get and update runtime rate limits per endpoint
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let configClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient | null {
  if (configClient) return configClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  configClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return configClient;
}

// ─── GET: Read current config ──────────

export async function GET(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  const supabase = getServiceClient();
  if (!supabase) {
    return Response.json({ error: 'Service credentials not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const isHistory = searchParams.get('history') === 'true';

  // ── History mode: fetch config change events from audit_logs ──
  if (isHistory) {
    const { data: events, error: eventsError } = await supabase
      .from('audit_logs')
      .select('user_id, entity_id, metadata, created_at')
      .eq('action', 'config.update')
      .eq('entity_type', 'rate_limit_config')
      .order('created_at', { ascending: false })
      .limit(50);

    if (eventsError) {
      return Response.json({ error: eventsError.message }, { status: 500 });
    }

    return Response.json({
      history: (events || []).map((e) => ({
        userId: e.user_id,
        endpoint: e.entity_id,
        changes: e.metadata,
        timestamp: new Date(e.created_at).toISOString(),
      })),
    });
  }

  // ── Default mode: return current config ──
  const { data, error } = await supabase
    .from('rate_limit_config')
    .select('*')
    .order('endpoint');

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const redisConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

  return Response.json({ configs: data || [], redisConfigured });
}

// ─── PUT: Update config ────────────────

export async function PUT(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  const supabase = getServiceClient();
  if (!supabase) {
    return Response.json({ error: 'Service credentials not configured' }, { status: 503 });
  }

  let body: { endpoint: string; maxRequests?: number; windowSeconds?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { endpoint, maxRequests, windowSeconds } = body;

  if (!endpoint) {
    return Response.json({ error: 'endpoint is required' }, { status: 400 });
  }

  // Validate ranges
  if (maxRequests !== undefined && (maxRequests < 1 || maxRequests > 10000)) {
    return Response.json({ error: 'maxRequests must be between 1 and 10000' }, { status: 400 });
  }
  if (windowSeconds !== undefined && (windowSeconds < 1 || windowSeconds > 86400)) {
    return Response.json({ error: 'windowSeconds must be between 1 and 86400' }, { status: 400 });
  }

  // Upsert the config
  const updatePayload: Record<string, unknown> = { endpoint, updated_at: Date.now() };
  if (maxRequests !== undefined) updatePayload.max_requests = maxRequests;
  if (windowSeconds !== undefined) updatePayload.window_seconds = windowSeconds;

  const { data, error } = await supabase
    .from('rate_limit_config')
    .upsert(updatePayload, { onConflict: 'endpoint' })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Audit log the change
  writeAuditLog({
    userId: auth.user.id,
    action: AUDIT_ACTIONS.CONFIG_UPDATE,
    entityType: 'rate_limit_config',
    entityId: endpoint,
    metadata: { maxRequests, windowSeconds },
  });

  return Response.json({ config: data });
}
