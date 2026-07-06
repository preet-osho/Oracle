// ═══════════════════════════════════════
// ORACLE — Message History API Route
// GET /api/communication/history
// Retrieve message logs for a user/client/lead
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { getMessageHistory, getMessageStats } from '@/lib/communication/message-logger';

export async function GET(request: NextRequest) {
  // Auth
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  const searchParams = request.nextUrl.searchParams;
  const clientId = searchParams.get('clientId') || undefined;
  const leadId = searchParams.get('leadId') || undefined;
  const channel = (searchParams.get('channel') as 'whatsapp' | 'email') || undefined;
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const statsOnly = searchParams.get('stats') === 'true';

  // Stats mode
  if (statsOnly) {
    const stats = await getMessageStats(auth.user.id);
    return NextResponse.json(stats);
  }

  // History mode
  const messages = await getMessageHistory({
    userId: auth.user.id,
    clientId,
    leadId,
    channel,
    limit: Math.min(limit, 100),
    offset,
  });

  return NextResponse.json({
    messages,
    total: messages.length,
    limit,
    offset,
  });
}
