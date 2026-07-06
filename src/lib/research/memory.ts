// ═══════════════════════════════════════
// ORACLE — Research Memory
// Persist analysis findings across sessions
// CRUD operations with TTL expiry support
// ═══════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';
import type { ResearchType } from './types';

const log = createLogger('ResearchMemory');

// ─── Supabase Client ──────────────────

let memoryClient: SupabaseClient | null = null;

function getMemoryClient(): SupabaseClient | null {
  if (memoryClient) return memoryClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  memoryClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return memoryClient;
}

// ─── Types ────────────────────────────

export interface ResearchFindingRecord {
  id: string;
  userId: string;
  clientId?: string;
  researchType: ResearchType;
  targetUrl?: string;
  targetQuery?: string;
  findings: Record<string, unknown>;
  reportMarkdown?: string;
  createdAt: number;
  expiresAt?: number;
}

export interface StoreFindingOptions {
  userId: string;
  clientId?: string;
  researchType: ResearchType;
  targetUrl?: string;
  targetQuery?: string;
  findings: Record<string, unknown>;
  reportMarkdown?: string;
  /** TTL in milliseconds. Finding will be auto-expired after this duration. */
  ttlMs?: number;
}

export interface ListFindingsOptions {
  userId: string;
  clientId?: string;
  researchType?: ResearchType;
  targetUrl?: string;
  limit?: number;
  offset?: number;
  includeExpired?: boolean;
}

// ─── Store a Finding ──────────────────

/**
 * Store a research finding in the database.
 * Returns the stored finding record.
 */
export async function storeFinding(
  options: StoreFindingOptions,
): Promise<ResearchFindingRecord> {
  const client = getMemoryClient();
  if (!client) throw new Error('Supabase not configured');

  const now = Date.now();
  const { data, error } = await client
    .from('research_findings')
    .insert({
      user_id: options.userId,
      client_id: options.clientId || null,
      research_type: options.researchType,
      target_url: options.targetUrl || null,
      target_query: options.targetQuery || null,
      findings: options.findings,
      report_markdown: options.reportMarkdown || null,
      created_at: now,
      expires_at: options.ttlMs ? now + options.ttlMs : null,
    })
    .select()
    .single();

  if (error) {
    log.error('Failed to store research finding', { error: error.message });
    throw new Error(`Failed to store finding: ${error.message}`);
  }

  log.info(`Stored research finding`, {
    id: data.id,
    researchType: options.researchType,
    targetUrl: options.targetUrl,
  });

  return mapRowToFinding(data);
}

// ─── List Findings ────────────────────

/**
 * List research findings for a user, with optional filters.
 * Respects TTL expiry unless includeExpired is true.
 */
export async function listFindings(
  options: ListFindingsOptions,
): Promise<ResearchFindingRecord[]> {
  const client = getMemoryClient();
  if (!client) throw new Error('Supabase not configured');

  const {
    userId,
    clientId,
    researchType,
    targetUrl,
    limit = 50,
    offset = 0,
    includeExpired = false,
  } = options;

  let query = client
    .from('research_findings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (clientId) query = query.eq('client_id', clientId);
  if (researchType) query = query.eq('research_type', researchType);
  if (targetUrl) query = query.eq('target_url', targetUrl);

  // Filter out expired findings unless requested
  if (!includeExpired) {
    const now = Date.now();
    query = query.or(`expires_at.is.null,expires_at.gt.${now}`);
  }

  const { data, error } = await query;

  if (error) {
    log.error('Failed to list research findings', { error: error.message });
    throw new Error(`Failed to list findings: ${error.message}`);
  }

  return (data || []).map(mapRowToFinding);
}

// ─── Get a Single Finding ─────────────

/**
 * Get a single research finding by ID.
 */
export async function getFinding(
  findingId: string,
  userId: string,
): Promise<ResearchFindingRecord | null> {
  const client = getMemoryClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('research_findings')
    .select('*')
    .eq('id', findingId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    log.error('Failed to get research finding', { error: error.message });
    throw new Error(`Failed to get finding: ${error.message}`);
  }

  // Check if expired
  if (data.expires_at && data.expires_at < Date.now()) {
    return null;
  }

  return mapRowToFinding(data);
}

// ─── Delete a Finding ─────────────────

/**
 * Delete a research finding by ID.
 */
export async function deleteFinding(
  findingId: string,
  userId: string,
): Promise<boolean> {
  const client = getMemoryClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('research_findings')
    .delete()
    .eq('id', findingId)
    .eq('user_id', userId);

  if (error) {
    log.error('Failed to delete research finding', { error: error.message });
    throw new Error(`Failed to delete finding: ${error.message}`);
  }

  log.info(`Deleted research finding`, { id: findingId });
  return true;
}

// ─── Cleanup Expired Findings ─────────

/**
 * Delete all expired research findings.
 * Useful for background cleanup jobs (Inngest).
 */
export async function cleanupExpiredFindings(): Promise<number> {
  const client = getMemoryClient();
  if (!client) throw new Error('Supabase not configured');

  const now = Date.now();

  const { data, error } = await client
    .from('research_findings')
    .delete()
    .not('expires_at', 'is', null)
    .lt('expires_at', now)
    .select('id');

  if (error) {
    log.error('Failed to cleanup expired findings', { error: error.message });
    throw new Error(`Failed to cleanup: ${error.message}`);
  }

  const count = data?.length || 0;
  if (count > 0) {
    log.info(`Cleaned up ${count} expired research findings`);
  }
  return count;
}

// ─── Count Findings ───────────────────

/**
 * Count research findings for a user, with optional filters.
 */
export async function countFindings(
  options: { userId: string; researchType?: ResearchType; clientId?: string; includeExpired?: boolean },
): Promise<number> {
  const client = getMemoryClient();
  if (!client) throw new Error('Supabase not configured');

  let query = client
    .from('research_findings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', options.userId);

  // Filter out expired findings unless requested
  if (!options.includeExpired) {
    query = query.or(`expires_at.is.null,expires_at.gt.${Date.now()}`);
  }

  if (options.researchType) query = query.eq('research_type', options.researchType);
  if (options.clientId) query = query.eq('client_id', options.clientId);

  const { count, error } = await query;

  if (error) {
    log.error('Failed to count research findings', { error: error.message });
    throw new Error(`Failed to count findings: ${error.message}`);
  }

  return count || 0;
}

// ─── Helpers ──────────────────────────

function mapRowToFinding(row: Record<string, unknown>): ResearchFindingRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    clientId: row.client_id ? String(row.client_id) : undefined,
    researchType: row.research_type as ResearchType,
    targetUrl: row.target_url ? String(row.target_url) : undefined,
    targetQuery: row.target_query ? String(row.target_query) : undefined,
    findings: (row.findings as Record<string, unknown>) || {},
    reportMarkdown: row.report_markdown ? String(row.report_markdown) : undefined,
    createdAt: Number(row.created_at),
    expiresAt: row.expires_at ? Number(row.expires_at) : undefined,
  };
}
