// ═══════════════════════════════════════
// ORACLE — Seed Default Leads
// Inserts 5 sample leads on first load if user has no leads
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { DEFAULT_LEAD_TEMPLATES } from '@/data/lead-templates';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST() {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  const rl = await enforceRateLimit('leads-seed', auth.user.id);
  if (rl) return rl;
  const { supabase, user } = auth;
  try {
    // Check if user already has leads
    const { count, error: countError } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true });

    if (countError) throw countError;

    // If user already has leads, return them instead of seeding
    if (count && count > 0) {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      return NextResponse.json({ seeded: false, leads: data || [] });
    }

    // Insert default templates
    const now = Date.now();
    const rows = DEFAULT_LEAD_TEMPLATES.map((t) => ({
      id: crypto.randomUUID(),
      user_id: user.id,
      business_name: t.businessName,
      phone: t.phone,
      email: t.email,
      website: t.website,
      google_maps_url: t.googleMapsUrl,
      rating: t.rating,
      review_count: t.reviewCount,
      address: t.address,
      city: t.city,
      category: t.category,
      industry: t.industry,
      trigger_criterion: t.triggerCriterion,
      status: t.status,
      channel: t.channel || null,
      personalised_message: t.personalisedMessage || null,
      notes: t.notes,
      source: t.source,
      assigned_to: t.assignedTo || null,
      follow_up_date: t.followUpDate || null,
      created_at: now,
      updated_at: now,
    }));

    const { data, error } = await supabase
      .from('leads')
      .insert(rows)
      .select();

    if (error) throw error;
    return NextResponse.json({ seeded: true, leads: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to seed leads' },
      { status: 500 }
    );
  }
}
