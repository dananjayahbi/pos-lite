import { describe, expect, it } from 'vitest';

import { resolveExpenseListState } from '@/lib/expenses/list-state';

describe('expense list state (ARGUS #402)', () => {
  it('reports loading before a result exists', () => {
    expect(resolveExpenseListState({ isError: false, isLoading: true, count: 0 })).toBe(
      'loading',
    );
  });

  it('reports empty only for a successful zero-row result', () => {
    expect(resolveExpenseListState({ isError: false, isLoading: false, count: 0 })).toBe(
      'empty',
    );
  });

  it('reports ready when rows are present', () => {
    expect(resolveExpenseListState({ isError: false, isLoading: false, count: 3 })).toBe(
      'ready',
    );
  });

  it('lets an error win over an empty or stale list', () => {
    expect(resolveExpenseListState({ isError: true, isLoading: false, count: 0 })).toBe(
      'error',
    );
    expect(resolveExpenseListState({ isError: true, isLoading: true, count: 0 })).toBe(
      'error',
    );
    expect(resolveExpenseListState({ isError: true, isLoading: false, count: 2 })).toBe(
      'error',
    );
  });
});
