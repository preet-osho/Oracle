// ═══════════════════════════════════════
// ORACLE — Organization Members API
// GET  /api/organizations/members — list members of current org
// POST /api/organizations/members — invite member to current org
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { inviteMember, roleAtLeast, hasPermissionSync, type OrgRole } from '@/lib/permissions';
import { createLogger } from '@/lib/logger';

const log = createLogger('OrgMembers');

export async function GET() {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) {
    return NextResponse.json({ error: 'No organization context' }, { status: 400 });
  }

  try {
    const { supabase } = auth;
    const { data, error } = await supabase
      .from('organization_memberships')
      .select(`
        user_id,
        role,
        joined_at,
        invited_by
      `)
      .eq('org_id', auth.org.orgId);

    if (error) {
      log.error('Failed to list members', { error: error.message, orgId: auth.org.orgId });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      members: data ?? [],
      orgId: auth.org.orgId,
      yourRole: auth.org.role,
    });
  } catch (err) {
    log.error('Failed to list members', {
      error: err instanceof Error ? err.message : 'Unknown',
      orgId: auth.org.orgId,
    });
    return NextResponse.json({ error: 'Failed to list members' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) {
    return NextResponse.json({ error: 'No organization context' }, { status: 400 });
  }

  // Check permission
  const perm = hasPermissionSync(auth.org.role, 'INVITE_MEMBERS');
  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason }, { status: 403 });
  }

  try {
    const { email, role } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const validRoles = ['owner', 'admin', 'employee', 'client'];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Role must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Owners can assign any role; admins can only assign employee or client
    if (auth.org.role === 'admin' && roleAtLeast(role as OrgRole, 'admin')) {
      return NextResponse.json(
        { error: 'Admins can only invite employees or clients' },
        { status: 403 }
      );
    }

    const result = await inviteMember(auth.org.orgId, email, role, auth.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    log.info('Member invited via API', { orgId: auth.org.orgId, email, role });

    return NextResponse.json({ success: true, email, role }, { status: 201 });
  } catch (err) {
    log.error('Failed to invite member', {
      error: err instanceof Error ? err.message : 'Unknown',
      orgId: auth.org.orgId,
    });
    return NextResponse.json({ error: 'Failed to invite member' }, { status: 500 });
  }
}
