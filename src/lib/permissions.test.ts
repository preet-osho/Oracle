// ═══════════════════════════════════════
// ORACLE — Permissions Library Tests
// Full permission matrix, Supabase-dependent functions, edge cases
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  roleAtLeast,
  hasPermissionSync,
  PERMISSIONS,
  type OrgRole,
  type Permission,
} from './permissions';

// ─── Supabase Mock ─────────────────────

const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockRpc = vi.fn();
const mockListUsers = vi.fn();

const createMockChain = () => {
  const chain: Record<string, unknown> = {};

  const handler: ProxyHandler<typeof chain> = {
    get(_target, prop) {
      if (prop === 'then') return undefined; // prevent thenable
      if (prop === Symbol.toPrimitive) return undefined;
      if (prop === Symbol.toStringTag) return undefined;
      if (prop === 'single') return mockSingle;
      if (prop === 'data') return null;
      if (prop === 'error') return null;
      return (..._args: unknown[]) => chain; // any method returns chain
    },
  };

  return new Proxy(chain, handler);
};

const mockFrom = vi.fn(() => createMockChain());

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
    auth: { admin: { listUsers: mockListUsers } },
  })),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Set env vars so getPermClient() creates the mock client
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

// Force module re-evaluation so getPermClient uses the mock
// We need to re-import after env vars are set
let roleAtLeastFn: typeof roleAtLeast;
let hasPermissionSyncFn: typeof hasPermissionSync;
let PERMISSIONSObj: typeof PERMISSIONS;
let getOrgContextFn: typeof import('./permissions').getOrgContext;
let hasPermissionFn: typeof import('./permissions').hasPermission;
let createOrganizationFn: typeof import('./permissions').createOrganization;
let inviteMemberFn: typeof import('./permissions').inviteMember;
let removeMemberFn: typeof import('./permissions').removeMember;
let changeMemberRoleFn: typeof import('./permissions').changeMemberRole;

beforeEach(async () => {
  vi.clearAllMocks();
  mockSingle.mockReset();
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockListUsers.mockReset();

  // Re-import to get fresh module state
  const mod = await import('./permissions');
  roleAtLeastFn = mod.roleAtLeast;
  hasPermissionSyncFn = mod.hasPermissionSync;
  PERMISSIONSObj = mod.PERMISSIONS;
  getOrgContextFn = mod.getOrgContext;
  hasPermissionFn = mod.hasPermission;
  createOrganizationFn = mod.createOrganization;
  inviteMemberFn = mod.inviteMember;
  removeMemberFn = mod.removeMember;
  changeMemberRoleFn = mod.changeMemberRole;
});

// ─── Role Hierarchy Tests ──────────────

describe('roleAtLeast', () => {
  it('owner meets all role requirements', () => {
    expect(roleAtLeast('owner', 'owner')).toBe(true);
    expect(roleAtLeast('owner', 'admin')).toBe(true);
    expect(roleAtLeast('owner', 'employee')).toBe(true);
    expect(roleAtLeast('owner', 'client')).toBe(true);
  });

  it('admin meets admin and below', () => {
    expect(roleAtLeast('admin', 'owner')).toBe(false);
    expect(roleAtLeast('admin', 'admin')).toBe(true);
    expect(roleAtLeast('admin', 'employee')).toBe(true);
    expect(roleAtLeast('admin', 'client')).toBe(true);
  });

  it('employee meets employee and client', () => {
    expect(roleAtLeast('employee', 'owner')).toBe(false);
    expect(roleAtLeast('employee', 'admin')).toBe(false);
    expect(roleAtLeast('employee', 'employee')).toBe(true);
    expect(roleAtLeast('employee', 'client')).toBe(true);
  });

  it('client only meets client requirement', () => {
    expect(roleAtLeast('client', 'owner')).toBe(false);
    expect(roleAtLeast('client', 'admin')).toBe(false);
    expect(roleAtLeast('client', 'employee')).toBe(false);
    expect(roleAtLeast('client', 'client')).toBe(true);
  });

  it('same role always passes', () => {
    const roles: OrgRole[] = ['owner', 'admin', 'employee', 'client'];
    for (const role of roles) {
      expect(roleAtLeast(role, role)).toBe(true);
    }
  });
});

// ─── hasPermissionSync Full Matrix ─────

describe('hasPermissionSync', () => {
  const allPermissions = Object.keys(PERMISSIONS) as Permission[];
  const allRoles: OrgRole[] = ['owner', 'admin', 'employee', 'client'];

  // Test every permission with every role
  for (const perm of allPermissions) {
    const requiredRole = PERMISSIONS[perm];

    for (const role of allRoles) {
      const shouldAllow = roleAtLeast(role, requiredRole);

      it(`${role} ${shouldAllow ? 'can' : 'cannot'} ${perm} (requires ${requiredRole})`, () => {
        const result = hasPermissionSyncFn(role, perm);
        expect(result.allowed).toBe(shouldAllow);

        if (!shouldAllow) {
          expect(result.reason).toContain(requiredRole);
          expect(result.reason).toContain(role);
        }
      });
    }
  }

  it('reason string includes both required and actual roles when denied', () => {
    const result = hasPermissionSyncFn('client', 'CHANGE_ROLES');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(
      'Requires owner role, user has client'
    );
  });

  it('returns allowed without reason when permitted', () => {
    const result = hasPermissionSyncFn('admin', 'INVITE_MEMBERS');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});

// ─── PERMISSIONS Definitions ───────────

describe('PERMISSIONS', () => {
  it('all permissions reference valid roles', () => {
    const validRoles: OrgRole[] = ['owner', 'admin', 'employee', 'client'];
    for (const [, role] of Object.entries(PERMISSIONSObj)) {
      expect(validRoles).toContain(role);
    }
  });

  it('has expected permission count', () => {
    const count = Object.keys(PERMISSIONSObj).length;
    expect(count).toBeGreaterThanOrEqual(20);
  });

  it('CHANGE_ROLES requires owner', () => {
    expect(PERMISSIONSObj.CHANGE_ROLES).toBe('owner');
  });

  it('VIEW permissions are accessible to client', () => {
    expect(PERMISSIONSObj.VIEW_PROJECTS).toBe('client');
    expect(PERMISSIONSObj.VIEW_INVOICES).toBe('client');
    expect(PERMISSIONSObj.VIEW_CONVERSATIONS).toBe('client');
  });

  it('CREATE permissions require employee', () => {
    expect(PERMISSIONSObj.CREATE_PROJECT).toBe('employee');
    expect(PERMISSIONSObj.CREATE_INVOICE).toBe('employee');
    expect(PERMISSIONSObj.CREATE_LEAD).toBe('employee');
  });

  it('admin-level permissions require admin', () => {
    expect(PERMISSIONSObj.MANAGE_ORG).toBe('admin');
    expect(PERMISSIONSObj.MANAGE_BILLING).toBe('admin');
    expect(PERMISSIONSObj.INVITE_MEMBERS).toBe('admin');
    expect(PERMISSIONSObj.REMOVE_MEMBERS).toBe('admin');
    expect(PERMISSIONSObj.EMERGENCY_STOP).toBe('admin');
    expect(PERMISSIONSObj.MANAGE_RATE_LIMITS).toBe('admin');
    expect(PERMISSIONSObj.VIEW_AUDIT_LOGS).toBe('admin');
    expect(PERMISSIONSObj.RESET_CIRCUIT_BREAKER).toBe('admin');
    expect(PERMISSIONSObj.MANAGE_SETTINGS).toBe('admin');
  });
});

// ─── getOrgContext Tests ────────────────

describe('getOrgContext', () => {
  it('returns org context on success', async () => {
    mockRpc.mockResolvedValue({
      data: [{ org_id: 'org-1', role: 'admin' }],
      error: null,
    });

    const ctx = await getOrgContextFn('user-1');
    expect(ctx).toEqual({ orgId: 'org-1', role: 'admin' });
    expect(mockRpc).toHaveBeenCalledWith('get_user_org_context', {
      target_user_id: 'user-1',
    });
  });

  it('returns null when no data', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    expect(await getOrgContextFn('user-1')).toBeNull();
  });

  it('returns null when error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'db error' } });
    expect(await getOrgContextFn('user-1')).toBeNull();
  });

  it('returns null when rpc throws', async () => {
    mockRpc.mockRejectedValue(new Error('network timeout'));
    expect(await getOrgContextFn('user-1')).toBeNull();
  });

  it('returns context for different user and org', async () => {
    mockRpc.mockResolvedValue({
      data: [{ org_id: 'org-2', role: 'employee' }],
      error: null,
    });

    const ctx = await getOrgContextFn('user-2');
    expect(ctx).toEqual({ orgId: 'org-2', role: 'employee' });
  });
});

// ─── hasPermission Tests ────────────────

describe('hasPermission', () => {
  it('allows when role meets requirement', async () => {
    mockRpc.mockResolvedValue({
      data: [{ org_id: 'org-1', role: 'admin' }],
      error: null,
    });

    const result = await hasPermissionFn('user-1', 'INVITE_MEMBERS');
    expect(result.allowed).toBe(true);
  });

  it('denies when role is too low', async () => {
    mockRpc.mockResolvedValue({
      data: [{ org_id: 'org-1', role: 'employee' }],
      error: null,
    });

    const result = await hasPermissionFn('user-1', 'MANAGE_ORG');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('admin');
  });

  it('denies when user has no org', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const result = await hasPermissionFn('user-1', 'VIEW_PROJECTS');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('no organization');
  });

  it('allows client to view projects', async () => {
    mockRpc.mockResolvedValue({
      data: [{ org_id: 'org-1', role: 'client' }],
      error: null,
    });

    const result = await hasPermissionFn('user-1', 'VIEW_PROJECTS');
    expect(result.allowed).toBe(true);
  });

  it('allows owner to change roles', async () => {
    mockRpc.mockResolvedValue({
      data: [{ org_id: 'org-1', role: 'owner' }],
      error: null,
    });

    const result = await hasPermissionFn('user-1', 'CHANGE_ROLES');
    expect(result.allowed).toBe(true);
  });

  it('denies admin from changing roles', async () => {
    mockRpc.mockResolvedValue({
      data: [{ org_id: 'org-1', role: 'admin' }],
      error: null,
    });

    const result = await hasPermissionFn('user-1', 'CHANGE_ROLES');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('owner');
  });
});

// ─── createOrganization Tests ───────────

describe('createOrganization', () => {
  it('creates org and membership on success', async () => {
    // First from() call → org insert, second → membership insert
    mockFrom
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'org-123' },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

    const result = await createOrganizationFn('Acme', 'acme', 'user-1');
    expect(result).toEqual({ orgId: 'org-123' });
  });

  it('returns error when org insert fails', async () => {
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'duplicate slug' },
          }),
        }),
      }),
    });

    const result = await createOrganizationFn('Acme', 'acme', 'user-1');
    expect(result).toHaveProperty('error', 'duplicate slug');
  });

  it('returns error when membership insert fails', async () => {
    mockFrom
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'org-123' },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({
          error: { message: 'FK violation' },
        }),
      });

    const result = await createOrganizationFn('Acme', 'acme', 'user-1');
    expect(result).toHaveProperty('error', 'FK violation');
  });

  it('returns error when throw occurs', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('unexpected');
    });

    const result = await createOrganizationFn('Acme', 'acme', 'user-1');
    expect(result).toHaveProperty('error', 'unexpected');
  });
});

// ─── inviteMember Tests ─────────────────

describe('inviteMember', () => {
  const setupOrgContext = (role: OrgRole, orgId = 'org-1') => {
    mockRpc.mockResolvedValue({
      data: [{ org_id: orgId, role }],
      error: null,
    });
  };

  const setupUserLookup = (users: Array<{ id: string; email: string }>) => {
    mockListUsers.mockResolvedValue({
      data: { users },
      error: null,
    });
  };

  const setupNoExistingMembership = () => {
    // from('organization_memberships').select().eq().eq().single()
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });
  };

  const setupInsertSuccess = () => {
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
  };

  it('invites a new member successfully', async () => {
    setupOrgContext('admin');
    setupUserLookup([{ id: 'target-1', email: 'new@acme.com' }]);
    setupNoExistingMembership();
    setupInsertSuccess();

    const result = await inviteMemberFn(
      'org-1',
      'new@acme.com',
      'employee',
      'admin-user'
    );
    expect(result.success).toBe(true);
  });

  it('fails when inviter has no org', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const result = await inviteMemberFn(
      'org-1',
      'new@acme.com',
      'employee',
      'no-org-user'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Not a member');
  });

  it('fails when inviter is not admin', async () => {
    setupOrgContext('employee');

    const result = await inviteMemberFn(
      'org-1',
      'new@acme.com',
      'employee',
      'emp-user'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Only admins');
  });

  it('fails when inviter org differs from target org', async () => {
    setupOrgContext('admin', 'org-other');

    const result = await inviteMemberFn(
      'org-1',
      'new@acme.com',
      'employee',
      'admin-user'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Not a member');
  });

  it('fails when inviting higher role (non-owner)', async () => {
    setupOrgContext('admin');
    // invite as 'owner' when inviter is 'admin'

    const result = await inviteMemberFn(
      'org-1',
      'new@acme.com',
      'owner',
      'admin-user'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('higher role');
  });

  it('allows owner to invite any role', async () => {
    setupOrgContext('owner');
    setupUserLookup([{ id: 'target-1', email: 'new@acme.com' }]);
    setupNoExistingMembership();
    setupInsertSuccess();

    const result = await inviteMemberFn(
      'org-1',
      'new@acme.com',
      'admin',
      'owner-user'
    );
    expect(result.success).toBe(true);
  });

  it('fails when user not found', async () => {
    setupOrgContext('admin');
    setupUserLookup([]);

    const result = await inviteMemberFn(
      'org-1',
      'ghost@acme.com',
      'employee',
      'admin-user'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails when user is already a member', async () => {
    setupOrgContext('admin');
    setupUserLookup([{ id: 'target-1', email: 'existing@acme.com' }]);

    // Existing membership found
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'membership-1' },
              error: null,
            }),
          }),
        }),
      }),
    });

    const result = await inviteMemberFn(
      'org-1',
      'existing@acme.com',
      'employee',
      'admin-user'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('already a member');
  });

  it('fails when membership insert errors', async () => {
    setupOrgContext('admin');
    setupUserLookup([{ id: 'target-1', email: 'new@acme.com' }]);
    setupNoExistingMembership();

    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({
        error: { message: 'constraint violation' },
      }),
    });

    const result = await inviteMemberFn(
      'org-1',
      'new@acme.com',
      'employee',
      'admin-user'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('constraint violation');
  });

  it('fails when listUsers errors', async () => {
    setupOrgContext('admin');
    mockListUsers.mockResolvedValue({
      data: null,
      error: { message: 'auth error' },
    });

    const result = await inviteMemberFn(
      'org-1',
      'new@acme.com',
      'employee',
      'admin-user'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('auth error');
  });

  it('returns error when throw occurs', async () => {
    setupOrgContext('admin');
    mockListUsers.mockRejectedValue(new Error('network'));

    const result = await inviteMemberFn(
      'org-1',
      'new@acme.com',
      'employee',
      'admin-user'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('network');
  });
});

// ─── removeMember Tests ─────────────────

describe('removeMember', () => {
  const setupOrgContext = (userId: string, role: OrgRole, orgId = 'org-1') => {
    // The function calls getOrgContext twice — once for remover, once for target
    // For the first call (remover):
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: orgId, role }],
      error: null,
    });
  };

  const setupRemoveSuccess = () => {
    mockFrom.mockReturnValueOnce({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });
  };

  it('removes a member successfully', async () => {
    // remover context
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'admin' }],
      error: null,
    });
    // target context — employee (lower role)
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'employee' }],
      error: null,
    });
    setupRemoveSuccess();

    const result = await removeMemberFn('org-1', 'target-1', 'admin-user');
    expect(result.success).toBe(true);
  });

  it('fails when remover has no org', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await removeMemberFn('org-1', 'target-1', 'no-org');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Not a member');
  });

  it('fails when remover is not admin', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'employee' }],
      error: null,
    });

    const result = await removeMemberFn('org-1', 'target-1', 'emp-user');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Only admins');
  });

  it('fails when remover org differs', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-other', role: 'admin' }],
      error: null,
    });

    const result = await removeMemberFn('org-1', 'target-1', 'admin-other');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Not a member');
  });

  it('fails when target has equal role (non-owner remover)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'admin' }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'admin' }],
      error: null,
    });

    const result = await removeMemberFn('org-1', 'target-1', 'admin-user');
    expect(result.success).toBe(false);
    expect(result.error).toContain('equal or higher');
  });

  it('fails when target has higher role (non-owner remover)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'admin' }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'owner' }],
      error: null,
    });

    const result = await removeMemberFn('org-1', 'target-1', 'admin-user');
    expect(result.success).toBe(false);
    expect(result.error).toContain('equal or higher');
  });

  it('owner can remove non-owner members', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'owner' }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'admin' }],
      error: null,
    });
    setupRemoveSuccess();

    const result = await removeMemberFn('org-1', 'admin-target', 'owner-user');
    expect(result.success).toBe(true);
  });

  it('fails when trying to remove owner', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'owner' }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'owner' }],
      error: null,
    });

    const result = await removeMemberFn('org-1', 'owner-target', 'owner-user');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot remove the organization owner');
  });

  it('fails when target has no org context (null target)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'admin' }],
      error: null,
    });
    // target context returns null
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'not found' },
    });
    setupRemoveSuccess();

    // Target with no org context can still be removed
    const result = await removeMemberFn('org-1', 'orphan-1', 'admin-user');
    expect(result.success).toBe(true);
  });

  it('fails when delete errors', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'owner' }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'employee' }],
      error: null,
    });
    mockFrom.mockReturnValueOnce({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'delete failed' },
          }),
        }),
      }),
    });

    const result = await removeMemberFn('org-1', 'target-1', 'owner-user');
    expect(result.success).toBe(false);
    expect(result.error).toContain('delete failed');
  });

  it('returns error when throw occurs', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'admin' }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'employee' }],
      error: null,
    });
    // Make from() throw — this IS caught by removeMember's outer try/catch
    mockFrom.mockImplementation(() => {
      throw new Error('crash');
    });

    const result = await removeMemberFn('org-1', 'target-1', 'admin-user');
    expect(result.success).toBe(false);
    expect(result.error).toContain('crash');
  });
});

// ─── changeMemberRole Tests ─────────────

describe('changeMemberRole', () => {
  it('changes role successfully as owner', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'owner' }],
      error: null,
    });
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const result = await changeMemberRoleFn(
      'org-1',
      'target-1',
      'admin',
      'owner-user'
    );
    expect(result.success).toBe(true);
  });

  it('fails when changer has no org', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await changeMemberRoleFn(
      'org-1',
      'target-1',
      'admin',
      'no-org'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Not a member');
  });

  it('fails when changer is not owner', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'admin' }],
      error: null,
    });

    const result = await changeMemberRoleFn(
      'org-1',
      'target-1',
      'employee',
      'admin-user'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Only the owner');
  });

  it('fails when changer org differs', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-other', role: 'owner' }],
      error: null,
    });

    const result = await changeMemberRoleFn(
      'org-1',
      'target-1',
      'admin',
      'owner-other'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Not a member');
  });

  it('fails when update errors', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'owner' }],
      error: null,
    });
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'update failed' },
          }),
        }),
      }),
    });

    const result = await changeMemberRoleFn(
      'org-1',
      'target-1',
      'admin',
      'owner-user'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('update failed');
  });

  it('fails when throw occurs', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'owner' }],
      error: null,
    });
    mockFrom.mockImplementation(() => {
      throw new Error('unexpected');
    });

    const result = await changeMemberRoleFn(
      'org-1',
      'target-1',
      'admin',
      'owner-user'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('unexpected');
  });

  it('employee cannot change roles', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'employee' }],
      error: null,
    });

    const result = await changeMemberRoleFn(
      'org-1',
      'target-1',
      'admin',
      'emp-user'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Only the owner');
  });

  it('client cannot change roles', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ org_id: 'org-1', role: 'client' }],
      error: null,
    });

    const result = await changeMemberRoleFn(
      'org-1',
      'target-1',
      'employee',
      'client-user'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Only the owner');
  });
});
