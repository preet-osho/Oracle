// ═══════════════════════════════════════
// ORACLE — Per-Client Memory System
// API-backed persistent memory · Context formatting · Auto-extraction
// ═══════════════════════════════════════

import type { MemoryItem } from '@/types';
import { memoriesApi } from '@/lib/api';

// ─── Save Memory ───────────────────────

export async function saveMemory(
  clientId: string,
  content: string,
  category: MemoryItem['category'],
  importance: MemoryItem['importance'] = 2
): Promise<MemoryItem> {
  const created = await memoriesApi.create({
    client_id: clientId,
    content,
    category,
    importance,
  });

  return {
    id: created.id,
    content: created.content,
    category: created.category as MemoryItem['category'],
    importance: created.importance as MemoryItem['importance'],
    createdAt: created.created_at,
  };
}

// ─── Get Memories ──────────────────────

export async function getMemories(clientId: string): Promise<MemoryItem[]> {
  const rows = await memoriesApi.list(clientId);
  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    category: r.category as MemoryItem['category'],
    importance: r.importance as MemoryItem['importance'],
    createdAt: r.created_at,
  }));
}

// ─── Delete Memory ─────────────────────

export async function deleteMemory(_clientId: string, memoryId: string): Promise<boolean> {
  try {
    await memoriesApi.delete(memoryId);
    return true;
  } catch (e) {
    console.warn('[Memory] Failed to delete memory:', e);
    return false;
  }
}

// ─── Format Memory for Context ─────────

export function formatMemoryForContext(memories: MemoryItem[]): string {
  if (memories.length === 0) return '';

  const sorted = [...memories].sort((a, b) => {
    if (b.importance !== a.importance) return b.importance - a.importance;
    return b.createdAt - a.createdAt;
  });

  const lines = sorted.map((item) => {
    const categoryLabel = item.category.charAt(0).toUpperCase() + item.category.slice(1);
    return `  - [${categoryLabel}] ${item.content}`;
  });

  return `What I remember about this client:\n${lines.join('\n')}`;
}

// ─── Extract and Save Memories ─────────

const MAX_MEMORIES_PER_CLIENT = 100;
const VALID_CATEGORIES: MemoryItem['category'][] = ['preference', 'fact', 'feedback', 'decision', 'contact'];

export async function extractAndSaveMemories(
  clientId: string,
  conversation: string
): Promise<void> {
  // Fetch existing memories for deduplication
  const existingMemories = await getMemories(clientId);
  if (existingMemories.length >= MAX_MEMORIES_PER_CLIENT) {
    console.warn(`[Memory] Client ${clientId} already has ${existingMemories.length} memories — skipping extraction`);
    return;
  }

  const existingSummaries = existingMemories
    .slice(0, 20)
    .map((m) => `- [${m.category}] ${m.content}`)
    .join('\n');

  const extractionPrompt = `Extract key facts from this conversation that would be useful to remember about this client. Focus on:
- Preferences (communication style, tools, budget)
- Facts (business details, contacts, requirements)
- Feedback (what they liked/disliked)
- Decisions (choices made, directions agreed upon)
- Contact info (names, phones, emails)

Rules:
- Only extract facts that are NEW and not already in the existing memories below
- Each fact should be a single, concise sentence (max 150 chars)
- Importance: 3 = critical (budget, deadlines, key contacts), 2 = useful (preferences, decisions), 1 = minor
- Do NOT extract opinions, jokes, or transient conversation filler

Existing memories (do NOT duplicate these):
${existingSummaries || '(none yet)'}

Conversation (last 4000 chars):
${conversation.slice(-4000)}

Return ONLY a JSON array of objects with fields: content (string), category (one of: ${VALID_CATEGORIES.join(', ')}), importance (1, 2, or 3).
If nothing new worth remembering, return an empty array [].`;

  try {
    const { NeverStopRouter } = await import('@/lib/router');

    const result = await NeverStopRouter.callAISyncServer(extractionPrompt, { maxTokens: 1000 });

    const text = result.text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (!jsonMatch) return;

    const extracted = JSON.parse(jsonMatch[0]) as Array<{
      content: string;
      category: string;
      importance: number;
    }>;

    // Validate, deduplicate, and save
    const seen = new Set(existingMemories.map((m) => m.content.toLowerCase().trim()));
    let saved = 0;

    for (const item of extracted) {
      if (saved >= MAX_MEMORIES_PER_CLIENT - existingMemories.length) break;
      if (!item.content || typeof item.content !== 'string') continue;

      const category = VALID_CATEGORIES.includes(item.category as MemoryItem['category'])
        ? (item.category as MemoryItem['category'])
        : 'fact';
      const importance = Math.min(3, Math.max(1, Math.round(item.importance) || 2)) as 1 | 2 | 3;
      const normalizedContent = item.content.toLowerCase().trim().slice(0, 150);

      // Skip duplicates (fuzzy: same content after normalization)
      if (seen.has(normalizedContent)) continue;
      seen.add(normalizedContent);

      await saveMemory(clientId, item.content.trim().slice(0, 150), category, importance);
      saved++;
    }
  } catch (e) {
    console.warn('[Memory] Failed to extract memories:', e);
  }
}

// ─── Auto-Extract Memories from Chat ───

/**
 * Tracks last extraction state per client to avoid extracting on every message.
 * Key: clientId, Value: { messageCount: number, lastExtractionAt: number }
 */
const extractionState = new Map<string, { messageCount: number; lastExtractionAt: number }>();

/** Minimum messages between extractions (client-side throttle) */
const MIN_MESSAGES_BETWEEN_EXTRACTIONS = 5;

/** Minimum time between extractions (ms) — 2 minutes */
const MIN_TIME_BETWEEN_EXTRACTIONS = 2 * 60 * 1000;

/** Minimum user messages required before extraction triggers */
const MIN_USER_MESSAGES = 2;

/**
 * Called after each chat response to track message counts and trigger
 * background memory extraction when thresholds are met.
 *
 * This function is fire-and-forget — it never blocks the chat response.
 *
 * @param clientId - The project/client ID to store memories for
 * @param messages - The full conversation message array
 */
export function maybeAutoExtractMemories(
  clientId: string,
  messages: Array<{ role: string; content: string }>,
): void {
  if (!clientId) return;

  const state = extractionState.get(clientId) ?? { messageCount: 0, lastExtractionAt: 0 };
  state.messageCount++;

  // Check thresholds
  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  const timeSinceLast = Date.now() - state.lastExtractionAt;

  const meetsMessageThreshold = state.messageCount >= MIN_MESSAGES_BETWEEN_EXTRACTIONS;
  const meetsTimeThreshold = timeSinceLast >= MIN_TIME_BETWEEN_EXTRACTIONS;
  const meetsUserThreshold = userMessageCount >= MIN_USER_MESSAGES;

  extractionState.set(clientId, state);

  if (!meetsMessageThreshold || !meetsTimeThreshold || !meetsUserThreshold) return;

  // Reset counter
  state.messageCount = 0;
  state.lastExtractionAt = Date.now();

  // Fire-and-forget: extract in background, don't block chat
  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  extractAndSaveMemories(clientId, conversationText).catch(() => {
    // Non-critical: extraction failures are logged inside extractAndSaveMemories
  });
}

/**
 * Reset extraction state for a client (e.g., when starting a new conversation)
 */
export function resetAutoExtractionState(clientId: string): void {
  extractionState.delete(clientId);
}

// ─── Get All Client IDs ────────────────

export async function getAllClientIds(): Promise<string[]> {
  try {
    return await memoriesApi.getAllClientIds();
  } catch (e) {
    console.warn('[Memory] Failed to get client IDs:', e);
    return [];
  }
}

// ─── Memory → Invoice Context ─────────

/**
 * Extracts payment preferences, GST/TDS notes, and billing preferences
 * from client memories to populate invoice fields.
 */
export function memoriesToInvoiceContext(memories: MemoryItem[]): {
  paymentTerms: string;
  notes: string;
  billingPreferences: string[];
} {
  const paymentTerms: string[] = [];
  const notes: string[] = [];
  const billingPreferences: string[] = [];

  for (const mem of memories) {
    const lower = mem.content.toLowerCase();

    if (lower.includes('payment term') || lower.includes('net ') || lower.includes('upfront')) {
      paymentTerms.push(mem.content);
    }
    if (lower.includes('gst') || lower.includes('tds') || lower.includes('invoice')) {
      notes.push(mem.content);
    }
    if (lower.includes('prefer') || lower.includes('billing') || lower.includes('format')) {
      billingPreferences.push(mem.content);
    }
  }

  return {
    paymentTerms: paymentTerms[0] || 'Net 30 days',
    notes: notes.join('\n') || '',
    billingPreferences,
  };
}

// ─── Clear Client Memories ─────────────

export async function clearClientMemories(clientId: string): Promise<void> {
  try {
    const memories = await getMemories(clientId);
    for (const m of memories) {
      await memoriesApi.delete(m.id);
    }
  } catch (e) {
    console.warn('[Memory] Failed to clear client memories:', e);
  }
}
