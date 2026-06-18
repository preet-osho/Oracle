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
import { recordProviderHealth } from '@/lib/provider-health';

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
  // 1. Authenticate
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  // 2. Rate limit (per-user, 10 req/min)
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

  // 3. Parse body
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { messages, systemPrompt, providerId, modelId, maxTokens, stream } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages array is required' }, { status: 400 });
  }

  // 3. Look up API key from server-side storage (user_api_keys table)
  //    Keys are encrypted at rest and never exposed to the browser
  const clientHeaders = request.headers;
  const resolvedProviderId = clientHeaders.get('x-oracle-provider-id') || providerId || 'groq';
  const resolvedModelId = clientHeaders.get('x-oracle-model-id') || modelId;

  // Fetch the decrypted key from the database
  const { data: keyRow, error: keyError } = await auth.supabase
    .from('user_api_keys')
    .select('encrypted_key')
    .eq('user_id', auth.user.id)
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

  // 4. Build messages payload
  const apiMessages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    if (resolvedProviderId === 'anthropic') {
      // Anthropic uses separate system param
    } else {
      apiMessages.push({ role: 'system', content: systemPrompt });
    }
  }
  apiMessages.push(...messages);

  // 5. Determine streaming mode
  const isStream = stream !== false; // default to streaming

  // 6. Audit log the AI request (fire-and-forget, persists to audit_logs table)
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

  // 7. Route to provider (streaming or sync)

  if (isStream) {
    return handleStreaming(resolvedProviderId, finalModelId, apiKey, provider, apiMessages, systemPrompt, maxTokens);
  } else {
    return handleSync(resolvedProviderId, finalModelId, apiKey, provider, apiMessages, systemPrompt, maxTokens);
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
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (providerId === 'anthropic') {
          await streamAnthropic(controller, encoder, apiKey, modelId, messages, systemPrompt, maxTokens);
        } else {
          await streamOpenAICompatible(controller, encoder, provider.baseUrl, apiKey, modelId, providerId, messages, systemPrompt, maxTokens);
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`));
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
) {
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

    return Response.json({
      text,
      provider: providerId,
      model: modelId,
      inputTokens,
      outputTokens,
      costUSD: cost.usd,
      costINR: cost.inr,
    });
  } catch (error) {
    // Record health failure
    recordProviderHealth({
      providerId,
      timestamp: Date.now(),
      latencyMs: Date.now() - Date.now(),
      success: false,
      model: modelId,
      tokensUsed: 0,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return Response.json(
      { error: error instanceof Error ? error.message : 'AI request failed' },
      { status: 502 }
    );
  }
}

// ─── Anthropic Streaming ───────────────

async function streamAnthropic(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  maxTokens: number | undefined,
) {
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens || 4096,
    messages: messages.filter((m) => m.role !== 'system').map((m) => ({
      role: m.role,
      content: m.content,
    })),
    stream: true,
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `Anthropic API error (${response.status}): ${error}` })}\n\n`));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: parsed.delta.text, done: false })}\n\n`));
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── OpenAI-Compatible Streaming ───────

async function streamOpenAICompatible(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  baseUrl: string,
  apiKey: string,
  model: string,
  providerId: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  maxTokens: number | undefined,
) {
  const allMessages = [...messages];
  // Ensure system message is first for OpenAI-compatible
  if (systemPrompt && !allMessages.some((m) => m.role === 'system')) {
    allMessages.unshift({ role: 'system', content: systemPrompt });
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: allMessages,
      max_tokens: maxTokens || 4096,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `API error (${response.status}): ${error}` })}\n\n`));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: content, done: false })}\n\n`));
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Anthropic Sync ────────────────────

async function callAnthropicSync(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  maxTokens: number | undefined,
) {
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens || 4096,
    messages: messages.filter((m) => m.role !== 'system').map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const textParts: string[] = [];

  if (Array.isArray(data.content)) {
    for (const block of data.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      }
    }
  }

  return {
    text: textParts.join('\n'),
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };
}

// ─── OpenAI-Compatible Sync ────────────

async function callOpenAISync(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  maxTokens: number | undefined,
) {
  const allMessages = [...messages];
  if (systemPrompt && !allMessages.some((m) => m.role === 'system')) {
    allMessages.unshift({ role: 'system', content: systemPrompt });
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: allMessages,
      max_tokens: maxTokens || 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  return {
    text,
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  };
}
