import { useQuery, useQueryClient } from '@tanstack/react-query';

interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  variantCount: number;
  retailValue: number;
  costValue: number;
}

interface StockValuationData {
  retailValue: number;
  costValue: number;
  estimatedMargin: number;
  estimatedMarginPercent: number;
  variantCount: number;
  categoryBreakdown: CategoryBreakdown[];
  calculatedAt: string;
}

interface StockValuationResponse {
  success: boolean;
  data: StockValuationData;
}

export function useGetStockValuation() {
  return useQuery<StockValuationResponse>({
    queryKey: ['stock-valuation'],
    queryFn: async () => {
      const res = await fetch('/api/store/stock-control/valuation');
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message ?? 'Failed to fetch valuation');
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useInvalidateStockValuation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['stock-valuation'] });
}
