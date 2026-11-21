/**
 * ARGUS #402 - an aborted expense list must never look empty.
 *
 * The page only checked `isLoading`; a failed query fell through to the same
 * "No expenses found" row as a successful zero-result filter. This pure
 * classifier makes the states explicit and gives error precedence.
 */
export type ExpenseListState = 'loading' | 'error' | 'empty' | 'ready';

export interface ExpenseListStateInput {
  isError: boolean;
  isLoading: boolean;
  count: number;
}

export function resolveExpenseListState(input: ExpenseListStateInput): ExpenseListState {
  // Error wins: stale/zero rows from a failed request are not evidence of an
  // empty register.
  if (input.isError) return 'error';
  if (input.isLoading) return 'loading';
  if (input.count === 0) return 'empty';
  return 'ready';
}
