import { describe, expect, it } from 'vitest';

import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  getPermissionRisk,
  highRiskGrants,
  isHighRiskPermission,
  isManagerExcludedPermission,
  newHighRiskGrants,
} from '@/lib/services/permissionRisk.core';

/** ARGUS #461: high-risk keys carry metadata and a grant confirmation. */
describe('permission risk metadata', () => {
  it('flags the permission-admin and money keys as high risk', () => {
    const highRisk = [
      PERMISSIONS.SETTINGS.manageUsers,
      PERMISSIONS.STAFF.manageStaff,
      PERMISSIONS.STAFF.assignPermissions,
      PERMISSIONS.BILLING.manageBilling,
      PERMISSIONS.PAYROLL.managePayrollSettings,
      PERMISSIONS.PAYMENT_ACCOUNT.closePaymentAccount,
    ];

    for (const permission of highRisk) {
      expect(isHighRiskPermission(permission), permission).toBe(true);
      expect(getPermissionRisk(permission).reason).toBeTruthy();
    }
  });

  it('flags manager-excluded settings/supplier/delivery keys', () => {
    const managerExcluded = [
      PERMISSIONS.SETTINGS.manageSettings,
      PERMISSIONS.SETTINGS.manageTax,
      PERMISSIONS.SUPPLIER.approvePurchaseOrder,
      PERMISSIONS.DELIVERY.manageCourierSettings,
      PERMISSIONS.DELIVERY.manageRateCard,
      PERMISSIONS.DELIVERY.importRemittance,
    ];

    for (const permission of managerExcluded) {
      expect(isManagerExcludedPermission(permission), permission).toBe(true);
      expect(isHighRiskPermission(permission), permission).toBe(true);
    }
  });

  it('leaves ordinary operational keys unbadged', () => {
    expect(isHighRiskPermission(PERMISSIONS.SALE.createSale)).toBe(false);
    expect(getPermissionRisk(PERMISSIONS.PRODUCT.viewProduct)).toEqual({
      permission: PERMISSIONS.PRODUCT.viewProduct,
      highRisk: false,
      managerExcluded: false,
      reason: null,
    });
  });

  it('summarizes newly granted high-risk keys only', () => {
    const existing = [PERMISSIONS.STAFF.manageStaff];
    const next = [
      PERMISSIONS.STAFF.manageStaff,
      PERMISSIONS.SETTINGS.manageUsers,
      PERMISSIONS.SALE.createSale,
    ];

    expect(highRiskGrants(next).map((entry) => entry.permission)).toEqual([
      PERMISSIONS.STAFF.manageStaff,
      PERMISSIONS.SETTINGS.manageUsers,
    ]);
    expect(newHighRiskGrants(existing, next).map((entry) => entry.permission)).toEqual([
      PERMISSIONS.SETTINGS.manageUsers,
    ]);
    expect(newHighRiskGrants(next, next)).toEqual([]);
  });

  it('detects high-risk keys inherited from a role promotion', () => {
    // CASHIER -> OWNER grants the whole high-risk set through the role.
    const newGrants = newHighRiskGrants(
      [PERMISSIONS.SALE.createSale, PERMISSIONS.CUSTOMER.viewCustomer],
      [
        PERMISSIONS.SALE.createSale,
        PERMISSIONS.CUSTOMER.viewCustomer,
        PERMISSIONS.SETTINGS.manageUsers,
        PERMISSIONS.STAFF.manageStaff,
      ],
    );
    expect(newGrants.map((entry) => entry.permission)).toEqual([
      PERMISSIONS.SETTINGS.manageUsers,
      PERMISSIONS.STAFF.manageStaff,
    ]);
  });
});
