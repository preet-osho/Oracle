// ═══════════════════════════════════════
// ORACLE — Permissions Library Tests
// ═══════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { roleAtLeast, hasPermissionSync, PERMISSIONS, type OrgRole } from './permissions';

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
});

// ─── hasPermissionSync Tests ───────────

describe('hasPermissionSync', () => {
  it('allows owner to manage org', () => {
    const result = hasPermissionSync('owner', 'MANAGE_ORG');
    expect(result.allowed).toBe(true);
  });

  it('denies employee from managing org', () => {
    const result = hasPermissionSync('employee', 'MANAGE_ORG');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('admin');
  });

  it('allows admin to invite members', () => {
    const result = hasPermissionSync('admin', 'INVITE_MEMBERS');
    expect(result.allowed).toBe(true);
  });

  it('denies employee from inviting members', () => {
    const result = hasPermissionSync('employee', 'INVITE_MEMBERS');
    expect(result.allowed).toBe(false);
  });

  it('allows owner to change roles', () => {
    const result = hasPermissionSync('owner', 'CHANGE_ROLES');
    expect(result.allowed).toBe(true);
  });

  it('denies admin from changing roles', () => {
    const result = hasPermissionSync('admin', 'CHANGE_ROLES');
    expect(result.allowed).toBe(false);
  });

  it('allows client to view projects', () => {
    const result = hasPermissionSync('client', 'VIEW_PROJECTS');
    expect(result.allowed).toBe(true);
  });

  it('denies client from creating projects', () => {
    const result = hasPermissionSync('client', 'CREATE_PROJECT');
    expect(result.allowed).toBe(false);
  });

  it('allows employee to use AI chat', () => {
    const result = hasPermissionSync('employee', 'USE_AI_CHAT');
    expect(result.allowed).toBe(true);
  });

  it('denies client from using AI chat', () => {
    const result = hasPermissionSync('client', 'USE_AI_CHAT');
    expect(result.allowed).toBe(false);
  });

  it('allows admin to view audit logs', () => {
    const result = hasPermissionSync('admin', 'VIEW_AUDIT_LOGS');
    expect(result.allowed).toBe(true);
  });

  it('denies employee from viewing audit logs', () => {
    const result = hasPermissionSync('employee', 'VIEW_AUDIT_LOGS');
    expect(result.allowed).toBe(false);
  });

  it('allows owner to manage settings', () => {
    const result = hasPermissionSync('owner', 'MANAGE_SETTINGS');
    expect(result.allowed).toBe(true);
  });

  it('denies employee from managing settings', () => {
    const result = hasPermissionSync('employee', 'MANAGE_SETTINGS');
    expect(result.allowed).toBe(false);
  });
});

// ─── Permission Definitions Tests ──────

describe('PERMISSIONS', () => {
  it('all permissions reference valid roles', () => {
    const validRoles: OrgRole[] = ['owner', 'admin', 'employee', 'client'];
    for (const [, role] of Object.entries(PERMISSIONS)) {
      expect(validRoles).toContain(role);
    }
  });

  it('has expected permission count', () => {
    const count = Object.keys(PERMISSIONS).length;
    expect(count).toBeGreaterThanOrEqual(20);
  });
});
