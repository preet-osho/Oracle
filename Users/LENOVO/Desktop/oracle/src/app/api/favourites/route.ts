// ═══════════════════════════════════════
// ORACLE — Prompt Favourites API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { validateBody, CreateFavouriteSchema } from '@/lib/validations';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET() {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;
  try {
    const { data, error } = await supabase
      .from('prompt_favourites')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch favourites' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const rl = await enforceRateLimit('favourites', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody, CreateFavouriteSchema);
    if (validation.error) return validation.error;
    const body = validation.data;

    const { data, error } = await supabase
      .from('prompt_favourites')
      .insert({
        id: crypto.randomUUID(),
        user_id: auth.user.id,
        prompt_id: body.prompt_id,
        created_at: Date.now(),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to add favourite' },
      { status: 500 }
    );
  }
}
