// ═══════════════════════════════════════
// ORACLE — Single Custom Agent API Route
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
  const rl = await enforceRateLimit('custom-agents', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: Date.now() };

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.category !== undefined) updates.category = body.category;
    if (body.task_focus !== undefined) updates.task_focus = body.task_focus;
    if (body.prompt !== undefined) updates.prompt = body.prompt;
    if (body.default_tier !== undefined) updates.default_tier = body.default_tier;
    if (body.default_provider_id !== undefined) updates.default_provider_id = body.default_provider_id;
    if (body.default_model_id !== undefined) updates.default_model_id = body.default_model_id;
    if (body.tools !== undefined) updates.tools = body.tools;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const { data, error } = await supabase
      .from('custom_agents')
      .update(updates)
      .eq('id', id)
      .eq('org_id', auth.org.orgId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update custom agent' },
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
  const rl = await enforceRateLimit('custom-agents', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;

  try {
    const { error } = await supabase
      .from('custom_agents')
      .delete()
      .eq('id', id)
      .eq('org_id', auth.org.orgId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete custom agent' },
      { status: 500 }
    );
  }
}
