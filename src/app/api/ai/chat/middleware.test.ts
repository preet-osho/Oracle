// ═══════════════════════════════════════
// ORACLE — Chat Middleware Tests
// Tests for shared auth, rate-limiting, and validation middleware
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Hoisted Mocks ────────────────────

const {
  mockValidateAuth,
  mockGetUserSubscription,
  mockGetEffectivePlan,
  mockIncrementAndCheckDailyLimit,
  mockCheckRateLimit,
  mockInitCircuitBreaker,
  mockIsAvailable,
  mockGetUnavailableProviders,
  mockWriteAuditLog,
  mockDecrypt,
  mockSanitizeSystemPrompt,
  mockSanitizeMessages,
} = vi.hoisted(() => ({
  mockValidateAuth: vi.fn(),
  mockGetUserSubscription: vi.fn(),
  mockGetEffectivePlan: vi.fn(),
  mockIncrementAndCheckDailyLimit: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockInitCircuitBreaker: vi.fn(),
  mockIsAvailable: vi.fn(),
  mockGetUnavailableProviders: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockDecrypt: vi.fn(),
  mockSanitizeSystemPrompt: vi.fn(),
  mockSanitizeMessages: vi.fn(),
}));

// ─── Mocks ─────────────────────────────

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase/validate', () => ({
  validateAuth: mockValidateAuth,
}));

vi.mock('@/lib/subscription', () => ({
  getUserSubscription: mockGetUserSubscription,
  getEffectivePlan: mockGetEffectivePlan,
  incrementAndCheckDailyLimit: mockIncrementAndCheckDailyLimit,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  AI_CHAT_RATE_LIMIT: { maxRequests: 10, windowMs: 60000 },
}));

vi.mock('@/lib/circuit-breaker', () => ({
  initCircuitBreaker: mockInitCircuitBreaker,
  isAvailable: mockIsAvailable,
  getUnavailableProviders: mockGetUnavailableProviders,
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: mockWriteAuditLog,
  AUDIT_ACTIONS: {
    AI_CHAT: 'ai_chat',
    RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
    RATE_LIMIT_WARNING: 'rate_limit_warning',
    PROMPT_INJECTION_BLOCKED: 'prompt_injection_blocked',
  },
}));

vi.mock('@/lib/encryption', () => ({
  decrypt: mockDecrypt,
}));

vi.mock('@/lib/prompt-sanitizer', () => ({
  sanitizeSystemPrompt: mockSanitizeSystemPrompt,
  sanitizeMessages: mockSanitizeMessages,
}));

// ─── Import after mocks ────────────────

import {
  validateRequestAuth,
  checkDailyLimit,
  checkRequestRateLimit,
  checkCircuitBreaker,
  resolveProvider,
  lookupApiKey,
  sanitizeInput,
  runAuthMiddleware,
} from './middleware';

// ─── Helpers ──────────────────────────

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/ai/chat', {
    method: 'POST',
    headers,
  });
}

function mockAuthSuccess() {
  mockValidateAuth.mockResolvedValue({
    user: { id: 'user-1' },
    org: { orgId: 'org-1' },
    supabase: { from: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn() },
  });
}

function mockDailyLimitAllowed() {
  mockGetUserSubscription.mockResolvedValue({ plan: 'pro' });
  mockGetEffectivePlan.mockReturnValue('pro');
  mockIncrementAndCheckDailyLimit.mockResolvedValue({ allowed: true, used: 5, limit: 100 });
}

function mockRateLimitAllowed() {
  mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 8, resetAt: Date.now() + 60000 });
}

// ─── Tests ─────────────────────────────

describe('Chat Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitCircuitBreaker.mockResolvedValue(undefined);
    mockIsAvailable.mockReturnValue(true);
    mockGetUnavailableProviders.mockReturnValue([]);
    mockSanitizeSystemPrompt.mockImplementation((input: string | undefined) => ({
      sanitized: input || '',
      threatsDetected: [],
      riskLevel: 'none',
      wasModified: false,
    }));
    mockSanitizeMessages.mockImplementation((messages: Array<{ role: string; content: string }>) => ({
      sanitizedMessages: messages,
      threatsDetected: [],
      riskLevel: 'none',
      blocked: false,
    }));
  });

  describe('validateRequestAuth', () => {
    it('returns auth data on success', async () => {
      mockAuthSuccess();
      const result = await validateRequestAuth();
      expect(result).not.toBeInstanceOf(NextResponse);
      expect('user' in result!).toBe(true);
      expect('org' in result!).toBe(true);
    });

    it('returns error response when auth fails', async () => {
      mockValidateAuth.mockResolvedValue({ error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) });
      const result = await validateRequestAuth();
      expect(result).toBeInstanceOf(NextResponse);
    });

    it('returns error when no organization', async () => {
      mockValidateAuth.mockResolvedValue({
        user: { id: 'user-1' },
        org: null,
      });
      const result = await validateRequestAuth();
      expect(result).toBeInstanceOf(NextResponse);
    });
  });

  describe('checkDailyLimit', () => {
    it('returns null when limit is allowed', async () => {
      mockDailyLimitAllowed();
      const result = await checkDailyLimit('user-1');
      expect(result).toBeNull();
      expect(mockIncrementAndCheckDailyLimit).toHaveBeenCalledWith('user-1', 'pro');
    });

    it('returns 403 response when limit exceeded', async () => {
      mockGetUserSubscription.mockResolvedValue({ plan: 'free' });
      mockGetEffectivePlan.mockReturnValue('free');
      mockIncrementAndCheckDailyLimit.mockResolvedValue({ allowed: false, used: 50, limit: 50 });
      const result = await checkDailyLimit('user-1');
      expect(result).toBeInstanceOf(NextResponse);
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ reason: 'daily_limit' }) })
      );
    });
  });

  describe('checkRequestRateLimit', () => {
    it('returns null when rate limit is allowed', async () => {
      mockRateLimitAllowed();
      const result = await checkRequestRateLimit('user-1');
      expect(result).toBeNull();
    });

    it('returns 429 response when rate limited', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30000 });
      const result = await checkRequestRateLimit('user-1');
      expect(result).toBeInstanceOf(NextResponse);
    });

    it('logs warning when remaining <= 2', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 2, resetAt: Date.now() + 60000 });
      await checkRequestRateLimit('user-1');
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'rate_limit_warning',
          metadata: expect.objectContaining({ remaining: 2 }),
        })
      );
    });
  });

  describe('checkCircuitBreaker', () => {
    it('returns null when provider is available', () => {
      mockIsAvailable.mockReturnValue(true);
      const result = checkCircuitBreaker('groq');
      expect(result).toBeNull();
    });

    it('returns 503 response when provider is unavailable', () => {
      mockIsAvailable.mockReturnValue(false);
      mockGetUnavailableProviders.mockReturnValue(['groq', 'openai']);
      const result = checkCircuitBreaker('groq');
      expect(result).toBeInstanceOf(NextResponse);
    });
  });

  describe('resolveProvider', () => {
    it('resolves provider from body when no headers', () => {
      const request = makeRequest();
      const result = resolveProvider(request, 'openai', 'gpt-4o');
      expect(result).not.toBeInstanceOf(NextResponse);
      expect('providerId' in result!).toBe(true);
    });

    it('resolves provider from headers when provided', () => {
      const request = makeRequest({ 'x-oracle-provider-id': 'anthropic', 'x-oracle-model-id': 'claude-sonnet-4' });
      const result = resolveProvider(request);
      expect(result).not.toBeInstanceOf(NextResponse);
      expect('providerId' in result!).toBe(true);
    });

    it('returns 400 for unknown provider', () => {
      const request = makeRequest();
      const result = resolveProvider(request, 'unknown-provider');
      expect(result).toBeInstanceOf(NextResponse);
    });
  });

  describe('lookupApiKey', () => {
    it('returns decrypted key on success', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { encrypted_key: 'encrypted' }, error: null }),
      };
      mockDecrypt.mockReturnValue('decrypted-key');
      const result = await lookupApiKey(mockSupabase as any, 'org-1', 'openai');
      expect(result).toBe('decrypted-key');
    });

    it('returns 400 when key not found', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };
      const result = await lookupApiKey(mockSupabase as any, 'org-1', 'openai');
      expect(result).toBeInstanceOf(NextResponse);
    });
  });

  describe('sanitizeInput', () => {
    it('returns sanitized content on success', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const result = sanitizeInput('You are ORACLE', messages, 'user-1', '/api/ai/chat');
      expect(result).not.toBeInstanceOf(NextResponse);
      expect('systemPrompt' in result!).toBe(true);
      expect('messages' in result!).toBe(true);
    });

    it('returns 400 when messages is empty', () => {
      const result = sanitizeInput('test', [], 'user-1', '/api/ai/chat');
      expect(result).toBeInstanceOf(NextResponse);
    });

    it('returns 400 when messages is null', () => {
      const result = sanitizeInput('test', null as any, 'user-1', '/api/ai/chat');
      expect(result).toBeInstanceOf(NextResponse);
    });
  });

  describe('runAuthMiddleware', () => {
    it('returns validation result on success', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { encrypted_key: 'encrypted' }, error: null }),
      };
      mockValidateAuth.mockResolvedValue({
        user: { id: 'user-1' },
        org: { orgId: 'org-1' },
        supabase: mockSupabase,
      });
      mockDailyLimitAllowed();
      mockRateLimitAllowed();
      mockDecrypt.mockReturnValue('decrypted-key');

      const request = makeRequest();
      const body = {
        messages: [{ role: 'user', content: 'Hello' }],
        providerId: 'groq',
        modelId: 'llama-3.3-70b-versatile',
      };

      const result = await runAuthMiddleware(request, body, '/api/ai/chat');
      expect(result).not.toBeInstanceOf(NextResponse);
      expect('success' in result!).toBe(true);
    });

    it('returns error when auth fails', async () => {
      mockValidateAuth.mockResolvedValue({ error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) });
      const request = makeRequest();
      const body = { messages: [{ role: 'user', content: 'Hello' }] };
      const result = await runAuthMiddleware(request, body, '/api/ai/chat');
      expect(result).toBeInstanceOf(NextResponse);
    });
  });
});
