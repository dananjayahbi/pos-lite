'use client';

import { useQuery } from '@tanstack/react-query';

import type { CustomerTagOption } from '@/lib/services/customerTag.core';

/**
 * ARGUS #333 — existing customer tags for the customer-pricing editor.
 *
 * `GET /api/store/customers/tags` returns canonical upper-case tags with a
 * customer count. The picker is the canonical source; the API still enforces
 * the tag exists so a free-form edit cannot create a dead rule.
 */
export function useCustomerTagOptions(enabled = true) {
  return useQuery<CustomerTagOption[]>({
    queryKey: ['customer-tag-options'],
    queryFn: async () => {
      const res = await fetch('/api/store/customers/tags');
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as CustomerTagOption[];
    },
    enabled,
    staleTime: 60 * 1000,
  });
}
