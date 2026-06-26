// ═══════════════════════════════════════
// ORACLE — Audit Log Utility
// Track API and user actions for compliance
// ═══════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const log = createLogger('AuditLog');

// Singleton Supabase client for audit logging (avoids creating one per call)
let auditClient: SupabaseClient | null = null;

function getAuditClient(): SupabaseClient | null {
  if (auditClient) return auditClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  auditClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return auditClient;
}

export interface AuditLogEntry {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write an audit log entry to the database.
 * Uses the service-role key to bypass RLS (audit logs are append-only).
 * Fire-and-forget: errors are logged but don't block the caller.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = getAuditClient();
    if (!supabase) {
      log.warn('Audit log skipped — Supabase credentials not configured');
      return;
    }

    const { error } = await supabase.from('audit_logs').insert({
      user_id: entry.userId || null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId || null,
      old_value: entry.oldValue || null,
      new_value: entry.newValue || null,
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
      metadata: entry.metadata || {},
      created_at: Date.now(),
    });

    if (error) {
      log.error('Failed to write audit log', {
        action: entry.action,
        entityType: entry.entityType,
        error: error.message,
      });
    }
  } catch (err) {
    // Never let audit logging break the main request
    log.error('Audit log exception', {
      action: entry.action,
      entityType: entry.entityType,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

// ─── Common Audit Actions ──────────────

export const AUDIT_ACTIONS = {
  // Auth
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_SIGNUP: 'user.signup',
  USER_PASSWORD_RESET: 'user.password_reset',

  // CRUD
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',

  // Payment
  PAYMENT_ORDER_CREATED: 'payment.order_created',
  PAYMENT_VERIFIED: 'payment.verified',

  // AI
  AI_CHAT: 'ai.chat',
  AI_ORCHESTRATOR: 'ai.orchestrator',

  // Config
  CONFIG_UPDATE: 'config.update',
  API_KEY_UPDATE: 'config.api_key_update',

  // Security
  RATE_LIMIT_EXCEEDED: 'security.rate_limit_exceeded',
  RATE_LIMIT_WARNING: 'security.rate_limit_warning',
} as const;
