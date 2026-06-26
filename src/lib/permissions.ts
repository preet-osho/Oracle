// ═══════════════════════════════════════
// ORACLE — Permission System
// Role hierarchy, org-scoped access checks, permission guards
// Roles: owner > admin > employee > client
// ═══════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const log = createLogger('Permissions');

// ─── Types ─────────────────────────────

export type OrgRole = 'owner' | 'admin' | 'employee' | 'client';

export interface OrgContext {
  orgId: string;
  role: OrgRole;
  orgName?: string;
  orgSlug?: string;
}

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

// ─── Role Hierarchy ────────────────────

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 4,
  admin: 3,
  employee: 2,
  client: 1,
};

/**
 * Check if a role meets or exceeds a minimum role requirement.
 */
export function roleAtLeast(role: OrgRole, minRole: OrgRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

// ─── Permission Definitions ────────────

export const PERMISSIONS = {
  // Organization management
  MANAGE_ORG: 'admin' as OrgRole,
  MANAGE_BILLING: 'admin' as OrgRole,

  // Team management
  INVITE_MEMBERS: 'admin' as OrgRole,
  REMOVE_MEMBERS: 'admin' as OrgRole,
  CHANGE_ROLES: 'owner' as OrgRole,

  // Data operations
  CREATE_PROJECT: 'employee' as OrgRole,
  DELETE_PROJECT: 'employee' as OrgRole,
  CREATE_INVOICE: 'employee' as OrgRole,
  DELETE_INVOICE: 'employee' as OrgRole,
  CREATE_LEAD: 'employee' as OrgRole,
  DELETE_LEAD: 'employee' as OrgRole,
  CREATE_MEMORY: 'employee' as OrgRole,
  CREATE_CONVERSATION: 'employee' as OrgRole,
  CREATE_KNOWLEDGE_DOC: 'employee' as OrgRole,
  CREATE_PROPOSAL: 'employee' as OrgRole,
  CREATE_PROMPT: 'employee' as OrgRole,

  // Read operations (all roles)
  VIEW_PROJECTS: 'client' as OrgRole,
  VIEW_INVOICES: 'client' as OrgRole,
  VIEW_CONVERSATIONS: 'client' as OrgRole,
  VIEW_ANALYTICS: 'employee' as OrgRole,

  // AI operations
  USE_AI_CHAT: 'employee' as OrgRole,
  USE_SWARM: 'employee' as OrgRole,
  EMERGENCY_STOP: 'admin' as OrgRole,

  // Admin operations
  MANAGE_RATE_LIMITS: 'admin' as OrgRole,
  VIEW_AUDIT_LOGS: 'admin' as OrgRole,
  RESET_CIRCUIT_BREAKER: 'admin' as OrgRole,

  // System
  MANAGE_API_KEYS: 'employee' as OrgRole,
  MANAGE_SETTINGS: 'admin' as OrgRole,
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ─── Supabase Client (service-role) ────

let permClient: SupabaseClient | null = null;

function getPermClient(): SupabaseClient | null {
  if (permClient) return permClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  permClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return permClient;
}

// ─── Core Functions ────────────────────

/**
 * Get the user's organization context (org_id + role).
 * Uses the database function for efficiency.
 */
export async function getOrgContext(userId: string): Promise<OrgContext | null> {
  try {
    const client = getPermClient();
    if (!client) {
      log.warn('Permission system not configured — Supabase service key missing');
      return null;
    }

    const { data, error } = await client.rpc('get_user_org_context', {
      target_user_id: userId,
    });

    if (error || !data || data.length === 0) {
      return null;
    }

    const row = data[0];
    return {
      orgId: row.org_id,
      role: row.role as OrgRole,
    };
  } catch (err) {
    log.error('Failed to get org context', {
      error: err instanceof Error ? err.message : 'Unknown',
      userId,
    });
    return null;
  }
}

/**
 * Check if a user has a specific permission.
 */
export async function hasPermission(
  userId: string,
  permission: Permission
): Promise<PermissionCheck> {
  const requiredRole = PERMISSIONS[permission];
  const ctx = await getOrgContext(userId);

  if (!ctx) {
    return { allowed: false, reason: 'User has no organization membership' };
  }

  if (!roleAtLeast(ctx.role, requiredRole)) {
    return {
      allowed: false,
      reason: `Requires ${requiredRole} role, user has ${ctx.role}`,
    };
  }

  return { allowed: true };
}

/**
 * Synchronous check: does a role meet the minimum for a permission?
 * Use when you already have the role from a previous query.
 */
export function hasPermissionSync(
  role: OrgRole,
  permission: Permission
): PermissionCheck {
  const requiredRole = PERMISSIONS[permission];

  if (!roleAtLeast(role, requiredRole)) {
    return {
      allowed: false,
      reason: `Requires ${requiredRole} role, user has ${role}`,
    };
  }

  return { allowed: true };
}

/**
 * Create an organization and make the creator the owner.
 */
export async function createOrganization(
  name: string,
  slug: string,
  createdByUserId: string
): Promise<{ orgId: string } | { error: string }> {
  try {
    const client = getPermClient();
    if (!client) return { error: 'Permission system not configured' };

    // Create the organization
    const { data: org, error: orgError } = await client
      .from('organizations')
      .insert({
        name,
        slug,
        created_by: createdByUserId,
        created_at: Date.now(),
        updated_at: Date.now(),
      })
      .select('id')
      .single();

    if (orgError || !org) {
      return { error: orgError?.message || 'Failed to create organization' };
    }

    // Make the creator the owner
    const { error: memError } = await client
      .from('organization_memberships')
      .insert({
        user_id: createdByUserId,
        org_id: org.id,
        role: 'owner',
        joined_at: Date.now(),
      });

    if (memError) {
      return { error: memError.message || 'Failed to create owner membership' };
    }

    log.info('Organization created', { orgId: org.id, name, createdByUserId });
    return { orgId: org.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Invite a user to an organization.
 */
export async function inviteMember(
  orgId: string,
  email: string,
  role: OrgRole,
  invitedByUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getPermClient();
    if (!client) return { success: false, error: 'Permission system not configured' };

    // Check inviter has permission
    const inviterCtx = await getOrgContext(invitedByUserId);
    if (!inviterCtx || inviterCtx.orgId !== orgId) {
      return { success: false, error: 'Not a member of this organization' };
    }

    if (!roleAtLeast(inviterCtx.role, 'admin')) {
      return { success: false, error: 'Only admins can invite members' };
    }

    // Can't invite someone with a higher role than yourself
    if (roleAtLeast(role, inviterCtx.role) && inviterCtx.role !== 'owner') {
      return { success: false, error: 'Cannot invite someone with a higher role' };
    }

    // Find the user by email
    const { data: userData, error: userError } = await client.auth.admin.listUsers();
    if (userError) return { success: false, error: userError.message };

    const targetUser = userData.users.find(u => u.email === email);
    if (!targetUser) {
      return { success: false, error: 'User not found. They must sign up first.' };
    }

    // Check not already a member
    const { data: existing } = await client
      .from('organization_memberships')
      .select('id')
      .eq('user_id', targetUser.id)
      .eq('org_id', orgId)
      .single();

    if (existing) {
      return { success: false, error: 'User is already a member' };
    }

    // Create membership
    const { error: memError } = await client
      .from('organization_memberships')
      .insert({
        user_id: targetUser.id,
        org_id: orgId,
        role,
        invited_by: invitedByUserId,
        joined_at: Date.now(),
      });

    if (memError) return { success: false, error: memError.message };

    log.info('Member invited', { orgId, email, role, invitedByUserId });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Remove a member from an organization.
 */
export async function removeMember(
  orgId: string,
  targetUserId: string,
  removedByUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getPermClient();
    if (!client) return { success: false, error: 'Permission system not configured' };

    const removerCtx = await getOrgContext(removedByUserId);
    if (!removerCtx || removerCtx.orgId !== orgId) {
      return { success: false, error: 'Not a member of this organization' };
    }

    if (!roleAtLeast(removerCtx.role, 'admin')) {
      return { success: false, error: 'Only admins can remove members' };
    }

    // Can't remove someone with equal or higher role (unless owner)
    const targetCtx = await getOrgContext(targetUserId);
    if (targetCtx && roleAtLeast(targetCtx.role, removerCtx.role) && removerCtx.role !== 'owner') {
      return { success: false, error: 'Cannot remove someone with equal or higher role' };
    }

    // Can't remove owners
    if (targetCtx?.role === 'owner') {
      return { success: false, error: 'Cannot remove the organization owner' };
    }

    const { error } = await client
      .from('organization_memberships')
      .delete()
      .eq('user_id', targetUserId)
      .eq('org_id', orgId);

    if (error) return { success: false, error: error.message };

    log.info('Member removed', { orgId, targetUserId, removedByUserId });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Change a member's role.
 */
export async function changeMemberRole(
  orgId: string,
  targetUserId: string,
  newRole: OrgRole,
  changedByUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getPermClient();
    if (!client) return { success: false, error: 'Permission system not configured' };

    const changerCtx = await getOrgContext(changedByUserId);
    if (!changerCtx || changerCtx.orgId !== orgId) {
      return { success: false, error: 'Not a member of this organization' };
    }

    // Only owners can change roles
    if (changerCtx.role !== 'owner') {
      return { success: false, error: 'Only the owner can change member roles' };
    }

    const { error } = await client
      .from('organization_memberships')
      .update({ role: newRole })
      .eq('user_id', targetUserId)
      .eq('org_id', orgId);

    if (error) return { success: false, error: error.message };

    log.info('Member role changed', { orgId, targetUserId, newRole, changedByUserId });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
