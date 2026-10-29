'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchPurchaseOrderPayments } from './poApi';
import { poQueryKeys } from './poQueryKeys';

/**
 * Payment history plus the paid/outstanding/settled figures every consumer of
 * the detail page needs. Kept in one hook so the panel and the pay dialog can
 * never disagree about how much is left to pay.
 */
export function usePOPayments(poId: string, payable: number) {
  const query = useQuery({
    queryKey: poQueryKeys.payments(poId),
    queryFn: () => fetchPurchaseOrderPayments(poId),
  });

  const payments = query.data?.payments ?? [];
  const paidTotal = query.data?.paidTotal ?? 0;
  const outstanding = Math.max(0, Math.round((payable - paidTotal) * 100) / 100);
  const settled = payable > 0 && outstanding <= 0;

  return {
    payments,
    paidTotal,
    payable,
    outstanding,
    settled,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
