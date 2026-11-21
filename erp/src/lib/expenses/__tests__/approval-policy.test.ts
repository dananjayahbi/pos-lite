import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXPENSE_APPROVAL_THRESHOLD,
  authorizeExpenseWrite,
  expenseRequiresApproval,
  resolveExpenseApprovalThreshold,
} from '@/lib/expenses/approval-policy';
import { PERMISSIONS } from '@/lib/constants/permissions';

const CREATE_ONLY = {
  role: 'CASHIER' as const,
  permissions: [PERMISSIONS.EXPENSE.createExpense],
};
const APPROVER = { role: 'MANAGER' as const };

describe('expense approval policy (ARGUS #397)', () => {
  it('defaults invalid or negative thresholds to the safe default', () => {
    expect(DEFAULT_EXPENSE_APPROVAL_THRESHOLD).toBeGreaterThan(0);
    expect(resolveExpenseApprovalThreshold(undefined)).toBe(DEFAULT_EXPENSE_APPROVAL_THRESHOLD);
    expect(resolveExpenseApprovalThreshold('')).toBe(DEFAULT_EXPENSE_APPROVAL_THRESHOLD);
    expect(resolveExpenseApprovalThreshold('not-a-number')).toBe(DEFAULT_EXPENSE_APPROVAL_THRESHOLD);
    expect(resolveExpenseApprovalThreshold(-1)).toBe(DEFAULT_EXPENSE_APPROVAL_THRESHOLD);
    expect(resolveExpenseApprovalThreshold('2500')).toBe(2500);
    expect(resolveExpenseApprovalThreshold(0)).toBe(0);
  });

  it('only treats creation above the threshold as an approval decision', () => {
    expect(expenseRequiresApproval('create', 100, 1000)).toBe(false);
    expect(expenseRequiresApproval('create', 1000, 1000)).toBe(false);
    expect(expenseRequiresApproval('create', 1000.01, 1000)).toBe(true);
    expect(expenseRequiresApproval('create', null, 1000)).toBe(false);
    expect(expenseRequiresApproval('update', 1, 1000)).toBe(true);
    expect(expenseRequiresApproval('delete', 1, 1000)).toBe(true);
  });

  it('lets a create-only actor post at or below the threshold', () => {
    const decision = authorizeExpenseWrite({
      user: CREATE_ONLY,
      action: 'create',
      amount: 1000,
      threshold: 1000,
    });
    expect(decision).toEqual({ requiresApproval: false, allowed: true, reason: null });
  });

  it('blocks a create-only actor above the threshold with a stable reason', () => {
    const decision = authorizeExpenseWrite({
      user: CREATE_ONLY,
      action: 'create',
      amount: 1000.01,
      threshold: 1000,
    });
    expect(decision.requiresApproval).toBe(true);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Expenses above Rs 1,000 require manager approval');
  });

  it('always blocks edits and deletes without expense:approve', () => {
    for (const action of ['update', 'delete'] as const) {
      const decision = authorizeExpenseWrite({
        user: CREATE_ONLY,
        action,
        amount: 1,
        threshold: 100_000,
      });
      expect(decision).toEqual({
        requiresApproval: true,
        allowed: false,
        reason: 'Editing or deleting an expense requires manager approval',
      });
    }
  });

  it('allows an approver through every write gate', () => {
    for (const action of ['create', 'update', 'delete'] as const) {
      expect(
        authorizeExpenseWrite({
          user: APPROVER,
          action,
          amount: 1_000_000,
          threshold: 1000,
        }).allowed,
      ).toBe(true);
    }
  });

  it('does not grant an unauthenticated actor an edit or delete', () => {
    // Creation itself is gated by expense:create at the route; this policy only
    // adds the value gate, so it deliberately returns allowed for a small create.
    expect(
      authorizeExpenseWrite({ user: null, action: 'create', amount: 10, threshold: 1000 })
        .allowed,
    ).toBe(true);
    expect(
      authorizeExpenseWrite({ user: null, action: 'delete', amount: 10 }).allowed,
    ).toBe(false);
  });
});
