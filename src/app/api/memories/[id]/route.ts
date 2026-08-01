// ═══════════════════════════════════════
// ORACLE — Single Memory API Route
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
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });
  const rl = await enforceRateLimit('memories', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.content !== undefined) updates.content = body.content;
    if (body.category !== undefined) updates.category = body.category;
    if (body.importance !== undefined) updates.importance = body.importance;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('memories')
      .update(updates)
      .eq('id', id)
      .eq('org_id', auth.org.orgId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update memory' },
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
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });
  const rl = await enforceRateLimit('memories', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;
  try {
    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', id)
      .eq('org_id', auth.org.orgId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete memory' },
      { status: 500 }
    );
  }
}
