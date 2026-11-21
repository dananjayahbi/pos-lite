/**
 * Shift access scope (ARGUS #111).
 *
 * `shift:view` is granted to cashiers (the POS needs to show their own shift and
 * Z-report), so it cannot mean "may read the tenant's shift ledger". The
 * management surfaces (`/staff/shifts`, the list API, shift detail and the
 * Z-report) must instead scope non-managers to their own shift.
 *
 * - OWNER/MANAGER (or an explicit `sale:view_history` grant) → tenant-wide;
 * - any other caller with a shift capability (view/open/close) → own shift only;
 * - no shift capability → forbidden.
 *
 * Pure so the pages and routes share one decision.
 */

export type ShiftAccessScope =
  | { kind: 'tenant' }
  | { kind: 'own'; cashierId: string }
  | { kind: 'forbidden' };

export interface ShiftAccessInput {
  /** Callers need at least one shift capability (view/open/close). */
  canAccessShifts: boolean;
  role: string | null | undefined;
  canViewSaleHistory: boolean;
  userId: string;
}

const MANAGEMENT_ROLES = new Set(['OWNER', 'MANAGER', 'SUPER_ADMIN']);

/** The same audience the sidebar/nav labels as the management shift ledger. */
export function isShiftManagement(
  role: string | null | undefined,
  canViewSaleHistory: boolean,
): boolean {
  return (
    (role !== null && role !== undefined && MANAGEMENT_ROLES.has(role)) ||
    canViewSaleHistory
  );
}

export function resolveShiftAccessScope(input: ShiftAccessInput): ShiftAccessScope {
  if (!input.canAccessShifts) return { kind: 'forbidden' };
  if (isShiftManagement(input.role, input.canViewSaleHistory)) return { kind: 'tenant' };
  return { kind: 'own', cashierId: input.userId };
}

export interface ScopableShiftFilters {
  cashierId?: string | undefined;
}

/**
 * Apply the scope to list filters. A non-manager cannot widen the result by
 * passing someone else's `cashierId`; it is replaced with their own id.
 */
export function applyShiftListScope<T extends object>(
  filters: T,
  scope: Exclude<ShiftAccessScope, { kind: 'forbidden' }>,
): T & ScopableShiftFilters {
  if (scope.kind === 'tenant') return filters;
  return { ...filters, cashierId: scope.cashierId };
}

/** Whether a shift row (identified by its cashier) is visible in the scope. */
export function isShiftInAccessScope(
  scope: ShiftAccessScope,
  shiftCashierId: string,
): boolean {
  if (scope.kind === 'tenant') return true;
  if (scope.kind === 'own') return shiftCashierId === scope.cashierId;
  return false;
}
