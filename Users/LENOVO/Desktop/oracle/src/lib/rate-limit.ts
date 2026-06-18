// ═══════════════════════════════════════
// ORACLE — Rate Limiter
// @upstash/ratelimit with Redis (production)
// Falls back to in-memory when Redis is not configured
// ═══════════════════════════════════════

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ─── Rate Limit Event Logger ──────────

export interface RateLimitEvent {
  key: string;
  ip: string;
  action: string;
  allowed: boolean;
  remaining: number;
  resetAt: number;
  timestamp: string;
}

const ACTION_LABELS: Record<string, string> = {
  'login': 'Login',
  'signup': 'Signup',
  'magic': 'Magic Link',
  'reset': 'Password Reset',
  'pw-update': 'Password Update',
  'email-verify': 'Email Verification',
  'ai:chat': 'AI Chat',
  'web-search': 'Web Search',
  'api:write': 'API Write',
  'api': 'API Read',
};

function getActionLabel(key: string): string {
  const prefix = key.split(':')[0];
  return ACTION_LABELS[prefix] || prefix;
}

/**
 * Logs rate limit events for monitoring and analytics.
 * Blocked events are logged as 'warn', allowed as 'info'.
 * In production, ship these structured logs to Datadog, Logflare, Axiom, etc.
 */
function logRateLimitEvent(event: RateLimitEvent): void {
  const level = event.allowed ? 'info' : 'warn';
  const emoji = event.allowed ? '✅' : '🚫';

  console[level](
    `${emoji} [RateLimit] ${event.action} | IP: ${event.ip} | ` +
    `Allowed: ${event.allowed} | Remaining: ${event.remaining} | ` +
    `Reset: ${new Date(event.resetAt).toISOString()}`
  );
}

// ─── Redis Client (production) ─────────

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : undefined;

// ─── Dynamic Upstash Ratelimit Cache ──
// Instances are created on-demand using DB config or hardcoded defaults.
// Cached by endpoint+limits key so we don't recreate on every request.

type WindowString = `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`;

function windowMsToString(ms: number): WindowString {
  if (ms >= 3600000) return `${Math.round(ms / 3600000)} h`;
  if (ms >= 60000) return `${Math.round(ms / 60000)} m`;
  if (ms >= 1000) return `${Math.round(ms / 1000)} s`;
  return `${ms} ms`;
}

const ratelimitCache = new Map<string, Ratelimit>();

function getOrCreateRatelimit(maxRequests: number, windowMs: number): Ratelimit | null {
  if (!redis) return null;
  const cacheKey = `${maxRequests}:${windowMs}`;
  let instance = ratelimitCache.get(cacheKey);
  if (!instance) {
    instance = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, windowMsToString(windowMs)),
      analytics: true,
    });
    ratelimitCache.set(cacheKey, instance);
  }
  return instance;
}

// ─── Hardcoded defaults (used when DB has no override) ───
const DEFAULT_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  login:       { maxRequests: 5,  windowMs: 15 * 60 * 1000 },
  signup:      { maxRequests: 3,  windowMs: 60 * 60 * 1000 },
  magic:       { maxRequests: 3,  windowMs: 10 * 60 * 1000 },
  'pw-update': { maxRequests: 5,  windowMs: 15 * 60 * 1000 },
  'email-verify': { maxRequests: 10, windowMs: 15 * 60 * 1000 },
  'ai:chat':   { maxRequests: 10, windowMs: 60 * 1000 },
  'web-search':{ maxRequests: 15, windowMs: 60 * 1000 },
  'api:write': { maxRequests: 30, windowMs: 60 * 1000 },
  'api':       { maxRequests: 100, windowMs: 60 * 1000 },
};

// ─── In-Memory Fallback (development) ──

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

if (typeof setInterval !== 'undefined') {
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const key of Array.from(store.keys())) {
      const entry = store.get(key);
      if (entry && entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Reset the in-memory rate limit store. Used in tests to avoid state leakage.
 */
export function __resetRateLimitStoreForTests(): void {
  store.clear();
  if (cleanupTimer !== null) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

function checkInMemoryRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

// ─── Unified Check Function ────────────

/**
 * Get the best matching default limits for a key prefix.
 */
function getDefaultLimitsForKey(key: string): { maxRequests: number; windowMs: number } {
  // Order matters: more specific prefixes first
  if (key.startsWith('pw-update:')) return DEFAULT_LIMITS['pw-update'];
  if (key.startsWith('email-verify:')) return DEFAULT_LIMITS['email-verify'];
  if (key.startsWith('ai:chat:')) return DEFAULT_LIMITS['ai:chat'];
  if (key.startsWith('web-search:')) return DEFAULT_LIMITS['web-search'];
  if (key.startsWith('api:write:')) return DEFAULT_LIMITS['api:write'];
  if (key.startsWith('api:')) return DEFAULT_LIMITS['api'];
  if (key.startsWith('magic:')) return DEFAULT_LIMITS['magic'];
  if (key.startsWith('reset:')) return DEFAULT_LIMITS['magic'];
  if (key.startsWith('login:')) return DEFAULT_LIMITS['login'];
  if (key.startsWith('signup:')) return DEFAULT_LIMITS['signup'];
  return DEFAULT_LIMITS['api']; // Default fallback
}

/**
 * Check rate limit for a given key.
 * Uses Redis (@upstash/ratelimit) when configured, falls back to in-memory.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Check for DB overrides (cached 30s)
  const dbOverride = await getDbConfigForKey(key);
  const maxRequests = dbOverride?.maxRequests ?? config.maxRequests;
  const windowMs = dbOverride?.windowMs ?? config.windowMs;
  const effectiveConfig = { maxRequests, windowMs };

  let result: RateLimitResult;

  // Try Redis-based rate limiting with DB-overridden limits
  if (redis) {
    const ratelimit = getOrCreateRatelimit(maxRequests, windowMs);
    if (ratelimit) {
      const rlResult = await ratelimit.limit(key);
      result = {
        allowed: rlResult.success,
        remaining: rlResult.remaining,
        resetAt: rlResult.reset,
      };
    } else {
      result = checkInMemoryRateLimit(key, effectiveConfig);
    }
  } else {
    // Fallback to in-memory with effective config
    result = checkInMemoryRateLimit(key, effectiveConfig);
  }

  // Log only blocked events
  if (!result.allowed) {
    const ip = key.split(':').pop() || 'unknown';
    logRateLimitEvent({
      key, ip, action: getActionLabel(key),
      allowed: false, remaining: 0, resetAt: result.resetAt,
      timestamp: new Date().toISOString(),
    });
  }

  return result;
}

// ─── Runtime Config Cache ────────────

interface DbRateLimitConfig {
  endpoint: string;
  max_requests: number;
  window_seconds: number;
}

let configCache: DbRateLimitConfig[] | null = null;
let configCacheExpiry = 0;
const CONFIG_CACHE_TTL = 30_000; // 30s

let configClient: SupabaseClient | null = null;
function getConfigClient(): SupabaseClient | null {
  if (configClient) return configClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  configClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return configClient;
}

/**
 * Load rate limit overrides from the database (cached for 30s).
 * Returns null if DB is unavailable — callers fall back to hardcoded defaults.
 */
export async function loadRateLimitConfig(): Promise<DbRateLimitConfig[]> {
  const now = Date.now();
  if (configCache && configCacheExpiry > now) return configCache;

  const client = getConfigClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('rate_limit_config')
      .select('endpoint, max_requests, window_seconds');
    if (error || !data) return [];
    configCache = data;
    configCacheExpiry = now + CONFIG_CACHE_TTL;
    return data;
  } catch {
    return [];
  }
}

/**
 * Get the DB-configured limit for a key prefix, or null to use hardcoded default.
 */
export async function getDbConfigForKey(key: string): Promise<{ maxRequests: number; windowMs: number } | null> {
  const configs = await loadRateLimitConfig();
  const prefix = key.split(':')[0];
  const endpointMap: Record<string, string> = {
    'ai': 'ai_chat',
    'web-search': 'web_search',
    'api': 'api_write',
  };
  const endpoint = endpointMap[prefix || ''];
  if (!endpoint) return null;
  const cfg = configs.find((c) => c.endpoint === endpoint);
  if (!cfg) return null;
  return { maxRequests: cfg.max_requests, windowMs: cfg.window_seconds * 1000 };
}

// ─── Rate Limit Reset ───────────────

/**
 * Delete all rate limit keys matching a user ID prefix.
 * For Redis: deletes ai:chat:{uid}, web-search:{uid}, api:write:{uid}, api:{uid}.
 * For in-memory: deletes matching keys from the store.
 */
export async function resetUserRateLimits(userId: string): Promise<number> {
  const prefixes = ['ai:chat:', 'web-search:', 'api:write:', 'api:'];
  let deleted = 0;

  if (redis) {
    for (const prefix of prefixes) {
      const key = `${prefix}${userId}`;
      try {
        const result = await redis.del(key);
        if (result > 0) deleted++;
      } catch {
        // Ignore individual key delete failures
      }
    }
  } else {
    // In-memory: scan and delete matching keys
    for (const prefix of prefixes) {
      const key = `${prefix}${userId}`;
      if (store.has(key)) {
        store.delete(key);
        deleted++;
      }
    }
  }

  return deleted;
}

// ─── Utility ───────────────────────────

export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

// ─── Preset Configs (for in-memory fallback) ──

export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
};

export const SIGNUP_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowMs: 60 * 60 * 1000,
};

export const MAGIC_LINK_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowMs: 10 * 60 * 1000,
};

export const API_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60 * 1000,
};

export const API_WRITE_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60 * 1000,
};

export const PASSWORD_UPDATE_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
};

export const EMAIL_VERIFY_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
};

export const AI_CHAT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000,
};

export const WEB_SEARCH_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 15,
  windowMs: 60 * 1000,
};

// ─── Convenience: Enforce Rate Limit ──

/**
 * Check rate limit and return a 429 Response if exceeded.
 * Returns null if allowed — call at the top of any route handler.
 *
 * Usage:
 * ```ts
 * const rl = await enforceRateLimit('projects', auth.user.id);
 * if (rl) return rl;
 * ```
 */
export async function enforceRateLimit(
  endpoint: string,
  userId: string,
  config: RateLimitConfig = API_WRITE_RATE_LIMIT,
): Promise<Response | null> {
  const key = `api:write:${endpoint}:${userId}`;
  const result = await checkRateLimit(key, config);

  if (!result.allowed) {
    return Response.json(
      { error: 'Rate limit exceeded. Please wait before trying again.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(config.maxRequests),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}
