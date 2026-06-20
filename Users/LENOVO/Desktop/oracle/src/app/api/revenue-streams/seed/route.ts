// ═══════════════════════════════════════
// ORACLE — Seed Default Revenue Streams
// Inserts 9 templates on first load if user has no streams
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { DEFAULT_REVENUE_TEMPLATES } from '@/data/revenue-templates';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST() {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) return Response.json({ error: "No organization found. Create or join an organization first." }, { status: 400 });
  const rl = await enforceRateLimit('revenue-seed', auth.user.id);
  if (rl) return rl;
  const { supabase, user } = auth;
  try {
    // Check if user already has revenue streams
    const { count, error: countError } = await supabase
      .from('revenue_streams')
      .select('id', { count: 'exact', head: true });

    if (countError) throw countError;

    // If user already has streams, return them instead of seeding
    if (count && count > 0) {
      const { data } = await supabase
        .from('revenue_streams')
        .select('*')
        .order('created_at', { ascending: false });
      return NextResponse.json({ seeded: false, streams: data || [] });
    }

    // Insert default templates
    const now = Date.now();
    const rows = DEFAULT_REVENUE_TEMPLATES.map((t) => ({
      id: crypto.randomUUID(),
      user_id: user.id,
      name: t.name,
      type: t.type,
      description: t.description,
      monthly_projection: t.monthlyProjection,
      annual_projection: t.annualProjection,
      status: t.status,
      margin: t.margin,
      effort: t.effort,
      timeline: t.timeline,
      tools: t.tools,
      notes: t.notes,
      created_at: now,
      updated_at: now,
    }));

    const { data, error } = await supabase
      .from('revenue_streams')
      .insert(rows)
      .select();

    if (error) throw error;
    return NextResponse.json({ seeded: true, streams: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to seed revenue streams' },
      { status: 500 }
    );
  }
}
