// ═══════════════════════════════════════
// ORACLE — Revenue Streams API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { validateBody, CreateRevenueStreamSchema } from '@/lib/validations';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });
  const { supabase } = auth;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('revenue_streams')
      .select('*')
      .eq('org_id', auth.org.orgId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch revenue streams' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });
  const rl = await enforceRateLimit('revenue-streams', auth.user.id);
  if (rl) return rl;
  const { supabase, user } = auth;
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody, CreateRevenueStreamSchema);
    if (validation.error) return validation.error;
    const body = validation.data;
    const now = Date.now();

    const { data, error } = await supabase
      .from('revenue_streams')
      .insert({
        id: body.id || crypto.randomUUID(),
        user_id: user.id,
        name: body.name || '',
        type: body.type || 'Service',
        description: body.description || '',
        monthly_projection: body.monthlyProjection || body.monthly_projection || 0,
        annual_projection: body.annualProjection || body.annual_projection || 0,
        status: body.status || 'Planning',
        margin: body.margin || 80,
        effort: body.effort || 'Medium',
        timeline: body.timeline || '',
        tools: body.tools || [],
        notes: body.notes || '',
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create revenue stream' },
      { status: 500 }
    );
  }
}
