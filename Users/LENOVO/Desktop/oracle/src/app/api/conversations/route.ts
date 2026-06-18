// ═══════════════════════════════════════
// ORACLE — Conversations API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { validateBody, CreateConversationSchema } from '@/lib/validations';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET() {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const rl = await enforceRateLimit('conversations', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody, CreateConversationSchema);
    if (validation.error) return validation.error;
    const body = validation.data;
    const now = Date.now();

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: auth.user.id,
        title: body.title || 'New Chat',
        messages: body.messages || [],
        agent_type: body.agent_type || 'orchestrator',
        project_id: body.project_id || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
