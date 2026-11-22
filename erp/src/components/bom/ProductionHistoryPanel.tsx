'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProductionLogs } from '@/hooks/useBom';
import { formatStockMovementTimestamp } from '@/lib/stock/movement-timestamp';
import {
  factoryFeedErrorMessage,
  resolveFactoryFeedState,
} from '@/components/raw-materials/factoryDashboardState';

interface ProductionHistoryPanelProps {
  compact?: boolean;
}

// ARGUS #255: the history used the browser's default toLocaleString (US-style
// on many machines) while the rest of the ERP renders en-GB timestamps.
function formatDate(value: string): string {
  return formatStockMovementTimestamp(value);
}

export function ProductionHistoryPanel({ compact = false }: ProductionHistoryPanelProps) {
  const { data, isError, isLoading, error, isFetching, refetch } = useProductionLogs({
    limit: compact ? 6 : 25,
  });
  const logs = data?.data ?? [];

  // ARGUS #244 — error first: a failed history call must never claim there are
  // no production runs, and cached rows are not shown as current.
  const viewState = resolveFactoryFeedState({
    isError,
    isLoading,
    itemCount: logs.length,
  });

  if (viewState === 'error') {
    return (
      <div
        role="alert"
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-center ${
          compact ? 'py-5' : 'py-12'
        }`}
      >
        <AlertTriangle className="h-6 w-6 text-red-500" />
        <p className="font-body text-sm font-medium text-red-800">Production history failed</p>
        <p className="font-body text-xs text-red-600">
          {factoryFeedErrorMessage(error, 'Production runs could not be loaded.')}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="border-red-200 bg-white text-red-700 hover:bg-red-100"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Retrying…' : 'Retry'}
        </Button>
      </div>
    );
  }

  if (viewState === 'loading') {
    return (
      <div className={`space-y-2 ${compact ? 'py-1' : 'py-4'}`}>
        {Array.from({ length: compact ? 3 : 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (viewState === 'empty') {
    return (
      <p className="py-4 text-center text-sm text-mist-ink">
        No production runs recorded yet.
      </p>
    );
  }

  if (compact) {
    return (
      <ul className="divide-y">
        {logs.map((log) => (
          <li key={log.id} className="flex items-center justify-between py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-espresso">{log.variantName}</p>
              <p className="truncate text-xs text-mist-ink">
                {log.variantSku} · {formatDate(log.createdAt)}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-espresso">
              +{log.quantity}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-mist-ink">
            <th className="px-4 py-3 font-medium">Product</th>
            <th className="px-4 py-3 font-medium">Quantity</th>
            <th className="px-4 py-3 font-medium">Material cost</th>
            <th className="px-4 py-3 font-medium">By</th>
            <th className="px-4 py-3 font-medium">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="px-4 py-3">
                <div className="text-espresso">{log.variantName}</div>
                <div className="text-xs text-mist-ink">{log.variantSku}</div>
              </td>
              <td className="px-4 py-3 font-semibold text-espresso">+{log.quantity}</td>
              <td className="px-4 py-3 text-mist-ink">Rs {(log.materialCost ?? 0).toFixed(2)}</td>
              <td className="px-4 py-3 text-mist-ink">{log.actorName}</td>
              <td className="px-4 py-3 text-mist-ink">{formatDate(log.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
