import { PERMISSIONS } from '@/lib/constants/permissions';

/**
 * High-risk permission metadata (ARGUS #461).
 *
 * Every permission used to render as an identical checkbox. These keys either
 * control the permission system itself, move money, or change billing/payroll
 * configuration, so the editor groups them, badges them, and asks for an
 * explicit confirmation before adding one to a user.
 *
 * The manager-excluded keys are included because a manager cannot grant them
 * at all (`staff-authorization.grantablePermissions`); the editor must show
 * that instead of offering a checkbox that the server will reject.
 */

const REASONS: Record<string, string> = {
  [PERMISSIONS.SETTINGS.manageUsers]:
    'Can edit every team member and grant permissions - this is the permission admin key.',
  [PERMISSIONS.SETTINGS.manageSettings]:
    'Can change store-wide settings, including operational configuration.',
  [PERMISSIONS.SETTINGS.manageTax]:
    'Can change VAT/SSCL rates, which affect every sale and report.',
  [PERMISSIONS.STAFF.manageStaff]:
    'Can create, edit, deactivate and reset any staff member they outrank.',
  [PERMISSIONS.STAFF.assignPermissions]:
    'Can grant permission overrides on top of a role.',
  [PERMISSIONS.BILLING.manageBilling]:
    'Can change subscription and billing configuration.',
  [PERMISSIONS.PAYROLL.runPayroll]:
    'Can run payroll and move salary money.',
  [PERMISSIONS.PAYROLL.managePayrollSettings]:
    'Can change payroll rules, statutory rates and payout settings.',
  [PERMISSIONS.PAYMENT_ACCOUNT.closePaymentAccount]:
    'Can close a money account, removing it from operational use.',
  [PERMISSIONS.SUPPLIER.approvePurchaseOrder]:
    'Can approve purchase orders and commit supplier spend.',
  [PERMISSIONS.DELIVERY.manageCourierSettings]:
    'Can change courier integrations and merchant credentials.',
  [PERMISSIONS.DELIVERY.manageRateCard]:
    'Can change delivery pricing used on every dispatch.',
  [PERMISSIONS.DELIVERY.importRemittance]:
    'Can import remittance files that reconcile courier cash.',
  [PERMISSIONS.PROMOTION.deletePromotion]:
    'Can deactivate promotions, including live campaigns.',
  [PERMISSIONS.REPORT.viewZeroValueReport]:
    'Can read the zero-value audit ledger across the store.',
  [PERMISSIONS.PETTY_CASH.manageFundSettings]:
    'Can change petty-cash fund identity and low-balance limits.',
};

export const HIGH_RISK_PERMISSIONS: Readonly<Record<string, string>> = Object.freeze(REASONS);

export interface PermissionRiskMetadata {
  permission: string;
  highRisk: boolean;
  managerExcluded: boolean;
  reason: string | null;
}

/** Keys excluded from MANAGER defaults (mirrors permissions.ts managerExcluded). */
const MANAGER_EXCLUDED = new Set<string>([
  PERMISSIONS.PRODUCT.archiveProduct,
  PERMISSIONS.CUSTOMER.deleteCustomer,
  PERMISSIONS.PRODUCT.deleteProduct,
  PERMISSIONS.SETTINGS.manageSettings,
  PERMISSIONS.SETTINGS.manageUsers,
  PERMISSIONS.SETTINGS.manageTax,
  PERMISSIONS.SUPPLIER.approvePurchaseOrder,
  PERMISSIONS.PROMOTION.deletePromotion,
  PERMISSIONS.BILLING.manageBilling,
  PERMISSIONS.DELIVERY.manageCourierSettings,
  PERMISSIONS.DELIVERY.importRemittance,
  PERMISSIONS.DELIVERY.manageRateCard,
  PERMISSIONS.REPORT.viewZeroValueReport,
  PERMISSIONS.PETTY_CASH.manageFundSettings,
]);

export function isHighRiskPermission(permission: string): boolean {
  return Object.prototype.hasOwnProperty.call(HIGH_RISK_PERMISSIONS, permission);
}

export function isManagerExcludedPermission(permission: string): boolean {
  return MANAGER_EXCLUDED.has(permission);
}

export function getPermissionRisk(permission: string): PermissionRiskMetadata {
  return {
    permission,
    highRisk: isHighRiskPermission(permission),
    managerExcluded: isManagerExcludedPermission(permission),
    reason: HIGH_RISK_PERMISSIONS[permission] ?? null,
  };
}

/** High-risk keys in a proposed set, with their reasons. */
export function highRiskGrants(
  permissions: readonly string[],
): Array<{ permission: string; reason: string }> {
  return permissions
    .filter(isHighRiskPermission)
    .map((permission) => ({ permission, reason: HIGH_RISK_PERMISSIONS[permission]! }));
}

/**
 * High-risk keys that would be NEWLY granted (not already held), so a no-op or
 * already-held key does not ask for confirmation again.
 */
export function newHighRiskGrants(
  existingPermissions: readonly string[],
  nextPermissions: readonly string[],
): Array<{ permission: string; reason: string }> {
  const existing = new Set(existingPermissions);
  return highRiskGrants(nextPermissions).filter(({ permission }) => !existing.has(permission));
}
