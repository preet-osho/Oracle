// ═══════════════════════════════════════
// ORACLE — Single Revenue Stream API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { validateBody, UpdateRevenueStreamSchema } from '@/lib/validations';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;
  try {
    const { data, error } = await supabase
      .from('revenue_streams')
      .select('*')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch revenue stream' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const rl = await enforceRateLimit('revenue-streams', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody, UpdateRevenueStreamSchema);
    if (validation.error) return validation.error;
    const body = validation.data;
    const updateData: Record<string, unknown> = { updated_at: Date.now() };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.monthlyProjection !== undefined) updateData.monthly_projection = body.monthlyProjection;
    if (body.annualProjection !== undefined) updateData.annual_projection = body.annualProjection;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.margin !== undefined) updateData.margin = body.margin;
    if (body.effort !== undefined) updateData.effort = body.effort;
    if (body.timeline !== undefined) updateData.timeline = body.timeline;
    if (body.tools !== undefined) updateData.tools = body.tools;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const { data, error } = await supabase
      .from('revenue_streams')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update revenue stream' },
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
  const rl = await enforceRateLimit('revenue-streams', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;
  try {
    const { error } = await supabase
      .from('revenue_streams')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete revenue stream' },
      { status: 500 }
    );
  }
}
