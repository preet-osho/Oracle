/**
 * Shared AI provider streaming/sync helpers for chat routes.
 *
 * Extracted from chat/route.ts and chat-with-research/route.ts
 * to eliminate ~300 lines of identical provider-specific code.
 *
 * Extracted by Buffy on 2026-08-01
 */

import { fetchWithTimeout, TIMEOUT_STREAMING_MS, TIMEOUT_STANDARD_MS } from '@/lib/fetch-utils';

// ─── Types ─────────────────────────────

export interface SyncResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

// ─── Anthropic Streaming ───────────────

export async function streamAnthropic(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  maxTokens: number | undefined,
): Promise<boolean> {
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

  let response: Response;
  try {
    response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      timeoutMs: TIMEOUT_STREAMING_MS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `Anthropic request failed: ${msg}` })}\n\n`));
    return false;
  }

  if (!response.ok) {
    const error = await response.text();
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `Anthropic API error (${response.status}): ${error}` })}\n\n`));
    return false;
  }

  const reader = response.body?.getReader();
  if (!reader) return false;

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
  return true;
}

// ─── OpenAI-Compatible Streaming ───────

export async function streamOpenAICompatible(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  baseUrl: string,
  apiKey: string,
  model: string,
  providerId: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  maxTokens: number | undefined,
): Promise<boolean> {
  const allMessages = [...messages];
  // Ensure system message is first for OpenAI-compatible
  if (systemPrompt && !allMessages.some((m) => m.role === 'system')) {
    allMessages.unshift({ role: 'system', content: systemPrompt });
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
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
      timeoutMs: TIMEOUT_STREAMING_MS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `Provider request failed: ${msg}` })}\n\n`));
    return false;
  }

  if (!response.ok) {
    const error = await response.text();
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `API error (${response.status}): ${error}` })}\n\n`));
    return false;
  }

  const reader = response.body?.getReader();
  if (!reader) return false;

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
  return true;
}

// ─── Anthropic Sync ────────────────────

export async function callAnthropicSync(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  maxTokens: number | undefined,
): Promise<SyncResult> {
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

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    timeoutMs: TIMEOUT_STANDARD_MS,
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

export async function callOpenAISync(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  maxTokens: number | undefined,
): Promise<SyncResult> {
  const allMessages = [...messages];
  if (systemPrompt && !allMessages.some((m) => m.role === 'system')) {
    allMessages.unshift({ role: 'system', content: systemPrompt });
  }

  const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
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
    timeoutMs: TIMEOUT_STANDARD_MS,
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
