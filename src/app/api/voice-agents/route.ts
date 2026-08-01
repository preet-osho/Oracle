// ═══════════════════════════════════════
// ORACLE — Voice Agents API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { enforceRateLimit } from '@/lib/rate-limit';

export interface VoiceAgentRecord {
  id: string;
  org_id: string;
  name: string;
  provider: 'vapi' | 'sarvam' | 'elevenlabs' | 'bland';
  voice: string;
  language: string;
  greeting: string;
  instructions: string;
  tools: string[];
  is_active: boolean;
  config: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export async function GET() {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: 'No organization found' }, { status: 400 });
  const { supabase } = auth;

  try {
    const { data, error } = await supabase
      .from('voice_agents')
      .select('*')
      .eq('org_id', auth.org.orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch voice agents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: 'No organization found' }, { status: 400 });
  const rl = await enforceRateLimit('voice-agents', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;

  try {
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const now = Date.now();
    const agent = {
      id: `va_${now}_${Math.random().toString(36).substring(2, 9)}`,
      org_id: auth.org.orgId,
      name: body.name.trim(),
      provider: body.provider || 'vapi',
      voice: body.voice || 'Aria (Female, Professional)',
      language: body.language || 'English',
      greeting: (body.greeting || '').trim(),
      instructions: (body.instructions || '').trim(),
      tools: body.tools || [],
      is_active: false,
      config: body.config || {},
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('voice_agents')
      .insert(agent)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create voice agent' },
      { status: 500 }
    );
  }
}
