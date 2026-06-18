// ═══════════════════════════════════════
// ORACLE — Memories API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { validateBody, CreateMemorySchema } from '@/lib/validations';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');
    const allClients = searchParams.get('all_clients');

    if (allClients === 'true') {
      const { data, error } = await supabase
        .from('memories')
        .select('client_id')
        .eq('user_id', auth.user.id)
        .order('client_id');

      if (error) throw error;
      const uniqueIds = Array.from(new Set((data || []).map((r) => r.client_id)));
      return NextResponse.json(uniqueIds);
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'client_id is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', auth.user.id)
      .eq('client_id', clientId)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch memories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const rl = await enforceRateLimit('memories', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody, CreateMemorySchema);
    if (validation.error) return validation.error;
    const body = validation.data;

    const { data, error } = await supabase
      .from('memories')
      .insert({
        id: body.id || crypto.randomUUID(),
        user_id: auth.user.id,
        client_id: body.clientId || body.client_id,
        content: body.content,
        category: body.category,
        importance: body.importance || 2,
        created_at: body.createdAt || body.created_at || Date.now(),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create memory' },
      { status: 500 }
    );
  }
}
