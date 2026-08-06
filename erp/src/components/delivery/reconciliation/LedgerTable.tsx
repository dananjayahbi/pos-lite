'use client';

import { Badge } from '@/components/ui/badge';
import { formatRupee } from '@/lib/format';

interface LedgerEntry {
  id: string;
  waybillId?: string | null;
  expectedCod: number | string;
  status: string;
  settledAmount?: number | string | null;
  settledAt?: string | null;
  discrepancyNote?: string | null;
  delivery?: { orderRef?: string | null } | null;
}

interface LedgerTableProps {
  entries: LedgerEntry[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_SETTLEMENT: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  MATCHED: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  PARTIAL_MATCH: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  DISCREPANCY: 'bg-red-100 text-red-800 hover:bg-red-100',
  CLEARED: 'bg-green-100 text-green-800 hover:bg-green-100',
  DISPUTED: 'bg-violet-100 text-violet-800 hover:bg-violet-100',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_SETTLEMENT: 'Pending',
  MATCHED: 'Matched',
  PARTIAL_MATCH: 'Partial',
  DISCREPANCY: 'Discrepancy',
  CLEARED: 'Cleared',
  DISPUTED: 'Disputed',
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LedgerTable({ entries }: LedgerTableProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-espresso/20 py-12 text-center">
        <p className="text-sm font-medium text-espresso/60">No ledger entries yet</p>
        <p className="text-xs text-espresso/40">
          Expected receivables will appear here once deliveries are settled.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-espresso/10">
      <table className="w-full min-w-210">
        <thead>
          <tr className="border-b border-espresso/10 bg-espresso/5">
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Order Ref</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Waybill</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-espresso/60">Expected COD</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-espresso/60">Settled</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Settled At</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Discrepancy</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-espresso/5 last:border-0 hover:bg-espresso/5">
              <td className="px-4 py-3 font-mono text-xs font-semibold text-espresso">
                {entry.delivery?.orderRef ?? '—'}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-espresso/60">
                {entry.waybillId ?? '—'}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-espresso">
                {formatRupee(Number(entry.expectedCod))}
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={STATUS_COLORS[entry.status] ?? 'bg-gray-100 text-gray-800'}
                >
                  {STATUS_LABELS[entry.status] ?? entry.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right text-sm text-espresso/70">
                {entry.settledAmount != null ? formatRupee(Number(entry.settledAmount)) : '—'}
              </td>
              <td className="px-4 py-3 text-xs text-espresso/60">
                {formatDate(entry.settledAt)}
              </td>
              <td className="px-4 py-3 text-sm text-terracotta">
                {entry.discrepancyNote ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
