// ═══════════════════════════════════════
// ORACLE — Single Lead API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { validateBody, UpdateLeadSchema } from '@/lib/validations';
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
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch lead' },
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
  const rl = await enforceRateLimit('leads', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody, UpdateLeadSchema);
    if (validation.error) return validation.error;
    const body = validation.data;
    const updateData: Record<string, unknown> = { updated_at: Date.now() };

    if (body.businessName !== undefined) updateData.business_name = body.businessName;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.website !== undefined) updateData.website = body.website;
    if (body.googleMapsUrl !== undefined) updateData.google_maps_url = body.googleMapsUrl;
    if (body.rating !== undefined) updateData.rating = body.rating;
    if (body.reviewCount !== undefined) updateData.review_count = body.reviewCount;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.industry !== undefined) updateData.industry = body.industry;
    if (body.triggerCriterion !== undefined) updateData.trigger_criterion = body.triggerCriterion;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.channel !== undefined) updateData.channel = body.channel;
    if (body.personalisedMessage !== undefined) updateData.personalised_message = body.personalisedMessage;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.source !== undefined) updateData.source = body.source;
    if (body.assignedTo !== undefined) updateData.assigned_to = body.assignedTo;
    if (body.followUpDate !== undefined) updateData.follow_up_date = body.followUpDate;

    const { data, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update lead' },
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
  const rl = await enforceRateLimit('leads', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;
  try {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete lead' },
      { status: 500 }
    );
  }
}
