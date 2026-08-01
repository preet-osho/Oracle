// ═══════════════════════════════════════
// ORACLE — Server-Side AI Proxy
// Routes all AI provider calls through the server
// Prevents browser→provider direct connections (XSS key theft)
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { PROVIDERS } from '@/data/providers';
import { calculateCost } from '@/lib/ai-constants';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { checkRateLimit, AI_CHAT_RATE_LIMIT } from '@/lib/rate-limit';
import { decrypt as decryptKey } from '@/lib/encryption';
import { sanitizeSystemPrompt, sanitizeMessages } from '@/lib/prompt-sanitizer';
import { fetchWithTimeout, TIMEOUT_STREAMING_MS, TIMEOUT_STANDARD_MS } from '@/lib/fetch-utils';
import { recordCost } from '@/lib/cost-tracker';
import { recordProviderHealth } from '@/lib/provider-health-server';
import { initCircuitBreaker, recordSuccess, recordFailure, isAvailable, getUnavailableProviders } from '@/lib/circuit-breaker';import { getUserSubscription, getEffectivePlan, incrementAndCheckDailyLimit} from '@/lib/subscription';
import { streamAnthropic, streamOpenAICompatible, callAnthropicSync, callOpenAISync } from './shared';


// ─── Request Body ──────────────────────

interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  providerId?: string;
  modelId?: string;
  maxTokens?: number;
  stream?: boolean;
}

// ─── POST Handler ──────────────────────

export async function POST(request: NextRequest) {
  // 0. Initialize circuit breaker (loads state from Supabase on first cold start)
  await initCircuitBreaker();

  // 1. Authenticate
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });

  // 2. Subscription-based daily limit enforcement (atomic increment + check)
  const subscription = await getUserSubscription(auth.user.id);
  const planId = getEffectivePlan(subscription);

  const dailyCheck = await incrementAndCheckDailyLimit(auth.user.id, planId);
  if (!dailyCheck.allowed) {
    writeAuditLog({
      userId: auth.user.id,
      action: AUDIT_ACTIONS.AI_CHAT,
      entityType: 'ai_request',
      metadata: { blocked: true, reason: 'daily_limit', planId, used: dailyCheck.used, limit: dailyCheck.limit },
    });
    return Response.json(
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

  // 3. Rate limit (per-user, 10 req/min)
  const rateLimitKey = `ai:chat:${auth.user.id}`;
  const rateLimit = await checkRateLimit(rateLimitKey, AI_CHAT_RATE_LIMIT);
  if (!rateLimit.allowed) {
    writeAuditLog({
      userId: auth.user.id,
      action: AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
      entityType: 'ai_chat',
      metadata: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
    });
    return Response.json(
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
      userId: auth.user.id,
      action: AUDIT_ACTIONS.RATE_LIMIT_WARNING,
      entityType: 'ai_chat',
      metadata: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
    });
  }

  // 4. Parse body
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { messages, providerId, modelId, maxTokens, stream } = body;

  // Sanitize user-supplied systemPrompt to prevent prompt injection
  const { sanitized: systemPrompt, threatsDetected, riskLevel } = sanitizeSystemPrompt(body.systemPrompt, {
    userId: auth.user?.id,
    route: '/api/ai/chat',
  });

  if (riskLevel === 'critical') {
    writeAuditLog({
      userId: auth.user.id,
      action: 'PROMPT_INJECTION_BLOCKED',
      entityType: 'security',
      metadata: { threats: threatsDetected, riskLevel },
    });
    return Response.json(
      { error: 'Request blocked: potential prompt injection detected.' },
      { status: 400 }
    );
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages array is required' }, { status: 400 });
  }

  // Sanitize all user messages to prevent prompt injection via message content
  const { sanitizedMessages, threatsDetected: msgThreats, riskLevel: msgRisk, blocked } = sanitizeMessages(messages, {
    userId: auth.user?.id,
    route: '/api/ai/chat',
  });

  if (blocked) {
    writeAuditLog({
      userId: auth.user.id,
      action: 'PROMPT_INJECTION_BLOCKED',
      entityType: 'security',
      metadata: { threats: msgThreats, riskLevel: msgRisk, source: 'messages' },
    });
    return Response.json(
      { error: 'Request blocked: potential prompt injection detected in messages.' },
      { status: 400 }
    );
  }

  // 5. Look up API key from server-side storage (user_api_keys table)
  //    Keys are encrypted at rest and never exposed to the browser
  const clientHeaders = request.headers;
  const resolvedProviderId = clientHeaders.get('x-oracle-provider-id') || providerId || 'groq';
  const resolvedModelId = clientHeaders.get('x-oracle-model-id') || modelId;

  // Fetch the decrypted key from the database
  const { data: keyRow, error: keyError } = await auth.supabase
    .from('user_api_keys')
    .select('encrypted_key')
    .eq('org_id', auth.org.orgId)
    .eq('provider_id', resolvedProviderId)
    .eq('is_active', true)
    .single();

  if (keyError || !keyRow) {
    return Response.json(
      { error: `No API key configured for ${resolvedProviderId}. Add one in Settings → API Keys.` },
      { status: 400 }
    );
  }

  // Decrypt the key server-side
  const apiKey = decryptKey(keyRow.encrypted_key);

  if (!apiKey) {
    return Response.json(
      { error: 'Failed to decrypt API key' },
      { status: 500 }
    );
  }

  const provider = PROVIDERS.find((p) => p.id === resolvedProviderId);
  if (!provider) {
    return Response.json({ error: `Unknown provider: ${resolvedProviderId}` }, { status: 400 });
  }

  const finalModelId = resolvedModelId || provider.models[0]?.id;
  if (!finalModelId) {
    return Response.json({ error: 'No model specified' }, { status: 400 });
  }

  // 6. Build messages payload (using sanitized messages)
  const apiMessages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    if (resolvedProviderId === 'anthropic') {
      // Anthropic uses separate system param
    } else {
      apiMessages.push({ role: 'system', content: systemPrompt });
    }
  }
  apiMessages.push(...sanitizedMessages);

  // 7. Determine streaming mode
  const isStream = stream !== false; // default to streaming

  // 8. Audit log the AI request (fire-and-forget, persists to audit_logs table)
  writeAuditLog({
    userId: auth.user.id,
    action: AUDIT_ACTIONS.AI_CHAT,
    entityType: 'ai_request',
    metadata: {
      provider: resolvedProviderId,
      model: finalModelId,
      messageCount: messages.length,
      stream: isStream,
    },
  });

  // 9. Check circuit breaker — skip known-failing providers
  if (!isAvailable(resolvedProviderId)) {
    const unavailable = getUnavailableProviders();
    return Response.json(
      { error: `Provider ${resolvedProviderId} is temporarily unavailable (circuit breaker open). Unavailable: ${unavailable.join(', ')}. Please try another provider or wait a few minutes.` },
      { status: 503 }
    );
  }

  // 10. Route to provider (streaming or sync)

  if (isStream) {
    return handleStreaming(resolvedProviderId, finalModelId, apiKey, provider, apiMessages, systemPrompt, maxTokens, auth.user.id);
  } else {
    return handleSync(resolvedProviderId, finalModelId, apiKey, provider, apiMessages, systemPrompt, maxTokens, auth.user.id);
  }
}

// ─── Streaming Handler ─────────────────

async function handleStreaming(
  providerId: string,
  modelId: string,
  apiKey: string,
  provider: (typeof PROVIDERS)[number],
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  maxTokens: number | undefined,
  userId: string,
) {
  const startTime = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let streamSuccess = false;
        if (providerId === 'anthropic') {
          streamSuccess = await streamAnthropic(controller, encoder, apiKey, modelId, messages, systemPrompt, maxTokens);
        } else {
          streamSuccess = await streamOpenAICompatible(controller, encoder, provider.baseUrl, apiKey, modelId, providerId, messages, systemPrompt, maxTokens);
        }

        const latencyMs = Date.now() - startTime;

        // Record circuit breaker state
        if (streamSuccess) {
          recordSuccess(providerId);
        } else {
          recordFailure(providerId);
        }

        // Record streaming health + cost to Supabase (fire-and-forget)
        recordProviderHealth({ userId, providerId, modelId, latencyMs, success: streamSuccess, tokensUsed: 0 });

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));

        // Send health metadata to client for recording
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ _health: { providerId, model: modelId, latencyMs, success: streamSuccess } })}\n\n`));

        controller.close();
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Record circuit breaker failure
        recordFailure(providerId);

        // Record streaming failure to Supabase (fire-and-forget)
        recordProviderHealth({ userId, providerId, modelId, latencyMs, success: false, tokensUsed: 0, errorMessage });

        // Send health metadata to client for recording
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ _health: { providerId, model: modelId, latencyMs, success: false, errorMessage } })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// ─── Sync Handler ──────────────────────

async function handleSync(
  providerId: string,
  modelId: string,
  apiKey: string,
  provider: (typeof PROVIDERS)[number],
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  maxTokens: number | undefined,
  userId: string,
) {
  const startTime = Date.now();
  try {
    let text = '';
    let inputTokens = 0;
    let outputTokens = 0;

    if (providerId === 'anthropic') {
      const result = await callAnthropicSync(apiKey, modelId, messages, systemPrompt, maxTokens);
      text = result.text;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
    } else {
      const result = await callOpenAISync(provider.baseUrl, apiKey, modelId, messages, systemPrompt, maxTokens);
      text = result.text;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
    }

    const cost = calculateCost(providerId, modelId, inputTokens, outputTokens);
    const latencyMs = Date.now() - startTime;

    // Record circuit breaker success
    recordSuccess(providerId);

    // Record cost and health to Supabase (fire-and-forget)
    recordCost({ userId, providerId, modelId, inputTokens, outputTokens, costUsd: cost.usd, costInr: cost.inr, latencyMs, success: true });
    recordProviderHealth({ userId, providerId, modelId, latencyMs, success: true, tokensUsed: inputTokens + outputTokens });

    return Response.json({
      text,
      provider: providerId,
      model: modelId,
      inputTokens,
      outputTokens,
      costUSD: cost.usd,
      costINR: cost.inr,
      _health: { latencyMs, success: true },
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'AI request failed';

    // Record circuit breaker failure
    recordFailure(providerId);

    // Record failed cost + health to Supabase (fire-and-forget)
    recordCost({ userId, providerId, modelId, inputTokens: 0, outputTokens: 0, costUsd: 0, costInr: 0, latencyMs, success: false, errorMessage });
    recordProviderHealth({ userId, providerId, modelId, latencyMs, success: false, tokensUsed: 0, errorMessage });

    return Response.json(
      { error: errorMessage, _health: { latencyMs, success: false, errorMessage } },
      { status: 502 }
    );
  }
}


