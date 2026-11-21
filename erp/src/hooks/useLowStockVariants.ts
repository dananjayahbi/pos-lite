'use client';

import { useQuery } from '@tanstack/react-query';

interface LowStockFilters {
  page?: number | undefined;
  limit?: number | undefined;
  threshold?: number | undefined;
}

interface LowStockVariant {
  id: string;
  sku: string;
  form: string | null;
  pack_size: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  /** ARGUS #214: override when active, else the variant's own threshold. */
  effective_threshold: number;
  retail_price: string;
  product_name: string;
  category_name: string;
  shortfall: number;
}

interface LowStockResponse {
  success: boolean;
  data: LowStockVariant[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: { code?: string; message?: string };
}

export type { LowStockVariant, LowStockFilters };

/** Prefer the endpoint's message, then a status-aware fallback. */
async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: unknown } } | null;
    const message = body?.error?.message;
    if (typeof message === 'string' && message.trim() !== '') return message;
  } catch {
    // Non-JSON error body (proxy/HTML 404) — fall through to the status text.
  }
  return `Failed to fetch low stock variants (HTTP ${res.status})`;
}

export function useLowStockVariants(filters: LowStockFilters) {
  return useQuery<LowStockResponse>({
    queryKey: ['low-stock-variants', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.threshold) params.set('threshold', String(filters.threshold));
      const res = await fetch(`/api/store/stock-control/low-stock?${params}`);
      // ARGUS #213: a 404/500 is an error, not an empty list.
      if (!res.ok) throw new Error(await readErrorMessage(res));
      const json = (await res.json()) as LowStockResponse;
      // A 2xx with a rejected envelope or malformed data is still a failed check.
      if (!json?.success || !Array.isArray(json.data)) {
        throw new Error(json?.error?.message ?? 'Low stock feed returned an invalid response');
      }
      return json;
    },
    // Fail fast into the error state instead of the default exponential retries;
    // one retry absorbs a transient blip.
    retry: 1,
    retryDelay: 300,
    staleTime: 30_000,
  });
}