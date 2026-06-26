// ═══════════════════════════════════════
// ORACLE — Custom Prompts API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { validateBody, CreatePromptSchema } from '@/lib/validations';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET() {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });
  const { supabase } = auth;
  try {
    const { data, error } = await supabase
      .from('custom_prompts')
      .select('*')
      .eq('org_id', auth.org.orgId)
      .order('use_count', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch custom prompts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });
  const rl = await enforceRateLimit('prompts', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;
  try {
    const rawBody = await request.json();
    const validation = validateBody(rawBody, CreatePromptSchema);
    if (validation.error) return validation.error;
    const body = validation.data;

    const { data, error } = await supabase
      .from('custom_prompts')
      .insert({
        id: body.id,
        org_id: auth.org.orgId,
        title: body.title,
        category: body.category || '',
        domain: body.domain || '',
        difficulty: body.difficulty || 'Medium',
        time_estimate: body.time_estimate || body.timeEstimate || '10 min',
        tools: body.tools || [],
        description: body.description || '',
        prompt: body.prompt || '',
        use_count: 0,
        user_rating: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create custom prompt' },
      { status: 500 }
    );
  }
}
