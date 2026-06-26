import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───

const { mockGetUser, mockSupabaseClient } = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockSupabaseClient = {
    auth: { getUser: mockGetUser },
  };
  return { mockGetUser, mockSupabaseClient };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn().mockReturnValue({ status: 401, body: { error: 'Unauthorized — please sign in' } }),
  },
}));

// ─── Import after mocks ───

import { validateAuth } from './validate';

// ─── Tests ─────────────────────────────

describe('validateAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user and supabase client when authenticated', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const result = await validateAuth();

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.user).toEqual(mockUser);
      expect(result.supabase).toBe(mockSupabaseClient);
    }
  });

  it('returns 401 error when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await validateAuth();

    expect('error' in result).toBe(true);
  });

  it('returns 401 error on auth error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid token' } });

    const result = await validateAuth();

    expect('error' in result).toBe(true);
  });

  it('returns 401 error when user is null but no error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await validateAuth();

    expect('error' in result).toBe(true);
  });

  it('creates a new supabase client on each call', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    await validateAuth();
    await validateAuth();

    const { createClient } = await import('@/lib/supabase/server');
    expect(createClient).toHaveBeenCalledTimes(2);
  });
});
