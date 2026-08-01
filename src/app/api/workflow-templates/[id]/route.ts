// ═══════════════════════════════════════
// ORACLE — Single Workflow Template API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: 'No organization found' }, { status: 400 });
  const rl = await enforceRateLimit('workflow-templates', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;

  try {
    // Don't allow deleting built-in templates
    const { data: template } = await supabase
      .from('workflow_templates')
      .select('is_builtin')
      .eq('id', id)
      .eq('org_id', auth.org.orgId)
      .single();

    if (template?.is_builtin) {
      return NextResponse.json({ error: 'Cannot delete built-in templates' }, { status: 400 });
    }

    const { error } = await supabase
      .from('workflow_templates')
      .delete()
      .eq('id', id)
      .eq('org_id', auth.org.orgId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete workflow template' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: 'No organization found' }, { status: 400 });
  const rl = await enforceRateLimit('workflow-templates', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: Date.now() };

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.color !== undefined) updates.color = body.color;
    if (body.estimated_time !== undefined) updates.estimated_time = body.estimated_time;
    if (body.domains !== undefined) updates.domains = body.domains;
    if (body.steps !== undefined) updates.steps = body.steps;
    if (body.use_count !== undefined) updates.use_count = body.use_count;

    const { data, error } = await supabase
      .from('workflow_templates')
      .update(updates)
      .eq('id', id)
      .eq('org_id', auth.org.orgId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update workflow template' },
      { status: 500 }
    );
  }
}
