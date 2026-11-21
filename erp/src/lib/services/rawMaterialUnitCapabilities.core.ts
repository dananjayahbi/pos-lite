/**
 * Raw-material unit action capabilities (ARGUS #479).
 *
 * The Units table offered Deactivate and Delete on every row, but the server
 * rejects deactivating a built-in unit (`BUILT_IN_UNIT`, 400) and deleting a
 * unit referenced by raw materials (`UNIT_IN_USE`, 409). The delete dialog then
 * advised "deactivate them instead", which is impossible for the built-ins that
 * caused the failure. These rules are pure so the table, dialog copy and tests
 * agree with the server guards.
 */

export interface UnitCapabilityInput {
  isBuiltIn: boolean;
  usageCount: number;
  isActive: boolean;
}

export interface UnitCapabilities {
  /** Rename/short-label edits are allowed for built-ins too. */
  canEdit: boolean;
  canDeactivate: boolean;
  canActivate: boolean;
  canDelete: boolean;
  /** Why deactivation is unavailable, or null when it is available. */
  deactivateBlockedReason: string | null;
  /** Why deletion is unavailable, or null when it is available. */
  deleteBlockedReason: string | null;
}

export function unitCapabilities(input: UnitCapabilityInput): UnitCapabilities {
  const canDeactivate = !input.isBuiltIn && input.isActive;
  const canActivate = !input.isActive;
  const canDelete = input.usageCount <= 0;

  return {
    canEdit: true,
    canDeactivate,
    canActivate,
    canDelete,
    deactivateBlockedReason: input.isBuiltIn
      ? 'Built-in units are the default choices for new tenants and cannot be deactivated.'
      : null,
    deleteBlockedReason: canDelete
      ? null
      : `Used by ${input.usageCount} raw material${input.usageCount === 1 ? '' : 's'}. Remove or reassign them before deleting this unit.`,
  };
}
