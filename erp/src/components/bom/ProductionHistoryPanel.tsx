'use client';

import { useProductionLogs } from '@/hooks/useBom';

interface ProductionHistoryPanelProps {
  compact?: boolean;
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function ProductionHistoryPanel({ compact = false }: ProductionHistoryPanelProps) {
  const { data } = useProductionLogs({ limit: compact ? 6 : 25 });
  const logs = data?.data ?? [];

  if (logs.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-mist">
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
              <p className="truncate text-xs text-mist">
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
          <tr className="border-b text-left text-xs uppercase tracking-wide text-mist">
            <th className="px-4 py-3 font-medium">Product</th>
            <th className="px-4 py-3 font-medium">Quantity</th>
            <th className="px-4 py-3 font-medium">By</th>
            <th className="px-4 py-3 font-medium">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="px-4 py-3">
                <div className="text-espresso">{log.variantName}</div>
                <div className="text-xs text-mist">{log.variantSku}</div>
              </td>
              <td className="px-4 py-3 font-semibold text-espresso">+{log.quantity}</td>
              <td className="px-4 py-3 text-mist">{log.actorName}</td>
              <td className="px-4 py-3 text-mist">{formatDate(log.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
