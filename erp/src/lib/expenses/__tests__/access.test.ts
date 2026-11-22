import { describe, expect, it } from 'vitest';

import { resolveExpensePageAccess } from '@/lib/expenses/access';
import { PERMISSIONS } from '@/lib/constants/permissions';

describe('resolveExpensePageAccess (ARGUS #398)', () => {
  it('denies the Expenses page to roles without expense:view', () => {
    const access = resolveExpensePageAccess({ role: 'CASHIER' });
    expect(access).toEqual({ canView: false, canCreate: false, canApprove: false });
  });

  it('grants view, create and approve to OWNER and MANAGER by role defaults', () => {
    for (const role of ['OWNER', 'MANAGER'] as const) {
      expect(resolveExpensePageAccess({ role })).toEqual({
        canView: true,
        canCreate: true,
        canApprove: true,
      });
    }
  });

  it('honours an explicit override without leaking the other actions', () => {
    const access = resolveExpensePageAccess({
      role: 'CASHIER',
      permissions: [PERMISSIONS.EXPENSE.viewExpense],
    });
    expect(access).toEqual({ canView: true, canCreate: false, canApprove: false });
  });

  it('returns all false for a missing user', () => {
    expect(resolveExpensePageAccess(null)).toEqual({
      canView: false,
      canCreate: false,
      canApprove: false,
    });
  });
});
