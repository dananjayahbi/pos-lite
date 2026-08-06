'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { useReconciliation } from '@/hooks/delivery';
import { formatRupee } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LedgerTable } from '@/components/delivery/reconciliation/LedgerTable';
import { RemittanceUpload } from '@/components/delivery/reconciliation/RemittanceUpload';

interface AgingSummary {
  buckets: { under7: number; under14: number; overdue: number };
  count: number;
  totalPendingCod: number;
}

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

interface ReconciliationData {
  items?: LedgerEntry[];
  total?: number;
  aging?: AgingSummary;
}

export function ReconciliationClient() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission(PERMISSIONS.DELIVERY.viewReconciliation);
  const canImport = hasPermission(PERMISSIONS.DELIVERY.importRemittance);
  const { data, isLoading, importCsv } = useReconciliation();

  if (!canView) {
    return (
      <Card className="border-mist">
        <CardContent className="p-8 text-center text-sm text-espresso/60">
          You do not have permission to view reconciliation.
        </CardContent>
      </Card>
    );
  }

  const reconciliation = (data as ReconciliationData | undefined) ?? {};
  const entries = reconciliation.items ?? [];
  const total = reconciliation.total ?? entries.length;
  const aging = reconciliation.aging;

  const bucketCards = aging
    ? [
        { label: 'Under 7 Days', value: aging.buckets.under7, tone: 'text-espresso' },
        { label: 'Under 14 Days', value: aging.buckets.under14, tone: 'text-espresso' },
        { label: 'Overdue (>14 Days)', value: aging.buckets.overdue, tone: 'text-terracotta' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">COD Reconciliation</h1>
        <p className="text-sm text-espresso/60">
          Expected receivables vs Trans Express remittance statements.
        </p>
      </div>

      {/* Pending COD aging summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-mist">
          <CardHeader>
            <CardTitle className="font-display text-sm font-semibold text-espresso/70">
              Pending COD
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="font-display text-2xl font-bold text-espresso">
                {formatRupee(aging?.totalPendingCod ?? 0)}
              </p>
            )}
          </CardContent>
        </Card>

        {bucketCards.map((bucket) => (
          <Card key={bucket.label} className="border-mist">
            <CardHeader>
              <CardTitle className="font-display text-sm font-semibold text-espresso/70">
                {bucket.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className={`font-display text-2xl font-bold ${bucket.tone}`}>
                  {bucket.value}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!isLoading && (
        <>
          {canImport && (
            <RemittanceUpload
              onImport={(file) => {
                importCsv.mutate(file);
              }}
            />
          )}

          <Card className="border-mist">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="font-display text-lg">Ledger</CardTitle>
              <span className="text-xs text-espresso/50">{total} entries</span>
            </CardHeader>
            <CardContent className="p-0">
              <LedgerTable entries={entries} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
