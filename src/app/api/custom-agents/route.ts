// ═══════════════════════════════════════
// ORACLE — Custom Agents API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET() {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: 'No organization found' }, { status: 400 });
  const { supabase } = auth;

  try {
    const { data, error } = await supabase
      .from('custom_agents')
      .select('*')
      .eq('org_id', auth.org.orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch custom agents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: 'No organization found' }, { status: 400 });
  const rl = await enforceRateLimit('custom-agents', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;

  try {
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
      return NextResponse.json({ error: 'System prompt is required' }, { status: 400 });
    }

    const now = Date.now();
    const agent = {
      id: `ca_${now}_${Math.random().toString(36).substring(2, 9)}`,
      org_id: auth.org.orgId,
      name: body.name.trim(),
      description: (body.description || '').trim(),
      category: body.category || 'general',
      task_focus: (body.task_focus || '').trim(),
      prompt: body.prompt.trim(),
      default_tier: body.default_tier || 'standard',
      default_provider_id: body.default_provider_id || null,
      default_model_id: body.default_model_id || null,
      tools: body.tools || [],
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('custom_agents')
      .insert(agent)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create custom agent' },
      { status: 500 }
    );
  }
}
