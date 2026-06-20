// ═══════════════════════════════════════
// ORACLE — Time Entries API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { validateBody, CreateTimeEntrySchema } from '@/lib/validations';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });
  const { supabase } = auth;
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');

    let query = supabase.from('time_entries').select('*').eq('org_id', auth.org.orgId).order('date', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch time entries' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });
  const rl = await enforceRateLimit('time-entries', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody, CreateTimeEntrySchema);
    if (validation.error) return validation.error;
    const body = validation.data;

    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        id: body.id || crypto.randomUUID(),
        org_id: auth.org.orgId,
        client_id: body.clientId || body.client_id,
        description: body.description || '',
        hours: body.hours || 0,
        rate: body.rate || 0,
        date: body.date || Date.now(),
        billable: body.billable !== undefined ? body.billable : true,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create time entry' },
      { status: 500 }
    );
  }
}
