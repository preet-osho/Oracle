// ═══════════════════════════════════════
// ORACLE — Active Calls API Route
// GET /api/active-calls — Poll for live call status
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';

export async function GET() {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: 'No organization found' }, { status: 400 });
  const { supabase } = auth;

  try {
    const { data, error } = await supabase
      .from('active_calls')
      .select('*')
      .eq('org_id', auth.org.orgId)
      .in('status', ['ringing', 'in-progress', 'forwarding'])
      .order('started_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch active calls' },
      { status: 500 }
    );
  }
}
