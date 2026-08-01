// ═══════════════════════════════════════
// ORACLE — Single Voice Agent API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: 'No organization found' }, { status: 400 });
  const rl = await enforceRateLimit('voice-agents', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: Date.now() };

    if (body.name !== undefined) updates.name = body.name;
    if (body.provider !== undefined) updates.provider = body.provider;
    if (body.voice !== undefined) updates.voice = body.voice;
    if (body.language !== undefined) updates.language = body.language;
    if (body.greeting !== undefined) updates.greeting = body.greeting;
    if (body.instructions !== undefined) updates.instructions = body.instructions;
    if (body.tools !== undefined) updates.tools = body.tools;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.config !== undefined) updates.config = body.config;

    const { data, error } = await supabase
      .from('voice_agents')
      .update(updates)
      .eq('id', id)
      .eq('org_id', auth.org.orgId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update voice agent' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: 'No organization found' }, { status: 400 });
  const rl = await enforceRateLimit('voice-agents', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;

  try {
    const { error } = await supabase
      .from('voice_agents')
      .delete()
      .eq('id', id)
      .eq('org_id', auth.org.orgId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete voice agent' },
      { status: 500 }
    );
  }
}
