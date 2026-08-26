import { describe, it, expect } from 'vitest';
import {
  getEffectivePermissions,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from '@/lib/constants/permissions';

describe('FACTORY_MANAGER role mapping', () => {
  it('is a known assignable role in ROLE_PERMISSIONS', () => {
    expect(Array.isArray(ROLE_PERMISSIONS.FACTORY_MANAGER)).toBe(true);
    expect(ROLE_PERMISSIONS.FACTORY_MANAGER.length).toBeGreaterThan(0);
  });

  it('grants the factory dashboard permission', () => {
    expect(ROLE_PERMISSIONS.FACTORY_MANAGER).toContain(
      PERMISSIONS.FACTORY.viewFactoryDashboard,
    );
  });

  it('grants all raw material permissions', () => {
    const keys = Object.values(PERMISSIONS.RAW_MATERIAL);
    for (const key of keys) {
      expect(ROLE_PERMISSIONS.FACTORY_MANAGER).toContain(key);
    }
  });

  it('grants product view for finished-goods visibility', () => {
    expect(ROLE_PERMISSIONS.FACTORY_MANAGER).toContain(PERMISSIONS.PRODUCT.viewProduct);
  });

  it('does not grant office-only permissions (e.g. manage users)', () => {
    expect(ROLE_PERMISSIONS.FACTORY_MANAGER).not.toContain(PERMISSIONS.SETTINGS.manageUsers);
    expect(ROLE_PERMISSIONS.FACTORY_MANAGER).not.toContain(PERMISSIONS.BILLING.manageBilling);
  });

  it('explicitly excludes financial/report permissions', () => {
    expect(ROLE_PERMISSIONS.FACTORY_MANAGER).not.toContain(PERMISSIONS.REPORT.viewSalesReport);
    expect(ROLE_PERMISSIONS.FACTORY_MANAGER).not.toContain(PERMISSIONS.REPORT.viewProfitReport);
    expect(ROLE_PERMISSIONS.FACTORY_MANAGER).not.toContain(PERMISSIONS.EXPENSE.viewExpense);
  });

  it('explicitly excludes sales-order and POS permissions', () => {
    expect(ROLE_PERMISSIONS.FACTORY_MANAGER).not.toContain(PERMISSIONS.SALE.viewSale);
    expect(ROLE_PERMISSIONS.FACTORY_MANAGER).not.toContain(PERMISSIONS.SALE.createSale);
  });

  it('explicitly excludes CRM permissions', () => {
    expect(ROLE_PERMISSIONS.FACTORY_MANAGER).not.toContain(PERMISSIONS.CUSTOMER.viewCustomer);
    expect(ROLE_PERMISSIONS.FACTORY_MANAGER).not.toContain(PERMISSIONS.CUSTOMER.editCustomer);
    expect(ROLE_PERMISSIONS.FACTORY_MANAGER).not.toContain(PERMISSIONS.CUSTOMER.viewCustomerBalance);
  });

  it('getEffectivePermissions returns factory defaults for a FACTORY_MANAGER with no custom perms', () => {
    const permissions = getEffectivePermissions('FACTORY_MANAGER', []);
    expect(permissions).toContain(PERMISSIONS.RAW_MATERIAL.viewRawMaterial);
    expect(permissions).toContain(PERMISSIONS.FACTORY.viewFactoryDashboard);
  });
});
