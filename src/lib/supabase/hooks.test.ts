import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Mocks ───

const {
  mockGetUser,
  mockGetSession,
  mockOnAuthStateChange,
  mockSignOut,
} = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockGetSession = vi.fn();
  const mockOnAuthStateChange = vi.fn();
  const mockSignOut = vi.fn();
  return { mockGetUser, mockGetSession, mockOnAuthStateChange, mockSignOut };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn().mockReturnValue({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
  }),
}));

// ─── Import after mocks ───

import { useUser, useSession, useLogout } from './hooks';

// ─── Tests ─────────────────────────────

describe('useUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it('returns loading state initially', () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { result } = renderHook(() => useUser());

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('returns user after loading', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
  });

  it('returns null user when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });

  it('updates user on auth state change', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockGetUser.mockResolvedValue({ data: { user: null } });

    let authCallback: ((event: string, session: { user: typeof mockUser } | null) => void) | undefined;
    mockOnAuthStateChange.mockImplementation((_cb: typeof authCallback) => {
      authCallback = _cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Simulate auth state change
    act(() => {
      authCallback!('SIGNED_IN', { user: mockUser });
    });

    expect(result.current.user).toEqual(mockUser);
  });

  it('clears user on sign out', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });

    let authCallback: ((event: string, session: null) => void) | undefined;
    mockOnAuthStateChange.mockImplementation((_cb: typeof authCallback) => {
      authCallback = _cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    // Simulate sign out
    act(() => {
      authCallback!('SIGNED_OUT', null);
    });

    expect(result.current.user).toBeNull();
  });
});

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it('returns loading state initially', () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const { result } = renderHook(() => useSession());

    expect(result.current.loading).toBe(true);
    expect(result.current.session).toBeNull();
  });

  it('returns session after loading', async () => {
    const mockSession = { access_token: 'token-123', user: { id: 'user-1' } };
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toEqual(mockSession);
  });

  it('returns null session when not authenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toBeNull();
  });
});

describe('useLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '/' },
      writable: true,
    });
  });

  it('returns a logout function', () => {
    const { result } = renderHook(() => useLogout());

    expect(typeof result.current).toBe('function');
  });

  it('calls signOut and redirects to /login', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current();
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });
});
