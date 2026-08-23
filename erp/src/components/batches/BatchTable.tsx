'use client';

import { Badge } from '@/components/ui/badge';
import type { BatchExpiryStatus } from '@/lib/services/batchTracking.core';
import type { BatchListItem } from '@/hooks/useBatches';
import { BatchExpiryStatusBadge } from '@/components/batches/BatchExpiryStatusBadge';

const SOURCE_LABELS: Record<BatchListItem['source'], string> = {
  PURCHASE: 'Purchased',
  MANUFACTURED: 'Manufactured',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

interface BatchTableProps {
  batches: BatchListItem[];
  isLoading: boolean;
}

export function BatchTable({ batches, isLoading }: BatchTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No batches found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5">Product / Variant</th>
            <th className="px-4 py-2.5">SKU</th>
            <th className="px-4 py-2.5">Batch</th>
            <th className="px-4 py-2.5">Source</th>
            <th className="px-4 py-2.5 text-right">Qty</th>
            <th className="px-4 py-2.5">Expiry</th>
            <th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {batches.map((batch) => (
            <tr key={batch.id} className="hover:bg-muted/30">
              <td className="px-4 py-2.5">
                <div className="font-medium">{batch.productName}</div>
                <div className="text-xs text-muted-foreground">{batch.variantLabel}</div>
              </td>
              <td className="px-4 py-2.5 font-mono text-xs">{batch.sku}</td>
              <td className="px-4 py-2.5 font-mono text-xs">{batch.batchNumber}</td>
              <td className="px-4 py-2.5">
                <Badge variant="secondary">{SOURCE_LABELS[batch.source]}</Badge>
              </td>
              <td className="px-4 py-2.5 text-right">{batch.quantity}</td>
              <td className="px-4 py-2.5">{formatDate(batch.expiryDate)}</td>
              <td className="px-4 py-2.5">
                <BatchExpiryStatusBadge status={batch.expiryStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
