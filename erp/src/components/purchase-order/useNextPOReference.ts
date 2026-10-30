'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchPurchaseOrderList } from './poApi';
import { monthKey } from './poDates';
import { poQueryKeys } from './poQueryKeys';

/**
 * Next free `PO-YYYYMM-####` for the month of the date the operator picked.
 *
 * The authoritative number is still allocated by the server on save (and can
 * lose a race, which it retries). This is a *suggestion* shown as the input's
 * placeholder and hint so the operator knows what will be issued.
 */
export function useNextPOReference(orderDate: string): string | null {
  const key = monthKey(orderDate);

  const { data } = useQuery({
    queryKey: poQueryKeys.reference(key),
    queryFn: () => fetchPurchaseOrderList(200),
    staleTime: 30_000,
    enabled: /^\d{4}-\d{2}/.test(orderDate),
  });

  if (!data) return null;

  const prefix = `PO-${key.replace('-', '')}-`;
  let highest = 0;
  for (const po of data.purchaseOrders) {
    if (!po.referenceNo.startsWith(prefix)) continue;
    const sequence = Number.parseInt(po.referenceNo.slice(prefix.length), 10);
    if (Number.isFinite(sequence) && sequence > highest) highest = sequence;
  }

  const next = String(highest + 1).padStart(4, '0');
  const [year, month] = key.split('-');
  return `PO-${year}${month}-${next}`;
}
