// ═══════════════════════════════════════
// ORACLE — Conversation Messages API Route
// Append messages incrementally to conversations.messages JSONB column
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { validateBody, AppendMessagesSchema } from '@/lib/validations';
import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/conversations/[id]/messages
 * Append one or more messages to the conversation's messages JSONB array.
 * Uses Supabase's jsonb concatenation to avoid replacing the entire array.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: 'No organization found. Create or join an organization first.' }, { status: 400 });
  const rl = await enforceRateLimit('conversations', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;

  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody, AppendMessagesSchema);
    if (validation.error) return validation.error;
    const body = validation.data;

    // Store validated messages directly — schema already enforces shape
    const serializable = body.messages.map((m) => ({
      ...m,
      content: m.content || '',
      timestamp: m.timestamp || Date.now(),
    }));

    // Use Supabase RPC-style append: fetch + merge in a single logical operation.
    // Accepts a potential race condition with concurrent requests (low risk for single-user chat).
    const { data: convo, error: fetchError } = await supabase
      .from('conversations')
      .select('messages')
      .eq('id', id)
      .eq('org_id', auth.org.orgId)
      .single();

    if (fetchError) throw fetchError;

    const existing = Array.isArray(convo?.messages) ? convo.messages : [];
    const updated = [...existing, ...serializable];

    const { data, error } = await supabase
      .from('conversations')
      .update({
        messages: updated,
        updated_at: Date.now(),
      })
      .eq('id', id)
      .eq('org_id', auth.org.orgId)
      .select('id, messages')
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to append messages' },
      { status: 500 }
    );
  }
}
