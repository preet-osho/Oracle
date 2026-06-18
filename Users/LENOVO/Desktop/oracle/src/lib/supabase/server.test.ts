import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───

const {
  mockCookieStore,
  mockGetUser,
  mockSupabaseClient,
} = vi.hoisted(() => {
  const mockCookieStore = {
    get: vi.fn(),
    set: vi.fn(),
  };
  const mockGetUser = vi.fn();
  const mockSupabaseClient = {
    auth: { getUser: mockGetUser },
  };
  return { mockCookieStore, mockGetUser, mockSupabaseClient };
});

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn().mockReturnValue(mockSupabaseClient),
}));

// ─── Import after mocks ───

import { createClient, getUser, requireAuth } from './server';

// ─── Tests ─────────────────────────────

describe('supabase server createClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('creates a server client with cookie access', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'session-token' });

    const client = await createClient();

    expect(client).toBe(mockSupabaseClient);
  });

  it('get cookie returns value from cookieStore', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'my-session' });

    await createClient();

    // The cookies.get callback should return the cookie value
    const { createServerClient } = await import('@supabase/ssr');
    const cookieOptions = (createServerClient as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = cookieOptions.cookies.get('sb-session');

    expect(mockCookieStore.get).toHaveBeenCalledWith('sb-session');
    expect(result).toBe('my-session');
  });

  it('get cookie returns undefined when not found', async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    await createClient();

    const { createServerClient } = await import('@supabase/ssr');
    const cookieOptions = (createServerClient as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = cookieOptions.cookies.get('missing');

    expect(result).toBeUndefined();
  });

  it('set cookie calls cookieStore.set', async () => {
    await createClient();

    const { createServerClient } = await import('@supabase/ssr');
    const cookieOptions = (createServerClient as ReturnType<typeof vi.fn>).mock.calls[0][2];
    cookieOptions.cookies.set('token', 'value', { path: '/' });

    expect(mockCookieStore.set).toHaveBeenCalledWith({ name: 'token', value: 'value', path: '/' });
  });

  it('set cookie handles errors gracefully (Server Component)', async () => {
    mockCookieStore.set.mockImplementation(() => {
      throw new Error('Cookies can only be set in a Server Action or Route Handler');
    });
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    await createClient();

    const { createServerClient } = await import('@supabase/ssr');
    const cookieOptions = (createServerClient as ReturnType<typeof vi.fn>).mock.calls[0][2];

    // Should not throw
    expect(() => cookieOptions.cookies.set('token', 'value', { path: '/' })).not.toThrow();
    expect(debugSpy).toHaveBeenCalled();
    debugSpy.mockRestore();
  });

  it('remove cookie calls cookieStore.set with empty value', async () => {
    await createClient();

    const { createServerClient } = await import('@supabase/ssr');
    const cookieOptions = (createServerClient as ReturnType<typeof vi.fn>).mock.calls[0][2];
    cookieOptions.cookies.remove('token', { path: '/' });

    expect(mockCookieStore.set).toHaveBeenCalledWith({ name: 'token', value: '', path: '/' });
  });
});

describe('getUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('returns user when authenticated', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const user = await getUser();

    expect(user).toEqual(mockUser);
  });

  it('returns null when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const user = await getUser();

    expect(user).toBeNull();
  });

  it('returns null on auth error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid token' } });

    const user = await getUser();

    expect(user).toBeNull();
  });
});

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('returns user when authenticated', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const user = await requireAuth();

    expect(user).toEqual(mockUser);
  });

  it('throws UNAUTHORIZED when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(requireAuth()).rejects.toThrow('UNAUTHORIZED');
  });

  it('throws UNAUTHORIZED on auth error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'fail' } });

    await expect(requireAuth()).rejects.toThrow('UNAUTHORIZED');
  });
});
