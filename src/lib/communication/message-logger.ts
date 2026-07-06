// ═══════════════════════════════════════
// ORACLE — Message Logger
// Stores all outbound/inbound messages to
// Supabase for audit trail and analytics
// ═══════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';
import type { MessageLog, MessageDirection, MessageStatus } from './types';

const log = createLogger('MessageLogger');

// ─── Supabase Client ───────────────────

let loggerClient: SupabaseClient | null = null;

function getLoggerClient(): SupabaseClient | null {
  if (loggerClient) return loggerClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  loggerClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return loggerClient;
}

// ─── Log Message ───────────────────────

/**
 * Log a message to the database for audit trail.
 * Called after every successful send via WhatsApp or Email.
 */
export async function logMessage(entry: {
  userId: string;
  clientId?: string;
  leadId?: string;
  channel: 'whatsapp' | 'email';
  direction: MessageDirection;
  to: string;
  from: string;
  subject?: string;
  body: string;
  templateId?: string;
  providerMessageId?: string;
  status: MessageStatus;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const client = getLoggerClient();
  if (!client) {
    log.warn('Message logger not configured — skipping log');
    return null;
  }

  const now = Date.now();

  try {
    const { data, error } = await client
      .from('message_logs')
      .insert({
        user_id: entry.userId,
        client_id: entry.clientId || null,
        lead_id: entry.leadId || null,
        channel: entry.channel,
        direction: entry.direction,
        to: entry.to,
        from: entry.from,
        subject: entry.subject || null,
        body: entry.body,
        template_id: entry.templateId || null,
        provider_message_id: entry.providerMessageId || null,
        status: entry.status,
        error_code: entry.errorCode || null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (error) {
      log.error('Failed to log message:', { error: error.message });
      return null;
    }

    return data?.id || null;
  } catch (err) {
    log.error('Message logging failed:', { error: String(err) });
    return null;
  }
}

// ─── Update Status ─────────────────────

/**
 * Update message status (e.g., when WhatsApp webhook delivers status update).
 */
export async function updateMessageStatus(
  providerMessageId: string,
  status: MessageStatus,
  errorCode?: string,
): Promise<boolean> {
  const client = getLoggerClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('message_logs')
      .update({
        status,
        error_code: errorCode || null,
        updated_at: Date.now(),
      })
      .eq('provider_message_id', providerMessageId);

    if (error) {
      log.error('Failed to update message status:', { error: error.message });
      return false;
    }

    return true;
  } catch (err) {
    log.error('Status update failed:', { error: String(err) });
    return false;
  }
}

// ─── Query Messages ────────────────────

/**
 * Get message history for a client or lead.
 */
export async function getMessageHistory(params: {
  userId: string;
  clientId?: string;
  leadId?: string;
  channel?: 'whatsapp' | 'email';
  limit?: number;
  offset?: number;
}): Promise<MessageLog[]> {
  const client = getLoggerClient();
  if (!client) return [];

  try {
    let query = client
      .from('message_logs')
      .select('*')
      .eq('user_id', params.userId)
      .order('created_at', { ascending: false })
      .range(params.offset || 0, (params.offset || 0) + (params.limit || 50) - 1);

    if (params.clientId) query = query.eq('client_id', params.clientId);
    if (params.leadId) query = query.eq('lead_id', params.leadId);
    if (params.channel) query = query.eq('channel', params.channel);

    const { data, error } = await query;

    if (error) {
      log.error('Failed to fetch message history:', { error: error.message });
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      clientId: row.client_id,
      leadId: row.lead_id,
      channel: row.channel,
      direction: row.direction,
      to: row.to,
      from: row.from,
      subject: row.subject,
      body: row.body,
      templateId: row.template_id,
      providerMessageId: row.provider_message_id,
      status: row.status,
      errorCode: row.error_code,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (err) {
    log.error('Message history query failed:', { error: String(err) });
    return [];
  }
}

/**
 * Get message statistics for a user.
 */
export async function getMessageStats(userId: string): Promise<{
  total: number;
  byChannel: Record<string, number>;
  byStatus: Record<string, number>;
  byDirection: Record<string, number>;
}> {
  const client = getLoggerClient();
  const empty = { total: 0, byChannel: {}, byStatus: {}, byDirection: {} };

  if (!client) return empty;

  try {
    const { data, error } = await client
      .from('message_logs')
      .select('channel, status, direction')
      .eq('user_id', userId);

    if (error || !data) return empty;

    const stats = {
      total: data.length,
      byChannel: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byDirection: {} as Record<string, number>,
    };

    for (const row of data) {
      stats.byChannel[row.channel] = (stats.byChannel[row.channel] || 0) + 1;
      stats.byStatus[row.status] = (stats.byStatus[row.status] || 0) + 1;
      stats.byDirection[row.direction] = (stats.byDirection[row.direction] || 0) + 1;
    }

    return stats;
  } catch {
    return empty;
  }
}
