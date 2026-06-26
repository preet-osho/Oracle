// ═══════════════════════════════════════
// ORACLE — Organization Member API
// PATCH /api/organizations/members/[userId] — change role
// DELETE /api/organizations/members/[userId] — remove member
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { validateAuth } from '@/lib/supabase/validate';
import { changeMemberRole, removeMember, hasPermissionSync } from '@/lib/permissions';
import { createLogger } from '@/lib/logger';

const log = createLogger('OrgMember');

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) {
    return NextResponse.json({ error: 'No organization context' }, { status: 400 });
  }

  // Only owners can change roles
  const perm = hasPermissionSync(auth.org.role, 'CHANGE_ROLES');
  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason }, { status: 403 });
  }

  try {
    const { userId } = await params;
    const { role: newRole } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const validRoles = ['owner', 'admin', 'employee', 'client'];
    if (!newRole || !validRoles.includes(newRole)) {
      return NextResponse.json(
        { error: `Role must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await changeMemberRole(auth.org.orgId, userId, newRole, auth.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    log.info('Member role changed via API', {
      orgId: auth.org.orgId,
      targetUserId: userId,
      newRole,
    });

    return NextResponse.json({ success: true, userId, role: newRole });
  } catch (err) {
    log.error('Failed to change member role', {
      error: err instanceof Error ? err.message : 'Unknown',
      orgId: auth.org.orgId,
    });
    return NextResponse.json({ error: 'Failed to change member role' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await validateAuth();
  if ('error' in auth) return auth.error;
  if (!auth.org) {
    return NextResponse.json({ error: 'No organization context' }, { status: 400 });
  }

  // Check permission (admins can remove members, owners can remove anyone)
  const perm = hasPermissionSync(auth.org.role, 'REMOVE_MEMBERS');
  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason }, { status: 403 });
  }

  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const result = await removeMember(auth.org.orgId, userId, auth.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    log.info('Member removed via API', { orgId: auth.org.orgId, targetUserId: userId });

    return NextResponse.json({ success: true, userId });
  } catch (err) {
    log.error('Failed to remove member', {
      error: err instanceof Error ? err.message : 'Unknown',
      orgId: auth.org.orgId,
    });
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
