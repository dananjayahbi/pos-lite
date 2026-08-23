import { describe, it, expect } from 'vitest';
import {
  getEffectivePermissions,
  PERMISSIONS,
  ALL_PERMISSIONS,
} from '@/lib/constants/permissions';
import { requirePermissionResponse } from '@/lib/api/permission-guard';

describe('SUPER_ADMIN store-context permissions (doc 48)', () => {
  it('grants full store access when acting in a tenant (even with empty stored perms)', () => {
    const permissions = getEffectivePermissions('SUPER_ADMIN', []);
    expect(permissions).toEqual(ALL_PERMISSIONS);
    expect(permissions).toContain(PERMISSIONS.REPORT.viewSalesReport);
    expect(permissions).toContain(PERMISSIONS.REPORT.viewProfitReport);
    expect(permissions).toContain(PERMISSIONS.SETTINGS.viewAuditLog);
  });

  it('still grants full access regardless of stored permission array', () => {
    const permissions = getEffectivePermissions('SUPER_ADMIN', ['some:legacy:key']);
    expect(permissions).toEqual(ALL_PERMISSIONS);
  });

  it('preserves the stored-permissions path for non-SUPER_ADMIN roles', () => {
    const permissions = getEffectivePermissions('CASHIER', []);
    expect(permissions).not.toEqual(ALL_PERMISSIONS);
    expect(permissions).toContain(PERMISSIONS.SALE.createSale);
    expect(permissions).not.toContain(PERMISSIONS.REPORT.viewSalesReport);
  });
});

describe('New security permission keys', () => {
  it('exposes viewCustomerReport in the REPORT group', () => {
    expect(ALL_PERMISSIONS).toContain(PERMISSIONS.REPORT.viewCustomerReport);
  });

  it('exposes viewAuditLog in the SETTINGS group', () => {
    expect(ALL_PERMISSIONS).toContain(PERMISSIONS.SETTINGS.viewAuditLog);
  });
});

describe('requirePermissionResponse (doc 46/49 guard)', () => {
  it('returns null when the user has the permission', () => {
    const result = requirePermissionResponse(
      { permissions: [PERMISSIONS.REPORT.viewSalesReport] },
      PERMISSIONS.REPORT.viewSalesReport,
    );
    expect(result).toBeNull();
  });

  it('returns a 403 response when the user lacks the permission', () => {
    const result = requirePermissionResponse(
      { permissions: [PERMISSIONS.DELIVERY.viewDelivery] },
      PERMISSIONS.REPORT.viewProfitReport,
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it('denies an unauthenticated (null) user', () => {
    const result = requirePermissionResponse(null, PERMISSIONS.REPORT.viewSalesReport);
    expect(result!.status).toBe(403);
  });
});
