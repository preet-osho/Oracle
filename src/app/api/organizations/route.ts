// ═══════════════════════════════════════
// ORACLE — Organizations API
// POST /api/organizations — create org
// GET  /api/organizations — list user's orgs
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { createOrganization } from '@/lib/permissions';
import { createLogger } from '@/lib/logger';

const log = createLogger('Organizations');

export async function POST(request: Request) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  try {
    const { name, slug } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
    }

    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
      return NextResponse.json({ error: 'Organization slug is required' }, { status: 400 });
    }

    // Validate slug format (lowercase alphanumeric + hyphens)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'Slug must be lowercase alphanumeric with hyphens only' },
        { status: 400 }
      );
    }

    const result = await createOrganization(name.trim(), slug.trim(), auth.user.id);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    log.info('Organization created via API', { orgId: result.orgId, name, slug });

    return NextResponse.json({ orgId: result.orgId, name, slug }, { status: 201 });
  } catch (err) {
    log.error('Failed to create organization', {
      error: err instanceof Error ? err.message : 'Unknown',
      userId: auth.user.id,
    });
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}

export async function GET() {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;

  try {
    const { supabase } = auth;
    const { data, error } = await supabase
      .from('organization_memberships')
      .select(`
        role,
        joined_at,
        organizations (
          id,
          name,
          slug,
          created_at
        )
      `)
      .eq('user_id', auth.user.id);

    if (error) {
      log.error('Failed to list organizations', { error: error.message, userId: auth.user.id });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const organizations = (data ?? []).map((m: any) => ({
      orgId: m.organizations?.id,
      name: m.organizations?.name,
      slug: m.organizations?.slug,
      role: m.role,
      joinedAt: m.joined_at,
      createdAt: m.organizations?.created_at,
    })).filter((o: any) => o.orgId);

    return NextResponse.json({ organizations });
  } catch (err) {
    log.error('Failed to list organizations', {
      error: err instanceof Error ? err.message : 'Unknown',
      userId: auth.user.id,
    });
    return NextResponse.json({ error: 'Failed to list organizations' }, { status: 500 });
  }
}
