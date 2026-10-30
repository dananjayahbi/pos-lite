import { useQuery } from '@tanstack/react-query';

import {
  CUSTOMER_SEARCH_DEFAULT_LIMIT,
  CUSTOMER_SEARCH_MIN_LENGTH,
  customerSearchQueryKey,
  fetchCustomerSearch,
  type CustomerSearchResult,
} from '@/lib/api/customers';

interface UseCustomerSearchOptions {
  /** Raw (non-debounced) search term. */
  search: string;
  limit?: number;
  /** Debounce applied by the caller; this hook does not debounce. */
  enabled?: boolean;
}

/**
 * The single customer-search query used by every picker.
 *
 * Callers get an always-array `customers` value, so `customers.map(...)` is
 * safe even before the first response lands. Never call `useQuery` with a
 * customer-search key directly — route through here so the cache key and the
 * response contract can't drift apart again.
 */
export function useCustomerSearch({
  search,
  limit = CUSTOMER_SEARCH_DEFAULT_LIMIT,
  enabled = true,
}: UseCustomerSearchOptions): {
  customers: CustomerSearchResult[];
  isFetching: boolean;
  isError: boolean;
} {
  const trimmed = search.trim();

  const { data, isFetching, isError } = useQuery({
    queryKey: customerSearchQueryKey(trimmed, limit),
    queryFn: ({ signal }) => fetchCustomerSearch(trimmed, limit, signal),
    enabled: enabled && trimmed.length >= CUSTOMER_SEARCH_MIN_LENGTH,
    staleTime: 30_000,
  });

  return {
    customers: data ?? [],
    isFetching,
    isError,
  };
}
