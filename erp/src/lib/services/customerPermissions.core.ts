/**
 * Customer edit affordance (ARGUS #314).
 *
 * The customer list and detail rendered an Edit action for every signed-in
 * user, and the edit sheet opened, but `PATCH /api/store/customers/[id]`
 * requires `customer:edit` - which CASHIER does not hold. The server was
 * correct; the UI advertised an action the API would reject with 403.
 *
 * Both pages derive the affordance from this one helper so the list pencil, the
 * detail Edit button and the edit sheet cannot drift from the API permission.
 * Delete already followed this rule (`customer:delete`).
 */

export interface CustomerEditAccessInput {
  /** Permissions are still loading from the session. */
  permissionsLoading: boolean;
  /** Whether the session holds `customer:edit`. */
  hasEditPermission: boolean;
}

export interface CustomerEditAccess {
  canEdit: boolean;
  /** Why edit is unavailable, for copy/tests; null when it is available. */
  reason: 'loading' | 'forbidden' | null;
}

export function resolveCustomerEditAccess(
  input: CustomerEditAccessInput,
): CustomerEditAccess {
  if (input.permissionsLoading) {
    return { canEdit: false, reason: 'loading' };
  }
  if (!input.hasEditPermission) {
    return { canEdit: false, reason: 'forbidden' };
  }
  return { canEdit: true, reason: null };
}
