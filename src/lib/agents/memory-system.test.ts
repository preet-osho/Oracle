// ═══════════════════════════════════════
// ORACLE — Memory System Tests
// Tests the memory system with Supabase persistence
// Note: These tests mock Supabase since they run without a live database
// ═══════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted mock references ──────────
// Must be declared before vi.mock calls to avoid hoisting issues

const { mockInsert, mockSelect, mockUpdate, mockDelete, mockRpc, mockFrom } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null });
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockRpc = vi.fn();
  const mockFrom = vi.fn();
  return { mockInsert, mockSelect, mockUpdate, mockDelete, mockRpc, mockFrom };
});

// ─── Module Mocks ─────────────────────

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

// ─── Import after mocks ───────────────

import {
  MemorySystem,
  getMemorySystem,
} from './memory-system';

describe('MemorySystem', () => {
  let memorySystem: MemorySystem;

  beforeEach(() => {
    vi.clearAllMocks();
    memorySystem = getMemorySystem();
    memorySystem.reset();

    // Initialize mockRpc with default resolved value
    mockRpc.mockResolvedValue({ data: null, error: null });

    // Reset mockFrom to return a default chain
    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  describe('reset()', () => {
    it('should clear all short-term sessions', () => {
      memorySystem.createSession('session_1', { test: true });
      memorySystem.reset();
      expect(memorySystem.getSessionContext('session_1')).toBeNull();
    });
  });

  describe('Short-Term Memory (Sessions)', () => {
    it('should create a session', () => {
      const session = memorySystem.createSession('session_create', { clientId: 'client_1' });

      expect(session.sessionId).toBe('session_create');
      expect(session.messages).toEqual([]);
      expect(session.context).toEqual({ clientId: 'client_1' });
      expect(session.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should add messages to session', () => {
      memorySystem.createSession('session_msgs');
      memorySystem.addSessionMessage('session_msgs', 'user', 'Hello');
      memorySystem.addSessionMessage('session_msgs', 'assistant', 'Hi there!');

      const session = memorySystem.getSessionContext('session_msgs');
      expect(session).not.toBeNull();
      expect(session!.messages.length).toBe(2);
      expect(session!.messages[0].role).toBe('user');
      expect(session!.messages[1].role).toBe('assistant');
    });

    it('should return null for expired sessions', () => {
      const session = memorySystem.createSession('session_expired');
      session.expiresAt = Date.now() - 1000;

      const retrieved = memorySystem.getSessionContext('session_expired');
      expect(retrieved).toBeNull();
    });

    it('should return null for non-existent sessions', () => {
      const session = memorySystem.getSessionContext('nonexistent_session_xyz');
      expect(session).toBeNull();
    });

    it('should update session context', () => {
      memorySystem.createSession('session_ctx', { initial: true });
      memorySystem.updateSessionContext('session_ctx', { added: true });

      const session = memorySystem.getSessionContext('session_ctx');
      expect(session!.context).toEqual({ initial: true, added: true });
    });

    it('should limit messages to 50', () => {
      memorySystem.createSession('session_limit');

      for (let i = 0; i < 60; i++) {
        memorySystem.addSessionMessage('session_limit', 'user', `Message ${i}`);
      }

      const session = memorySystem.getSessionContext('session_limit');
      expect(session!.messages.length).toBe(50);
      expect(session!.messages[0].content).toBe('Message 10');
    });

    it('should cleanup expired sessions', () => {
      memorySystem.createSession('session_cleanup1');
      memorySystem.createSession('session_cleanup2');

      const s1 = memorySystem.getSessionContext('session_cleanup1');
      if (s1) s1.expiresAt = Date.now() - 1000;

      const removed = memorySystem.cleanupExpiredSessions();
      expect(removed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Long-Term Memory (Supabase-backed)', () => {
    it('should store a memory via Supabase', async () => {
      mockInsert.mockResolvedValueOnce({ error: null });

      const memory = await memorySystem.storeMemory(
        'user-123',
        'agent_store',
        'Client prefers WhatsApp communication',
        'preference',
        2,
        ['communication', 'whatsapp'],
      );

      expect(memory.id).toMatch(/^mem_/);
      expect(memory.agentId).toBe('agent_store');
      expect(memory.content).toBe('Client prefers WhatsApp communication');
      expect(memory.category).toBe('preference');
      expect(memory.importance).toBe(2);
      expect(memory.tags).toEqual(['communication', 'whatsapp']);
      expect(memory.accessCount).toBe(0);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should retrieve a memory by ID via Supabase', async () => {
      const mockRow = {
        id: 'mem_test_123',
        user_id: 'user-123',
        agent_id: 'agent_retrieve',
        content: 'Test memory',
        category: 'fact',
        importance: 2,
        tags: ['test'],
        embedding: null,
        access_count: 5,
        metadata: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        last_accessed_at: Date.now(),
      };

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockRow, error: null }),
            }),
          }),
        }),
      });

      const retrieved = await memorySystem.getMemory('user-123', 'mem_test_123');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('mem_test_123');
      expect(retrieved!.content).toBe('Test memory');
    });

    it('should update a memory via Supabase', async () => {
      const updatedRow = {
        id: 'mem_update_123',
        user_id: 'user-123',
        agent_id: 'agent_update',
        content: 'Updated content',
        category: 'fact',
        importance: 3,
        tags: ['updated'],
        embedding: null,
        access_count: 1,
        metadata: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        last_accessed_at: Date.now(),
      };

      mockFrom.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updatedRow, error: null }),
              }),
            }),
          }),
        }),
      });

      const updated = await memorySystem.updateMemory('user-123', 'mem_update_123', {
        content: 'Updated content',
        importance: 3,
      });

      expect(updated).not.toBeNull();
      expect(updated!.content).toBe('Updated content');
      expect(updated!.importance).toBe(3);
    });

    it('should delete a memory via Supabase', async () => {
      mockFrom.mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      const deleted = await memorySystem.deleteMemory('user-123', 'mem_delete_123');
      expect(deleted).toBe(true);
    });

    it('should return null for non-existent memory', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      });

      const retrieved = await memorySystem.getMemory('user-123', 'mem_nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should search memories via keyword fallback', async () => {
      const mockRows = [
        {
          id: 'mem_search_1',
          user_id: 'user-123',
          agent_id: 'agent_search',
          content: 'Client uses WhatsApp for daily updates',
          category: 'preference',
          importance: 2,
          tags: ['whatsapp'],
          embedding: null,
          access_count: 0,
          metadata: null,
          created_at: Date.now(),
          updated_at: Date.now(),
          last_accessed_at: Date.now(),
        },
        {
          id: 'mem_search_2',
          user_id: 'user-123',
          agent_id: 'agent_search',
          content: 'SEO audit completed for homepage',
          category: 'fact',
          importance: 3,
          tags: ['seo'],
          embedding: null,
          access_count: 0,
          metadata: null,
          created_at: Date.now(),
          updated_at: Date.now(),
          last_accessed_at: Date.now(),
        },
      ];

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
                }),
              }),
            }),
          }),
        }),
      });

      const results = await memorySystem.searchMemories('user-123', 'agent_search', 'WhatsApp');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].memory.content).toContain('WhatsApp');
      expect(results[0].score).toBeGreaterThan(0);
    });
  });

  describe('Memory Pruning', () => {
    it('should prune old memories via RPC', async () => {
      mockRpc.mockResolvedValueOnce({ data: 5, error: null });

      const removed = await memorySystem.pruneMemories('user-123', 'agent_prune', {
        maxAgeDays: 0,
        minImportance: 3,
        keepRecent: 10,
      });

      expect(removed).toBe(5);
      expect(mockRpc).toHaveBeenCalledWith('prune_agent_memories', expect.objectContaining({
        prune_user_id: 'user-123',
        prune_agent_id: 'agent_prune',
      }));
    });
  });

  describe('Memory Stats', () => {
    it('should return stats via RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          total_memories: 3,
          by_category: { fact: 1, preference: 1, feedback: 1 },
          by_importance: { '1': 1, '2': 1, '3': 1 },
          avg_access_count: 5,
          oldest_memory: Date.now() - 86400000,
          newest_memory: Date.now(),
        }],
        error: null,
      });

      const stats = await memorySystem.getMemoryStats('user-123', 'agent_stats');

      expect(stats.totalMemories).toBe(3);
      expect(stats.byCategory['fact']).toBe(1);
      expect(stats.byImportance[2]).toBe(1);
      expect(stats.avgAccessCount).toBe(5);
    });

    it('should return empty stats on error', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'RPC error' } });

      const stats = await memorySystem.getMemoryStats('user-123', 'unknown_agent');

      expect(stats.totalMemories).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase insert errors gracefully', async () => {
      mockInsert.mockResolvedValueOnce({ error: { message: 'Duplicate key' } });

      await expect(
        memorySystem.storeMemory('user-123', 'agent', 'test', 'fact'),
      ).rejects.toThrow();
    });

    it('should return empty array on search errors', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'RPC failed' } });
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockRejectedValue(new Error('Query failed')),
                }),
              }),
            }),
          }),
        }),
      });

      const results = await memorySystem.searchMemories('user-123', 'agent', 'test');
      expect(results).toEqual([]);
    });
  });
});

describe('getMemorySystem', () => {
  it('should return a singleton instance', () => {
    const ms1 = getMemorySystem();
    const ms2 = getMemorySystem();
    expect(ms1).toBe(ms2);
  });
});
