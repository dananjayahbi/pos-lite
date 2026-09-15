/**
 * M03-01 (BUG-3) — the UI↔API role-enum contract, enforced at build time:
 * every assignable role appears in exactly ONE shared constant, and the
 * validator accepts everything the dropdowns can offer.
 */
import { describe, expect, it } from 'vitest';
import { ASSIGNABLE_ROLES, ROLE_PERMISSIONS, type AssignableRole } from '@/lib/constants/permissions';
import { CreateStaffSchema, UpdateStaffSchema } from '@/lib/validators/staff.validators';

describe('assignable-role single source of truth', () => {
  it('ASSIGNABLE_ROLES === keys of ROLE_PERMISSIONS (matrix covers every offered role)', () => {
    expect([...ASSIGNABLE_ROLES].sort()).toEqual(Object.keys(ROLE_PERMISSIONS).sort());
  });

  it('SUPER_ADMIN is never assignable (escalation guard)', () => {
    expect(ASSIGNABLE_ROLES).not.toContain('SUPER_ADMIN');
  });

  it('DISPATCH_STAFF is assignable (the BUG-3 casualty)', () => {
    expect(ASSIGNABLE_ROLES).toContain('DISPATCH_STAFF');
  });

  it('CreateStaffSchema accepts every assignable role', () => {
    for (const role of ASSIGNABLE_ROLES) {
      const parsed = CreateStaffSchema.safeParse({
        email: 'qa@example.com',
        role,
      });
      expect(parsed.success, `role ${role} must validate`).toBe(true);
    }
  });

  it('UpdateStaffSchema accepts every assignable role and rejects SUPER_ADMIN', () => {
    for (const role of ASSIGNABLE_ROLES) {
      expect(
        UpdateStaffSchema.safeParse({ role }).success,
        `PATCH role ${role} must validate`,
      ).toBe(true);
    }
    expect(UpdateStaffSchema.safeParse({ role: 'SUPER_ADMIN' }).success).toBe(false);
    expect(CreateStaffSchema.safeParse({ email: 'a@b.c', role: 'SUPER_ADMIN' }).success).toBe(false);
  });

  it('every assignable role has a non-empty permission matrix', () => {
    for (const role of ASSIGNABLE_ROLES as AssignableRole[]) {
      expect(ROLE_PERMISSIONS[role].length, `${role} matrix`).toBeGreaterThan(0);
    }
  });
});
