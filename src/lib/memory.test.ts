import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MemoryItem } from '@/types';

// ─── Hoisted mocks (vi.hoisted ensures these exist before vi.mock factories run) ───

const {
  mockMemoriesApi,
  mockCallSync,
} = vi.hoisted(() => {
  const mockMemoriesApi = {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    getAllClientIds: vi.fn(),
  };
  const mockCallSync = vi.fn();
  return { mockMemoriesApi, mockCallSync };
});

vi.mock('@/lib/api', () => ({
  memoriesApi: mockMemoriesApi,
}));

// Mock the router (used by extractAndSaveMemories via dynamic import)
vi.mock('@/lib/router', () => ({
  NeverStopRouter: { callSync: mockCallSync },
}));

// Import after mocks
import {
  saveMemory,
  getMemories,
  deleteMemory,
  formatMemoryForContext,
  extractAndSaveMemories,
  getAllClientIds,
  clearClientMemories,
} from './memory';

// ─── Helpers ───

function makeMemory(overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: 'm1',
    content: 'Client prefers formal tone',
    category: 'preference',
    importance: 2,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────

describe('formatMemoryForContext', () => {
  it('returns empty string for empty memories', () => {
    expect(formatMemoryForContext([])).toBe('');
  });

  it('formats a single memory with category label', () => {
    const result = formatMemoryForContext([makeMemory()]);
    expect(result).toContain('What I remember about this client:');
    expect(result).toContain('[Preference] Client prefers formal tone');
  });

  it('sorts by importance descending', () => {
    const memories = [
      makeMemory({ id: 'low', importance: 1, content: 'Low importance' }),
      makeMemory({ id: 'high', importance: 3, content: 'High importance' }),
      makeMemory({ id: 'mid', importance: 2, content: 'Mid importance' }),
    ];
    const result = formatMemoryForContext(memories);
    const lines = result.split('\n').filter((l) => l.trim().startsWith('-'));
    expect(lines[0]).toContain('High importance');
    expect(lines[1]).toContain('Mid importance');
    expect(lines[2]).toContain('Low importance');
  });

  it('sorts by createdAt descending when importance is equal', () => {
    const memories = [
      makeMemory({ id: 'older', importance: 2, createdAt: 1000, content: 'Older' }),
      makeMemory({ id: 'newer', importance: 2, createdAt: 2000, content: 'Newer' }),
    ];
    const result = formatMemoryForContext(memories);
    const lines = result.split('\n').filter((l) => l.trim().startsWith('-'));
    expect(lines[0]).toContain('Newer');
    expect(lines[1]).toContain('Older');
  });

  it('capitalizes category labels', () => {
    const memories = [
      makeMemory({ category: 'fact', content: 'Business details' }),
      makeMemory({ category: 'feedback', content: 'Client feedback' }),
      makeMemory({ category: 'contact', content: 'Contact info' }),
    ];
    const result = formatMemoryForContext(memories);
    expect(result).toContain('[Fact]');
    expect(result).toContain('[Feedback]');
    expect(result).toContain('[Contact]');
  });
});

describe('saveMemory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls memoriesApi.create and returns MemoryItem', async () => {
    mockMemoriesApi.create.mockResolvedValue({
      id: 'new-id',
      client_id: 'c1',
      content: 'Test memory',
      category: 'fact',
      importance: 3,
      created_at: 12345,
    });

    const result = await saveMemory('c1', 'Test memory', 'fact', 3);

    expect(mockMemoriesApi.create).toHaveBeenCalledWith({
      client_id: 'c1',
      content: 'Test memory',
      category: 'fact',
      importance: 3,
    });
    expect(result).toEqual({
      id: 'new-id',
      content: 'Test memory',
      category: 'fact',
      importance: 3,
      createdAt: 12345,
    });
  });

  it('uses default importance of 2', async () => {
    mockMemoriesApi.create.mockResolvedValue({
      id: 'x', client_id: 'c1', content: 'x', category: 'preference', importance: 2, created_at: 0,
    });
    await saveMemory('c1', 'x', 'preference');
    expect(mockMemoriesApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ importance: 2 }),
    );
  });
});

describe('getMemories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps API rows to MemoryItem[]', async () => {
    mockMemoriesApi.list.mockResolvedValue([
      { id: 'a', client_id: 'c1', content: 'A', category: 'fact', importance: 1, created_at: 100 },
      { id: 'b', client_id: 'c1', content: 'B', category: 'decision', importance: 2, created_at: 200 },
    ]);

    const result = await getMemories('c1');

    expect(mockMemoriesApi.list).toHaveBeenCalledWith('c1');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'a', content: 'A', category: 'fact', importance: 1, createdAt: 100,
    });
  });
});

describe('deleteMemory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true on success', async () => {
    mockMemoriesApi.delete.mockResolvedValue({ success: true });
    expect(await deleteMemory('c1', 'm1')).toBe(true);
    expect(mockMemoriesApi.delete).toHaveBeenCalledWith('m1');
  });

  it('returns false and warns on failure', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMemoriesApi.delete.mockRejectedValue(new Error('fail'));
    expect(await deleteMemory('c1', 'm1')).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('getAllClientIds', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns client IDs from API', async () => {
    mockMemoriesApi.getAllClientIds.mockResolvedValue(['c1', 'c2']);
    const result = await getAllClientIds();
    expect(result).toEqual(['c1', 'c2']);
  });

  it('returns empty array on failure', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMemoriesApi.getAllClientIds.mockRejectedValue(new Error('fail'));
    expect(await getAllClientIds()).toEqual([]);
    warnSpy.mockRestore();
  });
});

describe('clearClientMemories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes all memories for a client', async () => {
    mockMemoriesApi.list.mockResolvedValue([
      { id: 'm1', client_id: 'c1', content: 'A', category: 'fact', importance: 1, created_at: 0 },
      { id: 'm2', client_id: 'c1', content: 'B', category: 'fact', importance: 1, created_at: 0 },
    ]);
    mockMemoriesApi.delete.mockResolvedValue({ success: true });

    await clearClientMemories('c1');

    expect(mockMemoriesApi.list).toHaveBeenCalledWith('c1');
    expect(mockMemoriesApi.delete).toHaveBeenCalledTimes(2);
    expect(mockMemoriesApi.delete).toHaveBeenCalledWith('m1');
    expect(mockMemoriesApi.delete).toHaveBeenCalledWith('m2');
  });

  it('does not throw on failure', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMemoriesApi.list.mockRejectedValue(new Error('fail'));
    await expect(clearClientMemories('c1')).resolves.not.toThrow();
    warnSpy.mockRestore();
  });
});

describe('extractAndSaveMemories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('extracts memories from AI response and saves them', async () => {
    mockMemoriesApi.list.mockResolvedValue([]);
    mockCallSync.mockResolvedValue({
      text: JSON.stringify([
        { content: 'Prefers email', category: 'preference', importance: 2 },
        { content: 'Based in Mumbai', category: 'fact', importance: 1 },
      ]),
    });

    mockMemoriesApi.create.mockResolvedValue({
      id: 'new', client_id: 'c1', content: 'x', category: 'fact', importance: 2, created_at: 0,
    });

    await extractAndSaveMemories('c1', 'We prefer email communication');

    expect(mockCallSync).toHaveBeenCalled();
    expect(mockMemoriesApi.create).toHaveBeenCalledTimes(2);
  });

  it('handles empty AI response gracefully', async () => {
    mockMemoriesApi.list.mockResolvedValue([]);
    mockCallSync.mockResolvedValue({ text: 'No memories found' });

    await extractAndSaveMemories('c1', 'Hello');

    expect(mockMemoriesApi.create).not.toHaveBeenCalled();
  });

  it('skips extraction when client at memory limit', async () => {
    // 100 existing memories = at MAX_MEMORIES_PER_CLIENT
    const existing = Array.from({ length: 100 }, (_, i) => ({
      id: `m${i}`, client_id: 'c1', content: `Memory ${i}`, category: 'fact', importance: 1, created_at: i,
    }));
    mockMemoriesApi.list.mockResolvedValue(existing);

    await extractAndSaveMemories('c1', 'New conversation');

    expect(mockCallSync).not.toHaveBeenCalled();
    expect(mockMemoriesApi.create).not.toHaveBeenCalled();
  });

  it('deduplicates against existing memories', async () => {
    mockMemoriesApi.list.mockResolvedValue([
      { id: 'e1', client_id: 'c1', content: 'prefers email', category: 'preference', importance: 2, created_at: 0 },
    ]);
    mockCallSync.mockResolvedValue({
      text: JSON.stringify([
        { content: 'Prefers email', category: 'preference', importance: 2 },
        { content: 'Based in Mumbai', category: 'fact', importance: 1 },
      ]),
    });
    mockMemoriesApi.create.mockResolvedValue({
      id: 'new', client_id: 'c1', content: 'x', category: 'fact', importance: 2, created_at: 0,
    });

    await extractAndSaveMemories('c1', 'We prefer email communication');

    // Only the non-duplicate should be saved
    expect(mockMemoriesApi.create).toHaveBeenCalledTimes(1);
    expect(mockMemoriesApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Based in Mumbai' })
    );
  });

  it('validates and clamps importance values', async () => {
    mockMemoriesApi.list.mockResolvedValue([]);
    mockCallSync.mockResolvedValue({
      text: JSON.stringify([
        { content: 'Test fact', category: 'fact', importance: 99 },
        { content: 'Another fact', category: 'invalid_cat', importance: -5 },
      ]),
    });
    mockMemoriesApi.create.mockResolvedValue({
      id: 'new', client_id: 'c1', content: 'x', category: 'fact', importance: 2, created_at: 0,
    });

    await extractAndSaveMemories('c1', 'Test conversation');

    expect(mockMemoriesApi.create).toHaveBeenCalledTimes(2);
    // First: importance clamped to 3, category stays 'fact'
    expect(mockMemoriesApi.create).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ importance: 3, category: 'fact' })
    );
    // Second: importance -5 → Math.max(1, -5) = 1, category falls back to 'fact'
    expect(mockMemoriesApi.create).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ importance: 1, category: 'fact' })
    );
  });
});
