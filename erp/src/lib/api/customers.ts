/**
 * Customer search transport, shared by every picker in the app.
 *
 * Why this module exists
 * ----------------------
 * `GET /api/store/customers` answers with the standard envelope
 * `{ success, data: { customers, total, page, totalPages } }`.
 *
 * Two pickers used to run `useQuery` under the SAME cache key
 * (`['customer-search', search]`) while returning DIFFERENT values from their
 * `queryFn`:
 *
 *   - `CustomerSearchDropdown` returned the whole envelope → `data.data.customers`
 *   - `CustomerPicker`          returned `json.data.customers` (an array)
 *
 * React Query caches by key alone, so whichever picker resolved first won and
 * the other crashed with `options.map is not a function` when the shapes
 * disagreed (or `.data.customers` was `undefined`). Fixing it here means there
 * is exactly one request/response contract and one cache key, so the failure
 * mode cannot come back by adding a third picker.
 */

/** Minimum characters before a search hits the network. */
export const CUSTOMER_SEARCH_MIN_LENGTH = 2;
export const CUSTOMER_SEARCH_DEFAULT_LIMIT = 8;

/** Fields every customer picker renders. `creditBalance` is a Decimal string. */
export interface CustomerSearchResult {
  id: string;
  name: string;
  phone: string;
  creditBalance: string;
  orderCount: number;
}

/**
 * Cache key for a customer search. Includes the limit because two callers may
 * legitimately want different page sizes for the same term.
 */
export function customerSearchQueryKey(
  search: string,
  limit: number = CUSTOMER_SEARCH_DEFAULT_LIMIT,
) {
  return ['customer-search', search, limit] as const;
}

interface CustomerEnvelope {
  success: boolean;
  data?: { customers?: CustomerSearchResult[] };
  error?: { message?: string };
}

/**
 * Search customers and return ONLY the rows.
 *
 * Always resolves to an array — an empty result or an unexpected body yields
 * `[]` rather than `undefined`, so callers can `.map()` unconditionally.
 */
export async function fetchCustomerSearch(
  search: string,
  limit: number = CUSTOMER_SEARCH_DEFAULT_LIMIT,
  signal?: AbortSignal,
): Promise<CustomerSearchResult[]> {
  const params = new URLSearchParams({ search, limit: String(limit) });
  const res = await fetch(
    `/api/store/customers?${params.toString()}`,
    signal ? { signal } : undefined,
  );

  if (!res.ok) {
    throw new Error(`Customer search failed (${res.status})`);
  }

  const json = (await res.json()) as CustomerEnvelope;

  if (!json.success) {
    throw new Error(json.error?.message ?? 'Customer search failed');
  }

  const customers = json.data?.customers;
  return Array.isArray(customers) ? customers : [];
}
