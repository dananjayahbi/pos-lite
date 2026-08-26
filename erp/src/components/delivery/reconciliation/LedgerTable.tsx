'use client';

import { Badge } from '@/components/ui/badge';
import { formatRupee } from '@/lib/format';
import { DisputeActions } from '@/components/delivery/reconciliation/DisputeActions';

interface LedgerEntry {
  id: string;
  waybillId?: string | null;
  expectedCod: number | string;
  status: string;
  matchMethod?: string | null;
  expectedNetPayout?: number | string | null;
  settledAmount?: number | string | null;
  settledAt?: string | null;
  discrepancyNote?: string | null;
  discrepancyCategory?: string | null;
  discrepancyAmount?: number | string | null;
  auditStatus?: string | null;
  expectedDeduction?: number | string | null;
  actualDeduction?: number | string | null;
  deductionVariance?: number | string | null;
  disputes?: { id: string; status?: string | null }[];
  delivery?: { orderRef?: string | null } | null;
}

interface LedgerTableProps {
  entries: LedgerEntry[];
  canDispute?: boolean;
  onOpenDispute?: (input: { ledgerEntryId: string; reason: string; disputedAmount: number }) => void;
  onUpdateDispute?: (input: { disputeId: string; status: string; resolutionNote?: string }) => void;
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

const MATCH_LABELS: Record<string, string> = {
  WAYBILL: 'Waybill',
  ORDER_REF: 'Order Ref',
  BARCODE: 'Barcode',
  AMBIGUOUS: 'Ambiguous',
  UNMATCHED: 'Unmatched',
};

const CATEGORY_COLORS: Record<string, string> = {
  UNPAID: 'bg-red-100 text-red-800 hover:bg-red-100',
  UNDERPAID: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  UNAUTHORIZED_DEDUCTION: 'bg-violet-100 text-violet-800 hover:bg-violet-100',
  OVER_RECEIVED: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  UNKNOWN: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
};

const CATEGORY_LABELS: Record<string, string> = {
  UNPAID: 'Unpaid',
  UNDERPAID: 'Underpaid',
  UNAUTHORIZED_DEDUCTION: 'Unauth. Deduction',
  OVER_RECEIVED: 'Over-received',
  UNKNOWN: 'Unknown',
};

const AUDIT_LABELS: Record<string, string> = {
  COMPLIANT: 'Compliant',
  OVER_CHARGED: 'Over-charged',
  UNDER_CHARGED: 'Under-charged',
};

const AUDIT_COLORS: Record<string, string> = {
  COMPLIANT: 'bg-green-100 text-green-800 hover:bg-green-100',
  OVER_CHARGED: 'bg-red-100 text-red-800 hover:bg-red-100',
  UNDER_CHARGED: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
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

export function LedgerTable({
  entries,
  canDispute = false,
  onOpenDispute,
  onUpdateDispute,
}: LedgerTableProps) {
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
            <th className="px-4 py-3 text-right text-xs font-medium text-espresso/60">Net Payout</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Audit</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Matched By</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-espresso/60">Settled</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Settled At</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Discrepancy</th>
            {canDispute && (
              <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Action</th>
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const dispute = entry.disputes?.[0];
            const variance =
              entry.settledAmount != null && entry.expectedNetPayout != null
                ? Number(entry.settledAmount) - Number(entry.expectedNetPayout)
                : null;
            return (
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
                <td className="px-4 py-3 text-right text-sm text-espresso/70">
                  {entry.expectedNetPayout != null ? formatRupee(Number(entry.expectedNetPayout)) : '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={STATUS_COLORS[entry.status] ?? 'bg-gray-100 text-gray-800'}
                  >
                    {STATUS_LABELS[entry.status] ?? entry.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {entry.auditStatus ? (
                    <Badge
                      variant="outline"
                      className={AUDIT_COLORS[entry.auditStatus] ?? 'bg-gray-100 text-gray-800'}
                    >
                      {AUDIT_LABELS[entry.auditStatus] ?? entry.auditStatus}
                    </Badge>
                  ) : (
                    <span className="text-xs text-espresso/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium text-espresso/60">
                    {MATCH_LABELS[entry.matchMethod ?? ''] ?? entry.matchMethod ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm text-espresso/70">
                  {entry.settledAmount != null ? formatRupee(Number(entry.settledAmount)) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-espresso/60">
                  {formatDate(entry.settledAt)}
                </td>
                <td className="px-4 py-3">
                  {entry.discrepancyCategory ? (
                    <Badge
                      variant="outline"
                      className={CATEGORY_COLORS[entry.discrepancyCategory] ?? 'bg-gray-100 text-gray-800'}
                    >
                      {CATEGORY_LABELS[entry.discrepancyCategory] ?? entry.discrepancyCategory}
                    </Badge>
                  ) : (
                    <span className="text-sm text-espresso/40">{entry.discrepancyNote ?? '—'}</span>
                  )}
                  {variance !== null && (
                    <span
                      className={`mt-1 block text-xs font-medium ${
                        variance < -0.01 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {formatRupee(variance)} vs net
                    </span>
                  )}
                </td>
                {canDispute && (
                  <td className="px-4 py-3">
                    <DisputeActions
                      entryId={entry.id}
                      disputeId={dispute?.id ?? null}
                      disputeStatus={dispute?.status ?? null}
                      expectedCod={entry.expectedCod}
                      onOpen={onOpenDispute ?? (() => {})}
                      onUpdate={onUpdateDispute ?? (() => {})}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
