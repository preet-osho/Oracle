// ═══════════════════════════════════════
// ORACLE — Chat with Research
// Combines AI chat with web search capability
// Looks up user API keys and calls research functions directly
// ═══════════════════════════════════════

import { NextRequest } from 'next/server';
import { PROVIDERS } from '@/data/providers';
import { calculateCost } from '@/lib/ai-constants';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { sanitizeSearchResults } from '@/lib/prompt-sanitizer';
import { recordCost } from '@/lib/cost-tracker';
import { recordProviderHealth } from '@/lib/provider-health-server';
import { recordSuccess, recordFailure } from '@/lib/circuit-breaker';
import { search, formatResearchForAI, type SearchProvider } from '@/lib/research';
import { streamAnthropic, streamOpenAICompatible, callAnthropicSync, callOpenAISync } from '../chat/shared';
import { lookupUserSearchKeys } from '@/lib/user-api-keys';
import { createLogger } from '@/lib/logger';
import { runAuthMiddleware, type AuthData } from '../chat/middleware';

const log = createLogger('ChatWithResearch');

// ─── Request Body ──────────────────────

interface ChatWithResearchRequest {
  messages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  providerId?: string;
  modelId?: string;
  maxTokens?: number;
  stream?: boolean;
  /** Enable web search before AI response */
  enableSearch?: boolean;
  /** Search providers to use (default: all available) */
  searchProviders?: SearchProvider[];
  /** Max search results per provider */
  maxSearchResults?: number;
}

// ─── POST Handler ──────────────────────

export async function POST(request: NextRequest) {
  // Parse body first (needed by middleware)
  let body: ChatWithResearchRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { enableSearch = true, searchProviders, maxSearchResults = 5 } = body;

  // Run all auth/rate-limiting/sanitization checks
  const result = await runAuthMiddleware(request, body, '/api/ai/chat-with-research');
  if (result instanceof Response) return result;

  const { auth, providerId, modelId, apiKey, provider, messages, systemPrompt, stream } = result;
  const authData = auth as AuthData;

  // Look up search API keys (BYOK) for web search
  let searchApiKeys: Partial<Record<SearchProvider, string>> | undefined;

  if (enableSearch) {
    searchApiKeys = await lookupUserSearchKeys(authData.supabase, authData.org.orgId);
  }

  // Perform web search if enabled
  let searchContext = '';
  let searchData: Awaited<ReturnType<typeof search>> = [];

  if (enableSearch) {
    // Extract search query from the last user message
    const lastUserMessage = messages
      .filter((m) => m.role === 'user')
      .pop()?.content;

    if (lastUserMessage) {
      try {
        log.info('Performing web search', { query: lastUserMessage.slice(0, 100) });

        searchData = await search(lastUserMessage, {
          maxResults: maxSearchResults,
          providers: searchProviders,
          apiKeys: searchApiKeys,
        });

        // ── SECURITY: Sanitize search results before injecting into AI context ──
        // Prevents indirect prompt injection via crafted search snippets
        const allSearchResults = searchData.flatMap((r) => r.results);
        const sanitizedResults = sanitizeSearchResults(allSearchResults, {
          userId: authData.user?.id,
          route: '/api/ai/chat-with-research',
        });

        // Rebuild searchData with sanitized results (preserving provider structure)
        let sanitizedIdx = 0;
        searchData = searchData.map((providerResult) => {
          const count = providerResult.results.length;
          const results = sanitizedResults.slice(sanitizedIdx, sanitizedIdx + count);
          sanitizedIdx += count;
          return { ...providerResult, results, totalResults: results.length };
        });

        searchContext = formatResearchForAI(searchData);

        log.info('Web search completed', {
          query: lastUserMessage.slice(0, 50),
          providers: searchData.length,
          totalResults: searchData.reduce((sum, r) => sum + r.totalResults, 0),
          sanitizedResults: sanitizedResults.length,
        });
      } catch (error) {
        log.error('Web search failed', { error: error instanceof Error ? error.message : 'Unknown' });
        // Continue without search context — don't fail the entire request
      }
    }
  }

  // Build messages payload with search context
  const apiMessages: Array<{ role: string; content: string }> = [];

  if (systemPrompt) {
    if (providerId === 'anthropic') {
      // Anthropic uses separate system param
    } else {
      let enhancedSystemPrompt = systemPrompt;
      if (searchContext) {
        enhancedSystemPrompt += `\n\n---\n\n## Web Search Results\n\nUse the following web search results to inform your response. Cite sources where relevant.\n\n${searchContext}`;
      }
      apiMessages.push({ role: 'system', content: enhancedSystemPrompt });
    }
  } else if (searchContext) {
    apiMessages.push({
      role: 'system',
      content: `You are a helpful AI assistant with access to web search results. Use the following search results to inform your response. Cite sources where relevant.\n\n---\n\n## Web Search Results\n\n${searchContext}`,
    });
  }

  // For Anthropic, inject search context into the last user message
  if (providerId === 'anthropic' && searchContext) {
    const enhancedMessages = [...messages];
    const lastUserIdx = enhancedMessages.findLastIndex((m) => m.role === 'user');
    if (lastUserIdx >= 0) {
      enhancedMessages[lastUserIdx] = {
        ...enhancedMessages[lastUserIdx],
        content: `${enhancedMessages[lastUserIdx].content}\n\n---\n\n## Web Search Results\n\nUse the following web search results to inform your response. Cite sources where relevant.\n\n${searchContext}`,
      };
    }
    apiMessages.push(...enhancedMessages);
  } else {
    apiMessages.push(...messages);
  }

  // Audit log
  writeAuditLog({
    userId: authData.user.id,
    action: AUDIT_ACTIONS.AI_CHAT,
    entityType: 'ai_request',
    metadata: {
      provider: providerId,
      model: modelId,
      messageCount: body.messages?.length || 0,
      stream,
      enableSearch,
      searchProvidersUsed: searchData.map((r) => r.provider),
      totalSearchResults: searchData.reduce((sum, r) => sum + r.totalResults, 0),
    },
  });

  // Route to provider
  if (stream) {
    return handleStreaming(providerId, modelId, apiKey, provider, apiMessages, systemPrompt, result.maxTokens, authData.user.id, searchData);
  } else {
    return handleSync(providerId, modelId, apiKey, provider, apiMessages, systemPrompt, result.maxTokens, authData.user.id, searchData);
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
  searchData: Awaited<ReturnType<typeof search>>,
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

        if (streamSuccess) {
          recordSuccess(providerId);
        } else {
          recordFailure(providerId);
        }

        recordProviderHealth({ userId, providerId, modelId, latencyMs, success: streamSuccess, tokensUsed: 0 });

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));

        // Send metadata including search results summary
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          _health: { providerId, model: modelId, latencyMs, success: streamSuccess },
          _search: {
            enabled: searchData.length > 0,
            providers: searchData.map((r) => r.provider),
            totalResults: searchData.reduce((sum, r) => sum + r.totalResults, 0),
          },
        })}\n\n`));

        controller.close();
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        recordFailure(providerId);
        recordProviderHealth({ userId, providerId, modelId, latencyMs, success: false, tokensUsed: 0, errorMessage });

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
  searchData: Awaited<ReturnType<typeof search>>,
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

    recordSuccess(providerId);
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
      _search: {
        enabled: searchData.length > 0,
        providers: searchData.map((r) => r.provider),
        totalResults: searchData.reduce((sum, r) => sum + r.totalResults, 0),
      },
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'AI request failed';

    recordFailure(providerId);
    recordCost({ userId, providerId, modelId, inputTokens: 0, outputTokens: 0, costUsd: 0, costInr: 0, latencyMs, success: false, errorMessage });
    recordProviderHealth({ userId, providerId, modelId, latencyMs, success: false, tokensUsed: 0, errorMessage });

    return Response.json(
      { error: errorMessage, _health: { latencyMs, success: false, errorMessage } },
      { status: 502 }
    );
  }
}
