// ═══════════════════════════════════════
// ORACLE — Memory System
// Short-term (session) memory + Long-term (Supabase + pgvector) persistent memory
// ═══════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const log = createLogger('MemorySystem');

// ─── Types ─────────────────────────────

export type MemoryCategory = 'preference' | 'fact' | 'feedback' | 'decision' | 'contact' | 'sop' | 'lesson' | 'workflow';

export type MemoryImportance = 1 | 2 | 3; // 1=low, 2=medium, 3=high

export interface MemoryItem {
  id: string;
  agentId: string;
  content: string;
  category: MemoryCategory;
  importance: MemoryImportance;
  tags: string[];
  embedding?: number[]; // Vector embedding for semantic search
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  accessCount: number;
  metadata?: Record<string, unknown>;
}

export interface MemorySearchResult {
  memory: MemoryItem;
  score: number; // 0-1 relevance score
  matchType: 'semantic' | 'keyword' | 'category';
}

export interface MemoryStats {
  totalMemories: number;
  byCategory: Record<MemoryCategory, number>;
  byImportance: Record<MemoryImportance, number>;
  avgAccessCount: number;
  oldestMemory: number;
  newestMemory: number;
}

export interface ShortTermMemory {
  sessionId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
  context: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
}

// ─── Database Row Types ────────────────

interface AgentMemoryRow {
  id: string;
  user_id: string;
  agent_id: string;
  content: string;
  category: string;
  importance: number;
  tags: string[];
  embedding: number[] | null;
  access_count: number;
  metadata: Record<string, unknown> | null;
  created_at: number;
  updated_at: number;
  last_accessed_at: number;
}

interface MatchMemoryRow extends AgentMemoryRow {
  similarity: number;
}

// ─── In-Memory Store (Short-Term Only) ──

const shortTermStore: Map<string, ShortTermMemory> = new Map();

// ─── Memory System Class ──────────────

export class MemorySystem {
  private maxShortTermAge: number = 30 * 60 * 1000; // 30 minutes
  private maxMemoriesPerAgent: number = 1000;
  private minImportanceForLongTerm: MemoryImportance = 2;
  private supabase: SupabaseClient | null = null;

  /**
   * Get or create a Supabase client for memory operations.
   * Uses service role key for server-side operations (bypasses RLS).
   */
  private getSupabase(): SupabaseClient {
    if (this.supabase) return this.supabase;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !serviceKey) {
      throw new Error('Supabase URL and key are required for memory persistence');
    }

    this.supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    return this.supabase;
  }

  /**
   * Reset all in-memory stores — use for test isolation
   */
  reset(): void {
    shortTermStore.clear();
    log.debug('Memory system reset');
  }

  // ─── Short-Term Memory (Session) ────

  /**
   * Create or update a short-term session memory
   */
  createSession(sessionId: string, initialContext: Record<string, unknown> = {}): ShortTermMemory {
    const session: ShortTermMemory = {
      sessionId,
      messages: [],
      context: initialContext,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.maxShortTermAge,
    };
    shortTermStore.set(sessionId, session);
    log.info('Session created', { sessionId });
    return session;
  }

  /**
   * Add a message to session memory
   */
  addSessionMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ): void {
    const session = shortTermStore.get(sessionId);
    if (!session) {
      log.warn('Session not found', { sessionId });
      return;
    }

    session.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });

    // Keep only last 50 messages to prevent memory bloat
    if (session.messages.length > 50) {
      session.messages = session.messages.slice(-50);
    }
  }

  /**
   * Get session context for an agent
   */
  getSessionContext(sessionId: string): ShortTermMemory | null {
    const session = shortTermStore.get(sessionId);
    if (!session) return null;

    // Check if expired
    if (Date.now() > session.expiresAt) {
      shortTermStore.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Update session context
   */
  updateSessionContext(
    sessionId: string,
    updates: Record<string, unknown>,
  ): void {
    const session = shortTermStore.get(sessionId);
    if (!session) return;

    session.context = { ...session.context, ...updates };
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let removed = 0;

    for (const [id, session] of shortTermStore) {
      if (now > session.expiresAt) {
        shortTermStore.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      log.info('Cleaned up expired sessions', { count: removed });
    }

    return removed;
  }

  // ─── Long-Term Memory (Persistent) ──

  /**
   * Store a long-term memory in Supabase
   */
  async storeMemory(
    userId: string,
    agentId: string,
    content: string,
    category: MemoryCategory,
    importance: MemoryImportance = 2,
    tags: string[] = [],
    metadata?: Record<string, unknown>,
  ): Promise<MemoryItem> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    const row: Omit<AgentMemoryRow, 'embedding'> = {
      id,
      user_id: userId,
      agent_id: agentId,
      content,
      category,
      importance,
      tags,
      access_count: 0,
      metadata: metadata ?? null,
      created_at: now,
      updated_at: now,
      last_accessed_at: now,
    };

    try {
      const db = this.getSupabase();
      const { error } = await db
        .from('agent_memories')
        .insert(row);

      if (error) {
        log.error('Failed to store memory in Supabase', { error: error.message, id });
        throw error;
      }

      log.info('Memory stored in Supabase', {
        id,
        agentId,
        category,
        importance,
        contentLength: content.length,
      });

      // Enforce memory limit in background (non-blocking)
      this.enforceMemoryLimit(userId, agentId).catch((err) => {
        log.warn('Memory limit enforcement failed', { error: err instanceof Error ? err.message : String(err) });
      });

      return {
        id,
        agentId,
        content,
        category,
        importance,
        tags,
        createdAt: now,
        updatedAt: now,
        lastAccessedAt: now,
        accessCount: 0,
        metadata,
      };
    } catch (err) {
      log.error('Failed to store memory', { error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  /**
   * Retrieve memories by semantic similarity or keyword search
   */
  async searchMemories(
    userId: string,
    agentId: string,
    query: string,
    options: {
      category?: MemoryCategory;
      limit?: number;
      minImportance?: MemoryImportance;
    } = {},
  ): Promise<MemorySearchResult[]> {
    const { category, limit = 10, minImportance = 1 } = options;

    try {
      const db = this.getSupabase();

      // Try semantic search first if embedding is available
      // Fall back to keyword search via RPC
      const { data, error } = await db.rpc('match_agent_memories', {
        query_embedding: null, // Will be set when embeddings are generated
        match_user_id: userId,
        match_agent_id: agentId,
        match_threshold: 0.3,
        match_count: limit,
        filter_category: category ?? null,
        filter_min_importance: minImportance,
      });

      if (error || !data || data.length === 0) {
        // Fall back to direct query with keyword matching
        return await this.searchMemoriesByKeyword(userId, agentId, query, options);
      }

      // Update access stats for returned memories
      const memoryIds = data.map((row: MatchMemoryRow) => row.id);
      await this.touchMemories(memoryIds);

      return data.map((row: MatchMemoryRow) => ({
        memory: this.rowToMemoryItem(row),
        score: row.similarity,
        matchType: 'semantic' as const,
      }));
    } catch (err) {
      log.warn('Semantic search failed, falling back to keyword', {
        error: err instanceof Error ? err.message : String(err),
      });
      return this.searchMemoriesByKeyword(userId, agentId, query, options);
    }
  }

  /**
   * Keyword-based memory search (fallback when embeddings are not available)
   */
  private async searchMemoriesByKeyword(
    userId: string,
    agentId: string,
    query: string,
    options: {
      category?: MemoryCategory;
      limit?: number;
      minImportance?: MemoryImportance;
    } = {},
  ): Promise<MemorySearchResult[]> {
    const { category, limit = 10, minImportance = 1 } = options;
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

    try {
      const db = this.getSupabase();

      let queryBuilder = db
        .from('agent_memories')
        .select('*')
        .eq('user_id', userId)
        .eq('agent_id', agentId)
        .gte('importance', minImportance)
        .order('last_accessed_at', { ascending: false })
        .limit(limit * 3); // Fetch more to filter locally

      if (category) {
        queryBuilder = queryBuilder.eq('category', category);
      }

      const { data, error } = await queryBuilder;

      if (error || !data) {
        log.error('Keyword search failed', { error: error?.message });
        return [];
      }

      // Score each memory by keyword relevance
      const results: MemorySearchResult[] = [];

      for (const row of data) {
        const memory = this.rowToMemoryItem(row);
        const score = this.calculateKeywordScore(memory, queryLower, queryWords);

        if (score > 0.1) {
          results.push({
            memory,
            score,
            matchType: score > 0.7 ? 'keyword' : 'category',
          });
        }
      }

      // Update access stats for returned memories
      const memoryIds = results.map((r) => r.memory.id);
      if (memoryIds.length > 0) {
        await this.touchMemories(memoryIds);
      }

      // Sort by score descending
      results.sort((a, b) => b.score - a.score);

      return results.slice(0, limit);
    } catch (err) {
      log.error('Keyword search error', { error: err instanceof Error ? err.message : String(err) });
      return [];
    }
  }

  /**
   * Get a specific memory by ID
   */
  async getMemory(userId: string, memoryId: string): Promise<MemoryItem | null> {
    try {
      const db = this.getSupabase();
      const { data, error } = await db
        .from('agent_memories')
        .select('*')
        .eq('user_id', userId)
        .eq('id', memoryId)
        .single();

      if (error || !data) return null;

      // Update access stats
      await this.touchMemories([memoryId]);

      return this.rowToMemoryItem(data);
    } catch {
      return null;
    }
  }

  /**
   * Update a memory
   */
  async updateMemory(
    userId: string,
    memoryId: string,
    updates: Partial<Pick<MemoryItem, 'content' | 'category' | 'importance' | 'tags' | 'metadata'>>,
  ): Promise<MemoryItem | null> {
    try {
      const db = this.getSupabase();
      const updateData: Record<string, unknown> = {
        updated_at: Date.now(),
      };

      if (updates.content !== undefined) updateData.content = updates.content;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.importance !== undefined) updateData.importance = updates.importance;
      if (updates.tags !== undefined) updateData.tags = updates.tags;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

      const { data, error } = await db
        .from('agent_memories')
        .update(updateData)
        .eq('user_id', userId)
        .eq('id', memoryId)
        .select()
        .single();

      if (error || !data) {
        log.error('Failed to update memory', { error: error?.message, memoryId });
        return null;
      }

      log.info('Memory updated', { id: memoryId, updates: Object.keys(updates) });

      return this.rowToMemoryItem(data);
    } catch (err) {
      log.error('Memory update error', { error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  /**
   * Delete a memory
   */
  async deleteMemory(userId: string, memoryId: string): Promise<boolean> {
    try {
      const db = this.getSupabase();
      const { error } = await db
        .from('agent_memories')
        .delete()
        .eq('user_id', userId)
        .eq('id', memoryId);

      if (error) {
        log.error('Failed to delete memory', { error: error.message, memoryId });
        return false;
      }

      log.info('Memory deleted', { id: memoryId });
      return true;
    } catch (err) {
      log.error('Memory delete error', { error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }

  /**
   * Prune old/low-importance memories for an agent using database function
   */
  async pruneMemories(
    userId: string,
    agentId: string,
    options: {
      maxAgeDays?: number;
      minImportance?: MemoryImportance;
      keepRecent?: number;
    } = {},
  ): Promise<number> {
    const { maxAgeDays = 90, minImportance = 2, keepRecent = 100 } = options;

    try {
      const db = this.getSupabase();
      const { data, error } = await db.rpc('prune_agent_memories', {
        prune_user_id: userId,
        prune_agent_id: agentId,
        max_age_days: maxAgeDays,
        min_importance: minImportance,
        keep_recent: keepRecent,
      });

      if (error) {
        log.error('Failed to prune memories', { error: error.message });
        return 0;
      }

      const removed = data as number;
      if (removed > 0) {
        log.info('Memories pruned', { agentId, removed });
      }

      return removed;
    } catch (err) {
      log.error('Memory prune error', { error: err instanceof Error ? err.message : String(err) });
      return 0;
    }
  }

  /**
   * Get memory statistics for an agent from database
   */
  async getMemoryStats(
    userId: string,
    agentId: string,
  ): Promise<MemoryStats> {
    try {
      const db = this.getSupabase();
      const { data, error } = await db.rpc('get_agent_memory_stats', {
        stats_user_id: userId,
        stats_agent_id: agentId,
      });

      if (error || !data || data.length === 0) {
        return this.getEmptyStats();
      }

      const row = data[0];

      // Parse JSONB values safely (PostgreSQL may return strings for numeric values)
      const rawCategory = (row.by_category || {}) as Record<string, unknown>;
      const rawImportance = (row.by_importance || {}) as Record<string, unknown>;

      const byCategory: Record<string, number> = {};
      for (const [key, value] of Object.entries(rawCategory)) {
        byCategory[key] = Number(value) || 0;
      }

      const byImportance: Record<string, number> = {};
      for (const [key, value] of Object.entries(rawImportance)) {
        byImportance[key] = Number(value) || 0;
      }

      return {
        totalMemories: Number(row.total_memories) || 0,
        byCategory: byCategory as Record<MemoryCategory, number>,
        byImportance: byImportance as Record<MemoryImportance, number>,
        avgAccessCount: Number(row.avg_access_count) || 0,
        oldestMemory: Number(row.oldest_memory) || Date.now(),
        newestMemory: Number(row.newest_memory) || 0,
      };
    } catch (err) {
      log.error('Memory stats error', { error: err instanceof Error ? err.message : String(err) });
      return this.getEmptyStats();
    }
  }

  // ─── Private Helpers ────────────────

  /**
   * Convert a database row to a MemoryItem
   */
  private rowToMemoryItem(row: AgentMemoryRow): MemoryItem {
    return {
      id: row.id,
      agentId: row.agent_id,
      content: row.content,
      category: row.category as MemoryCategory,
      importance: row.importance as MemoryImportance,
      tags: row.tags || [],
      embedding: row.embedding || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastAccessedAt: row.last_accessed_at,
      accessCount: row.access_count,
      metadata: row.metadata || undefined,
    };
  }

  /**
   * Calculate keyword relevance score for a memory
   */
  private calculateKeywordScore(
    memory: MemoryItem,
    queryLower: string,
    queryWords: string[],
  ): number {
    const contentLower = memory.content.toLowerCase();
    const tagsLower = memory.tags.map((t) => t.toLowerCase());

    let score = 0;

    // Exact match in content (high weight)
    if (contentLower.includes(queryLower)) {
      score += 0.5;
    }

    // Word-level matching
    const contentWords = contentLower.split(/\s+/);
    let matchedWords = 0;
    for (const word of queryWords) {
      if (contentWords.some((cw) => cw.includes(word))) {
        matchedWords++;
      }
      if (tagsLower.some((t) => t.includes(word))) {
        matchedWords += 0.5;
      }
    }
    if (queryWords.length > 0) {
      score += (matchedWords / queryWords.length) * 0.3;
    }

    // Importance boost
    score += memory.importance * 0.05;

    // Recency boost (memories from last 7 days get a boost)
    const ageDays = (Date.now() - memory.createdAt) / (24 * 60 * 60 * 1000);
    if (ageDays < 7) {
      score += 0.1;
    } else if (ageDays < 30) {
      score += 0.05;
    }

    // Access frequency boost
    if (memory.accessCount > 10) {
      score += 0.05;
    }

    return Math.min(1, score);
  }

  /**
   * Update last_accessed_at and access_count for memories
   */
  private async touchMemories(memoryIds: string[]): Promise<void> {
    if (memoryIds.length === 0) return;

    try {
      const db = this.getSupabase();
      const now = Date.now();

      // Update last_accessed_at and increment access_count in parallel
      await Promise.all([
        db
          .from('agent_memories')
          .update({ last_accessed_at: now })
          .in('id', memoryIds),
        db.rpc('increment_agent_memory_access', { memory_ids: memoryIds }),
      ]);
    } catch (err) {
      log.debug('Failed to touch memories (non-critical)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Enforce maximum memory limit per agent
   */
  private async enforceMemoryLimit(userId: string, agentId: string): Promise<void> {
    try {
      const db = this.getSupabase();

      // Count current memories for this agent
      const { count, error: countError } = await db
        .from('agent_memories')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('agent_id', agentId);

      if (countError || !count || count <= this.maxMemoriesPerAgent) return;

      // Delete least recently accessed memories to enforce limit
      const excess = count - this.maxMemoriesPerAgent;
      const { data: toRemove } = await db
        .from('agent_memories')
        .select('id')
        .eq('user_id', userId)
        .eq('agent_id', agentId)
        .order('last_accessed_at', { ascending: true })
        .limit(excess);

      if (toRemove && toRemove.length > 0) {
        const ids = toRemove.map((row: { id: string }) => row.id);
        await db
          .from('agent_memories')
          .delete()
          .in('id', ids);

        log.info('Memory limit enforced', {
          agentId,
          removed: toRemove.length,
        });
      }
    } catch (err) {
      log.debug('Memory limit enforcement failed (non-critical)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Return empty stats object
   */
  private getEmptyStats(): MemoryStats {
    return {
      totalMemories: 0,
      byCategory: {} as Record<MemoryCategory, number>,
      byImportance: {} as Record<MemoryImportance, number>,
      avgAccessCount: 0,
      oldestMemory: 0,
      newestMemory: 0,
    };
  }
}

// ─── Singleton ────────────────────────

let memorySystemInstance: MemorySystem | null = null;

export function getMemorySystem(): MemorySystem {
  if (!memorySystemInstance) {
    memorySystemInstance = new MemorySystem();
  }
  return memorySystemInstance;
}

// ─── Convenience Functions ────────────

export async function storeAgentMemory(
  userId: string,
  agentId: string,
  content: string,
  category: MemoryCategory,
  importance: MemoryImportance = 2,
  tags: string[] = [],
): Promise<MemoryItem> {
  return getMemorySystem().storeMemory(userId, agentId, content, category, importance, tags);
}

export async function searchAgentMemories(
  userId: string,
  agentId: string,
  query: string,
  limit: number = 10,
): Promise<MemorySearchResult[]> {
  return getMemorySystem().searchMemories(userId, agentId, query, { limit });
}

export async function getAgentMemoryStats(
  userId: string,
  agentId: string,
): Promise<MemoryStats> {
  return getMemorySystem().getMemoryStats(userId, agentId);
}
