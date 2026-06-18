import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock @supabase/ssr ───

const mockCreateBrowserClient = vi.fn().mockReturnValue({ auth: {} });

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: (...args: unknown[]) => mockCreateBrowserClient(...args),
}));

// ─── Import after mock ───

import { createClient } from './client';

// ─── Tests ─────────────────────────────

describe('supabase client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton by clearing the module cache
    vi.resetModules();
  });

  it('creates a browser client with env vars', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

    const { createClient: freshCreateClient } = await import('./client');
    const client = freshCreateClient();

    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
    );
    expect(client).toEqual({ auth: {} });
  });

  it('returns the same client instance (singleton)', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

    const { createClient: freshCreateClient } = await import('./client');
    const client1 = freshCreateClient();
    const client2 = freshCreateClient();

    expect(client1).toBe(client2);
    expect(mockCreateBrowserClient).toHaveBeenCalledTimes(1);
  });
});
