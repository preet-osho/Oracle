/**
 * Shared auth, rate-limiting, and validation middleware for chat routes.
 *
 * Extracted from chat/route.ts and chat-with-research/route.ts
 * to eliminate ~150 lines of identical middleware code.
 *
 * Extracted by Buffy on 2026-08-01
 */

import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/data/providers';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { checkRateLimit, AI_CHAT_RATE_LIMIT } from '@/lib/rate-limit';
import { decrypt as decryptKey } from '@/lib/encryption';
import { sanitizeSystemPrompt, sanitizeMessages } from '@/lib/prompt-sanitizer';
import { initCircuitBreaker, isAvailable, getUnavailableProviders } from '@/lib/circuit-breaker';
import { getUserSubscription, getEffectivePlan, incrementAndCheckDailyLimit } from '@/lib/subscription';
import { validateAuth } from '@/lib/supabase/validate';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ─────────────────────────────

export interface AuthData {
  user: { id: string };
  org: { orgId: string };
  supabase: SupabaseClient;
}

export interface ValidationResult {
  success: true;
  auth: AuthData;
  providerId: string;
  modelId: string;
  apiKey: string;
  provider: (typeof PROVIDERS)[number];
  messages: Array<{ role: string; content: string }>;
  systemPrompt: string;
  maxTokens: number | undefined;
  stream: boolean;
}

// ─── Middleware Functions ───────────────

/**
 * Initialize circuit breaker (call once per request).
 */
export async function initMiddleware(): Promise<void> {
  await initCircuitBreaker();
}

/**
 * Validate authentication and organization.
 * Returns AuthData or NextResponse error.
 */
export async function validateRequestAuth(): Promise<AuthData | NextResponse> {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) {
    return NextResponse.json(
      { error: 'No organization found. Create or join an organization first.' },
      { status: 400 }
    );
  }
  return auth as AuthData;
}

/**
 * Check subscription-based daily limit.
 * Returns NextResponse error if limit exceeded, null otherwise.
 */
export async function checkDailyLimit(userId: string): Promise<NextResponse | null> {
  const subscription = await getUserSubscription(userId);
  const planId = getEffectivePlan(subscription);

  const dailyCheck = await incrementAndCheckDailyLimit(userId, planId);
  if (!dailyCheck.allowed) {
    writeAuditLog({
      userId,
      action: AUDIT_ACTIONS.AI_CHAT,
      entityType: 'ai_request',
      metadata: { blocked: true, reason: 'daily_limit', planId, used: dailyCheck.used, limit: dailyCheck.limit },
    });
    return NextResponse.json(
      {
        error: `Daily limit reached (${dailyCheck.used}/${dailyCheck.limit}). Upgrade your plan for more requests.`,
        code: 'DAILY_LIMIT_EXCEEDED',
        used: dailyCheck.used,
        limit: dailyCheck.limit,
        upgradeUrl: '/pricing',
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Check rate limit (per-user, 10 req/min).
 * Returns NextResponse error if rate limited, null otherwise.
 */
export async function checkRequestRateLimit(userId: string): Promise<NextResponse | null> {
  const rateLimitKey = `ai:chat:${userId}`;
  const rateLimit = await checkRateLimit(rateLimitKey, AI_CHAT_RATE_LIMIT);

  if (!rateLimit.allowed) {
    writeAuditLog({
      userId,
      action: AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
      entityType: 'ai_chat',
      metadata: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
    });
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before sending another request.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(AI_CHAT_RATE_LIMIT.maxRequests),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
        },
      }
    );
  }

  // Log near-limit usage for abuse pattern detection (≤2 remaining)
  if (rateLimit.remaining <= 2) {
    writeAuditLog({
      userId,
      action: AUDIT_ACTIONS.RATE_LIMIT_WARNING,
      entityType: 'ai_chat',
      metadata: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
    });
  }

  return null;
}

/**
 * Check circuit breaker for a specific provider.
 * Returns NextResponse error if provider unavailable, null otherwise.
 */
export function checkCircuitBreaker(providerId: string): NextResponse | null {
  if (!isAvailable(providerId)) {
    const unavailable = getUnavailableProviders();
    return NextResponse.json(
      { error: `Provider ${providerId} is temporarily unavailable (circuit breaker open). Unavailable: ${unavailable.join(', ')}. Please try another provider or wait a few minutes.` },
      { status: 503 }
    );
  }
  return null;
}

/**
 * Validate and resolve provider/model from request headers and body.
 * Returns provider info or NextResponse error.
 */
export function resolveProvider(
  request: NextRequest,
  bodyProviderId?: string,
  bodyModelId?: string,
): { providerId: string; modelId: string; provider: (typeof PROVIDERS)[number] } | NextResponse {
  const clientHeaders = request.headers;
  const providerId = clientHeaders.get('x-oracle-provider-id') || bodyProviderId || 'groq';
  const modelId = clientHeaders.get('x-oracle-model-id') || bodyModelId;

  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) {
    return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 });
  }

  const finalModelId = modelId || provider.models[0]?.id;
  if (!finalModelId) {
    return NextResponse.json({ error: 'No model specified' }, { status: 400 });
  }

  return { providerId, modelId: finalModelId, provider };
}

/**
 * Look up and decrypt AI provider API key from user_api_keys table.
 * Returns decrypted key or NextResponse error.
 */
export async function lookupApiKey(
  supabase: AuthData['supabase'],
  orgId: string,
  providerId: string,
): Promise<string | NextResponse> {
  const { data: keyRow, error: keyError } = await supabase
    .from('user_api_keys')
    .select('encrypted_key')
    .eq('org_id', orgId)
    .eq('provider_id', providerId)
    .eq('is_active', true)
    .single();

  if (keyError || !keyRow) {
    return NextResponse.json(
      { error: `No API key configured for ${providerId}. Add one in Settings → API Keys.` },
      { status: 400 }
    );
  }

  const apiKey = decryptKey(keyRow.encrypted_key);
  if (!apiKey) {
    return NextResponse.json({ error: 'Failed to decrypt API key' }, { status: 500 });
  }

  return apiKey;
}

/**
 * Sanitize system prompt and messages.
 * Returns sanitized content or NextResponse error if blocked.
 */
export function sanitizeInput(
  systemPrompt: string | undefined,
  messages: Array<{ role: string; content: string }>,
  userId: string,
  route: string,
): { systemPrompt: string; messages: Array<{ role: string; content: string }> } | NextResponse {
  // Sanitize system prompt
  const { sanitized: sanitizedPrompt, threatsDetected, riskLevel } = sanitizeSystemPrompt(systemPrompt, {
    userId,
    route,
  });

  if (riskLevel === 'critical') {
    writeAuditLog({
      userId,
      action: 'PROMPT_INJECTION_BLOCKED',
      entityType: 'security',
      metadata: { threats: threatsDetected, riskLevel },
    });
    return NextResponse.json(
      { error: 'Request blocked: potential prompt injection detected.' },
      { status: 400 }
    );
  }

  // Validate messages array
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
  }

  // Sanitize messages
  const { sanitizedMessages, threatsDetected: msgThreats, riskLevel: msgRisk, blocked } = sanitizeMessages(messages, {
    userId,
    route,
  });

  if (blocked) {
    writeAuditLog({
      userId,
      action: 'PROMPT_INJECTION_BLOCKED',
      entityType: 'security',
      metadata: { threats: msgThreats, riskLevel: msgRisk, source: 'messages' },
    });
    return NextResponse.json(
      { error: 'Request blocked: potential prompt injection detected in messages.' },
      { status: 400 }
    );
  }

  return { systemPrompt: sanitizedPrompt, messages: sanitizedMessages };
}

/**
 * Run all auth/rate-limiting middleware checks in sequence.
 * Returns ValidationResult if all checks pass, or NextResponse error.
 */
export async function runAuthMiddleware(
  request: NextRequest,
  body: {
    messages?: Array<{ role: string; content: string }>;
    systemPrompt?: string;
    providerId?: string;
    modelId?: string;
    maxTokens?: number;
    stream?: boolean;
  },
  route: string,
): Promise<ValidationResult | NextResponse> {
  // 1. Initialize circuit breaker
  await initMiddleware();

  // 2. Validate auth
  const authResult = await validateRequestAuth();
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult as AuthData;

  // 3. Check daily limit
  const dailyLimitResponse = await checkDailyLimit(auth.user.id);
  if (dailyLimitResponse) return dailyLimitResponse;

  // 4. Check rate limit
  const rateLimitResponse = await checkRequestRateLimit(auth.user.id);
  if (rateLimitResponse) return rateLimitResponse;

  // 5. Sanitize input
  const sanitizeResult = sanitizeInput(body.systemPrompt, body.messages || [], auth.user.id, route);
  if (sanitizeResult instanceof NextResponse) return sanitizeResult;
  const { systemPrompt, messages } = sanitizeResult;

  // 6. Resolve provider
  const providerResult = resolveProvider(request, body.providerId, body.modelId);
  if (providerResult instanceof NextResponse) return providerResult;
  const { providerId, modelId, provider } = providerResult;

  // 7. Look up API key
  const apiKeyResult = await lookupApiKey(auth.supabase, auth.org.orgId, providerId);
  if (apiKeyResult instanceof NextResponse) return apiKeyResult;
  const apiKey = apiKeyResult as string;

  // 8. Check circuit breaker
  const circuitBreakerResponse = checkCircuitBreaker(providerId);
  if (circuitBreakerResponse) return circuitBreakerResponse;

  return {
    success: true,
    auth,
    providerId,
    modelId,
    apiKey,
    provider,
    messages,
    systemPrompt,
    maxTokens: body.maxTokens,
    stream: body.stream !== false,
  };
}
