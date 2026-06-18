// ═══════════════════════════════════════
// ORACLE — Leads API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { validateBody, CreateLeadSchema } from '@/lib/validations';
import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const source = searchParams.get('source');

    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (source) query = query.eq('source', source);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const rl = await enforceRateLimit('leads', auth.user.id);
  if (rl) return rl;
  const { supabase, user } = auth;
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody, CreateLeadSchema);
    if (validation.error) return validation.error;
    const body = validation.data;
    const now = Date.now();

    const { data, error } = await supabase
      .from('leads')
      .insert({
        id: body.id || crypto.randomUUID(),
        user_id: user.id,
        business_name: body.businessName || body.business_name || '',
        phone: body.phone || '',
        email: body.email || '',
        website: body.website || '',
        google_maps_url: body.googleMapsUrl || body.google_maps_url || '',
        rating: body.rating || 0,
        review_count: body.reviewCount || body.review_count || 0,
        address: body.address || '',
        city: body.city || '',
        category: body.category || '',
        industry: body.industry || '',
        trigger_criterion: body.triggerCriterion || body.trigger_criterion || '',
        status: body.status || 'New',
        channel: body.channel || null,
        personalised_message: body.personalisedMessage || body.personalised_message || '',
        notes: body.notes || '',
        source: body.source || 'Manual',
        assigned_to: body.assignedTo || body.assigned_to || '',
        follow_up_date: body.followUpDate || body.follow_up_date || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw error;

    // Audit log (fire-and-forget)
    writeAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.CREATE,
      entityType: 'lead',
      entityId: data.id,
      newValue: data,
    });

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create lead' },
      { status: 500 }
    );
  }
}
