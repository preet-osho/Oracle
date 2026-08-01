// ═══════════════════════════════════════
// ORACLE — Server-Side AI Proxy
// Routes all AI provider calls through the server
// Prevents browser→provider direct connections (XSS key theft)
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { PROVIDERS } from '@/data/providers';
import { calculateCost } from '@/lib/ai-constants';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { recordCost } from '@/lib/cost-tracker';
import { recordProviderHealth } from '@/lib/provider-health-server';
import { recordSuccess, recordFailure } from '@/lib/circuit-breaker';
import { streamAnthropic, streamOpenAICompatible, callAnthropicSync, callOpenAISync } from './shared';
import { runAuthMiddleware, type AuthData } from './middleware';


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
  // Parse body first (needed by middleware)
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Run all auth/rate-limiting/sanitization checks
  const result = await runAuthMiddleware(request, body, '/api/ai/chat');
  if (result instanceof Response) return result;

  const { auth, providerId, modelId, apiKey, provider, messages, systemPrompt, maxTokens, stream } = result;
  const authData = auth as unknown as AuthData;

  // Build messages payload (using sanitized messages)
  const apiMessages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    if (providerId === 'anthropic') {
      // Anthropic uses separate system param
    } else {
      apiMessages.push({ role: 'system', content: systemPrompt });
    }
  }
  apiMessages.push(...messages);

  // Audit log the AI request
  writeAuditLog({
    userId: authData.user.id,
    action: AUDIT_ACTIONS.AI_CHAT,
    entityType: 'ai_request',
    metadata: {
      provider: providerId,
      model: modelId,
      messageCount: body.messages?.length || 0,
      stream,
    },
  });

  // Route to provider (streaming or sync)
  if (stream) {
    return handleStreaming(providerId, modelId, apiKey, provider, apiMessages, systemPrompt, maxTokens, authData.user.id);
  } else {
    return handleSync(providerId, modelId, apiKey, provider, apiMessages, systemPrompt, maxTokens, authData.user.id);
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


