// ═══════════════════════════════════════
// ORACLE — Single Project API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { validateBody, UpdateProjectSchema } from '@/lib/validations';
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
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch project' },
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
  const rl = await enforceRateLimit('projects', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody, UpdateProjectSchema);
    if (validation.error) return validation.error;
    const body = validation.data;

    const updateData: Record<string, unknown> = { updated_at: Date.now() };

    if (body.clientName !== undefined || body.client_name !== undefined) {
      updateData.client_name = body.clientName || body.client_name;
    }
    if (body.industry !== undefined) updateData.industry = body.industry;
    if (body.sector !== undefined) updateData.sector = body.sector;
    if (body.service !== undefined) updateData.service = body.service;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.value !== undefined) updateData.value = body.value;
    if (body.deadline !== undefined) updateData.deadline = body.deadline;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.requirements !== undefined) updateData.requirements = body.requirements;
    if (body.contacts !== undefined) {
      updateData.contact_name = body.contacts.name || '';
      updateData.contact_phone = body.contacts.phone || '';
      updateData.contact_email = body.contacts.email || '';
    }
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.totalHours !== undefined) updateData.total_hours = body.totalHours;
    if (body.invoiceTotal !== undefined) updateData.invoice_total = body.invoiceTotal;

    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update project' },
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
  const { supabase } = auth;
  try {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete project' },
      { status: 500 }
    );
  }
}
