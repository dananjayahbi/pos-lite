import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { canViewCommissionReports } from '@/lib/services/commission-report-access.core';

describe('canViewCommissionReports', () => {
  it('allows owner and manager (staff view/manage defaults)', () => {
    expect(canViewCommissionReports({ role: 'OWNER' })).toBe(true);
    expect(canViewCommissionReports({ role: 'MANAGER' })).toBe(true);
  });

  it('denies cashier, the role that currently gets a 403 from the APIs', () => {
    expect(canViewCommissionReports({ role: 'CASHIER' })).toBe(false);
  });

  it('honours explicit staff permission overrides', () => {
    expect(
      canViewCommissionReports({
        role: 'CASHIER',
        permissions: [PERMISSIONS.STAFF.viewStaff],
      }),
    ).toBe(true);
  });

  it('denies missing sessions', () => {
    expect(canViewCommissionReports(null)).toBe(false);
    expect(canViewCommissionReports(undefined)).toBe(false);
  });
});
