import { useEffect, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PrefillProduct {
  id: string;
  name: string;
  category?: { name: string } | null;
  brand?: { name: string } | null;
}

export interface PrefillVariant {
  id: string;
  sku: string | null;
  barcode: string | null;
  form: string | null;
  packSize: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
}

interface VariantLookupResponse {
  success: boolean;
  data?: {
    product: PrefillProduct;
    variant: PrefillVariant;
  };
  error?: { message: string };
}

interface UseVariantPrefillResult {
  product: PrefillProduct | null;
  variant: PrefillVariant | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Resolves a `variantId` (e.g. from the Low Stock page) into its parent
 * product + variant so the adjustment form can be pre-filled and locked.
 */
export function useVariantPrefill(variantId: string | null): UseVariantPrefillResult {
  const [product, setProduct] = useState<PrefillProduct | null>(null);
  const [variant, setVariant] = useState<PrefillVariant | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!variantId) {
      setProduct(null);
      setVariant(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(
          `/api/store/stock-control/variant-lookup?variantId=${encodeURIComponent(variantId)}`,
        );
        const json: VariantLookupResponse = await res.json();

        if (cancelled) return;

        if (!res.ok || !json.success || !json.data) {
          setError(json.error?.message ?? 'Failed to load variant details');
          return;
        }

        setProduct(json.data.product);
        setVariant(json.data.variant);
      } catch {
        if (!cancelled) setError('Network error while loading variant details');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [variantId]);

  return { product, variant, isLoading, error };
}