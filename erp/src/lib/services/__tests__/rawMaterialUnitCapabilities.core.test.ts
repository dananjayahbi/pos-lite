import { describe, expect, it } from 'vitest';

import { unitCapabilities } from '@/lib/services/rawMaterialUnitCapabilities.core';

/**
 * ARGUS #479: the table must not offer actions the server rejects. Built-ins
 * cannot be deactivated; in-use units cannot be deleted.
 */
describe('unitCapabilities', () => {
  it('offers deactivate and delete for an unused custom active unit', () => {
    expect(unitCapabilities({ isBuiltIn: false, usageCount: 0, isActive: true })).toEqual({
      canEdit: true,
      canDeactivate: true,
      canActivate: false,
      canDelete: true,
      deactivateBlockedReason: null,
      deleteBlockedReason: null,
    });
  });

  it('never offers deactivation for a built-in, even when unused', () => {
    const cap = unitCapabilities({ isBuiltIn: true, usageCount: 0, isActive: true });
    expect(cap.canDeactivate).toBe(false);
    expect(cap.canActivate).toBe(false);
    expect(cap.canDelete).toBe(false);
    expect(cap.deactivateBlockedReason).toContain('Built-in units');
    expect(cap.deleteBlockedReason).toContain('cannot be deleted');
    expect(cap.canEdit).toBe(true);
  });

  /** ARGUS #483: the built-in guard covers deletion, not only deactivation. */
  it('never offers deletion for a built-in, even when unused', () => {
    const cap = unitCapabilities({ isBuiltIn: true, usageCount: 0, isActive: true });
    expect(cap.canDelete).toBe(false);
    expect(cap.deleteBlockedReason).not.toContain('raw material');
  });

  it('disables deletion while the unit is in use and explains what to do', () => {
    const cap = unitCapabilities({ isBuiltIn: false, usageCount: 3, isActive: true });
    expect(cap.canDelete).toBe(false);
    expect(cap.deleteBlockedReason).toBe(
      'Used by 3 raw materials. Remove or reassign them before deleting this unit.',
    );
    expect(cap.deleteBlockedReason).not.toContain('deactivate');
  });

  it('uses the singular in the in-use reason', () => {
    const cap = unitCapabilities({ isBuiltIn: false, usageCount: 1, isActive: true });
    expect(cap.deleteBlockedReason).toContain('1 raw material.');
  });

  it('offers activation for an inactive custom unit but not deactivation', () => {
    const cap = unitCapabilities({ isBuiltIn: false, usageCount: 0, isActive: false });
    expect(cap.canActivate).toBe(true);
    expect(cap.canDeactivate).toBe(false);
    expect(cap.canDelete).toBe(true);
  });

  it('offers deletion of an in-use unit only when usage reaches zero', () => {
    expect(
      unitCapabilities({ isBuiltIn: false, usageCount: 1, isActive: true }).canDelete,
    ).toBe(false);
    expect(
      unitCapabilities({ isBuiltIn: false, usageCount: 0, isActive: true }).canDelete,
    ).toBe(true);
  });
});
