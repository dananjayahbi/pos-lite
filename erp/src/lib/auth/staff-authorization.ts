import { ALL_PERMISSIONS, ROLE_PERMISSIONS, type AssignableRole } from '@/lib/constants/permissions';

const MANAGEMENT_ROLES = new Set<string>(['OWNER', 'MANAGER', 'SUPER_ADMIN']);
const NON_MANAGEMENT_ROLES: AssignableRole[] = [
  'CASHIER',
  'STOCK_CLERK',
  'DISPATCH_STAFF',
  'FACTORY_MANAGER',
];

/**
 * Role hierarchy for tenant staff administration (ARGUS #335).
 *
 * A manager holds `staff:manage`, but that must not let them create, edit,
 * deactivate or reset an OWNER (or another manager) - otherwise they can mint a
 * known-password owner and take over the tenant. Only an OWNER may assign
 * OWNER; managers may administer operational roles only.
 */
export function canManageStaffRole(actorRole: string, targetRole: string): boolean {
  if (actorRole === 'SUPER_ADMIN') return true;
  if (actorRole === 'OWNER') return targetRole !== 'SUPER_ADMIN';
  if (actorRole === 'MANAGER') return !MANAGEMENT_ROLES.has(targetRole);
  return false;
}

export function canAssignRole(actorRole: string, role: string): boolean {
  if (role === 'OWNER') return actorRole === 'OWNER' || actorRole === 'SUPER_ADMIN';
  if (actorRole === 'OWNER' || actorRole === 'SUPER_ADMIN') return true;
  if (actorRole === 'MANAGER') return NON_MANAGEMENT_ROLES.includes(role as AssignableRole);
  return false;
}

/** Permissions the actor may hand out. Managers may only grant what they hold. */
export function grantablePermissions(actorRole: string): Set<string> {
  if (actorRole === 'OWNER' || actorRole === 'SUPER_ADMIN') return new Set(ALL_PERMISSIONS);
  if (actorRole === 'MANAGER') return new Set(ROLE_PERMISSIONS.MANAGER);
  return new Set();
}

export function canResetStaffPassword(actorRole: string, targetRole: string): boolean {
  if (actorRole === 'SUPER_ADMIN') return true;
  if (actorRole === 'OWNER') return targetRole !== 'SUPER_ADMIN';
  if (actorRole === 'MANAGER') return !MANAGEMENT_ROLES.has(targetRole);
  return false;
}

/**
 * Reject a permission grant containing any key the actor cannot grant
 * (`PERMISSION_NOT_GRANTABLE`).
 */
export function assertPermissionsGrantable(actorRole: string, permissions: string[]): void {
  const allowed = grantablePermissions(actorRole);
  const denied = permissions.find((permission) => !allowed.has(permission));
  if (denied) {
    throw new Error(`PERMISSION_NOT_GRANTABLE: ${denied}`);
  }
}

/**
 * A tenant must always keep at least one active OWNER. Rejects a change that
 * would demote/deactivate the last one (`LAST_OWNER_REQUIRED`).
 */
export function assertLastOwnerRemains(input: {
  existingRole: string;
  existingIsActive: boolean;
  nextRole?: string | undefined;
  nextIsActive?: boolean | undefined;
  otherActiveOwners: number;
}): void {
  const nextRole = input.nextRole ?? input.existingRole;
  const nextIsActive = input.nextIsActive ?? input.existingIsActive;
  const remainsActiveOwner = nextRole === 'OWNER' && nextIsActive;
  if (!remainsActiveOwner && input.existingRole === 'OWNER' && input.otherActiveOwners === 0) {
    throw new Error('LAST_OWNER_REQUIRED');
  }
}
