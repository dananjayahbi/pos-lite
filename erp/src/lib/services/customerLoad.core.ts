/**
 * Customer page load states (ARGUS #313).
 *
 * A failed `GET /api/store/customers` request used to fall through to the
 * genuine "No customers found" empty table, and every detail failure (403, 404
 * or 500) rendered the same "Customer not found" screen. Operators could not
 * tell an outage or permission problem from an empty directory or a deleted
 * customer, and the list offered no retry.
 *
 * The state resolvers keep those cases separate and put the error state ahead
 * of any stale cached rows. The pages render exactly one state.
 */

export type CustomerListState = 'loading' | 'error' | 'empty' | 'ready';

export interface CustomerListStateInput {
  isLoading: boolean;
  isError: boolean;
  /** Row count from the last successful response, if any. */
  customerCount: number;
}

export function resolveCustomerListState(
  input: CustomerListStateInput,
): CustomerListState {
  // A failed request must never be presented as a successful empty result,
  // even when React Query still holds rows from an earlier page.
  if (input.isError) return 'error';
  if (input.isLoading) return 'loading';
  return input.customerCount === 0 ? 'empty' : 'ready';
}

export type CustomerDetailState = 'loading' | 'not-found' | 'error' | 'ready';

export interface CustomerDetailStateInput {
  isLoading: boolean;
  isError: boolean;
  /** HTTP status of the failed request, when it is known. */
  errorStatus: number | null;
  hasCustomer: boolean;
}

export function resolveCustomerDetailState(
  input: CustomerDetailStateInput,
): CustomerDetailState {
  if (input.isLoading) return 'loading';
  if (input.isError) {
    // Only a real 404 means the customer does not exist. A 401/403/500 is a
    // load failure and must offer a retry instead of claiming "not found".
    return input.errorStatus === 404 ? 'not-found' : 'error';
  }
  return input.hasCustomer ? 'ready' : 'not-found';
}

/** Error carrying the HTTP status so the detail can distinguish 404 from 403/500. */
export class CustomerLoadError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'CustomerLoadError';
    this.status = status;
  }
}

export function customerErrorStatus(error: unknown): number | null {
  return error instanceof CustomerLoadError ? error.status : null;
}
