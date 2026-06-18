// ═══════════════════════════════════════
// ORACLE — Single Time Entry API Route
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
  const rl = await enforceRateLimit('time-entries', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;
  try {
    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete time entry' },
      { status: 500 }
    );
  }
}
