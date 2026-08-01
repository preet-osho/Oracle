// ═══════════════════════════════════════
// ORACLE — Workflow Templates API Route
// ═══════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { enforceRateLimit } from '@/lib/rate-limit';

export interface WorkflowTemplate {
  id: string;
  org_id: string;
  name: string;
  description: string;
  color: string;
  estimated_time: string;
  domains: string[];
  steps: Array<{
    id: string;
    name: string;
    description: string;
    prompt: string;
    agent?: string;
  }>;
  is_builtin: boolean;
  use_count: number;
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
      .from('workflow_templates')
      .select('*')
      .eq('org_id', auth.org.orgId)
      .order('is_builtin', { ascending: false })
      .order('use_count', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch workflow templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: 'No organization found' }, { status: 400 });
  const rl = await enforceRateLimit('workflow-templates', auth.user.id);
  if (rl) return rl;
  const { supabase } = auth;

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!body.steps || !Array.isArray(body.steps) || body.steps.length === 0) {
      return NextResponse.json({ error: 'At least one step is required' }, { status: 400 });
    }

    const now = Date.now();
    const template = {
      id: `wt_${now}_${Math.random().toString(36).substring(2, 9)}`,
      org_id: auth.org.orgId,
      name: body.name.trim(),
      description: (body.description || '').trim(),
      color: body.color || '#3b82f6',
      estimated_time: body.estimated_time || '1-2 hours',
      domains: body.domains || [],
      steps: body.steps.map((s: Record<string, unknown>, i: number) => ({
        id: s.id || `step-${i + 1}`,
        name: s.name || `Step ${i + 1}`,
        description: s.description || '',
        prompt: s.prompt || '',
        agent: s.agent,
      })),
      is_builtin: false,
      use_count: 0,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('workflow_templates')
      .insert(template)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create workflow template' },
      { status: 500 }
    );
  }
}
