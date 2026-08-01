// ═══════════════════════════════════════
// ORACLE — Call Logs API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';

export async function GET(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: 'No organization found' }, { status: 400 });
  const { supabase } = auth;

  const url = new URL(request.url);
  const agentId = url.searchParams.get('agent_id');

  try {
    let query = supabase
      .from('call_logs')
      .select('*')
      .eq('org_id', auth.org.orgId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch call logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: 'No organization found' }, { status: 400 });
  const { supabase } = auth;

  try {
    const body = await request.json();

    if (!body.agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    const now = Date.now();
    const log = {
      id: `cl_${now}_${Math.random().toString(36).substring(2, 9)}`,
      org_id: auth.org.orgId,
      agent_id: body.agent_id,
      caller_number: body.caller_number || '',
      duration: body.duration || 0,
      status: body.status || 'completed',
      transcript: body.transcript || '',
      sentiment: body.sentiment || 'neutral',
      summary: body.summary || '',
      metadata: body.metadata || {},
      created_at: now,
    };

    const { data, error } = await supabase
      .from('call_logs')
      .insert(log)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create call log' },
      { status: 500 }
    );
  }
}
