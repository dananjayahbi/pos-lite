import { describe, expect, it } from 'vitest';

import { resolveCustomerEditAccess } from '@/lib/services/customerPermissions.core';

/**
 * ARGUS #314: cashiers saw Edit on the list and detail, and the sheet opened,
 * but the PATCH was 403. Edit must follow `customer:edit`, the same permission
 * the API enforces; Delete already follows `customer:delete`.
 */
describe('resolveCustomerEditAccess', () => {
  it('allows editing only when the session holds customer:edit', () => {
    expect(
      resolveCustomerEditAccess({
        permissionsLoading: false,
        hasEditPermission: true,
      }),
    ).toEqual({ canEdit: true, reason: null });
  });

  it('hides editing for a cashier without customer:edit', () => {
    expect(
      resolveCustomerEditAccess({
        permissionsLoading: false,
        hasEditPermission: false,
      }),
    ).toEqual({ canEdit: false, reason: 'forbidden' });
  });

  it('does not flash Edit while permissions are still loading', () => {
    expect(
      resolveCustomerEditAccess({
        permissionsLoading: true,
        hasEditPermission: true,
      }),
    ).toEqual({ canEdit: false, reason: 'loading' });
  });

  it('treats loading as authoritative even when the permission is absent', () => {
    expect(
      resolveCustomerEditAccess({
        permissionsLoading: true,
        hasEditPermission: false,
      }),
    ).toEqual({ canEdit: false, reason: 'loading' });
  });
});
