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

interface AuditReport {
  byStatus: Record<string, { count: number; variance: number; netPayout: number }>;
  totals: { audited: number; totalVariance: number; totalNetPayout: number };
}

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
  disputes?: { id: string; status?: string | null }[];
  delivery?: { orderRef?: string | null } | null;
}

interface ReconciliationData {
  items?: LedgerEntry[];
  total?: number;
  aging?: AgingSummary;
  discrepancySummary?: Record<string, number>;
  audit?: AuditReport;
  openDisputes?: number;
}

const CATEGORY_CARDS: { key: string; label: string; tone: string }[] = [
  { key: 'UNPAID', label: 'Unpaid', tone: 'text-terracotta' },
  { key: 'UNDERPAID', label: 'Underpaid', tone: 'text-espresso' },
  { key: 'UNAUTHORIZED_DEDUCTION', label: 'Unauth. Deductions', tone: 'text-violet-700' },
  { key: 'OVER_RECEIVED', label: 'Over-received', tone: 'text-blue-700' },
];

const AUDIT_CARDS: { key: string; label: string; tone: string }[] = [
  { key: 'COMPLIANT', label: 'Compliant', tone: 'text-green-700' },
  { key: 'OVER_CHARGED', label: 'Over-charged', tone: 'text-red-700' },
  { key: 'UNDER_CHARGED', label: 'Under-charged', tone: 'text-blue-700' },
];

export function ReconciliationClient() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission(PERMISSIONS.DELIVERY.viewReconciliation);
  const canImport = hasPermission(PERMISSIONS.DELIVERY.importRemittance);
  const { data, isLoading, importCsv, openDispute, updateDispute } = useReconciliation();

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
  const discrepancySummary = reconciliation.discrepancySummary ?? {};
  const audit = reconciliation.audit;

  const bucketCards = aging
    ? [
        { label: 'Under 7 Days', value: aging.buckets.under7, tone: 'text-espresso' },
        { label: 'Under 14 Days', value: aging.buckets.under14, tone: 'text-espresso' },
        { label: 'Overdue (>14 Days)', value: aging.buckets.overdue, tone: 'text-terracotta' },
      ]
    : [];

  const discrepancyCards = CATEGORY_CARDS.map((c) => ({
    ...c,
    value: discrepancySummary[c.key] ?? 0,
  }));

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

      {/* Discrepancy categories summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {discrepancyCards.map((card) => (
          <Card key={card.key} className="border-mist">
            <CardHeader>
              <CardTitle className="font-display text-sm font-semibold text-espresso/70">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`font-display text-2xl font-bold ${card.tone}`}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Contract-compliance audit summary (doc 16) + open disputes (doc 17) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-mist">
          <CardHeader>
            <CardTitle className="font-display text-sm font-semibold text-espresso/70">
              Open Disputes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold text-violet-700">
              {reconciliation.openDisputes ?? 0}
            </p>
          </CardContent>
        </Card>
        {AUDIT_CARDS.map((card) => {
          const stat = audit?.byStatus[card.key];
          return (
            <Card key={card.key} className="border-mist">
              <CardHeader>
                <CardTitle className="font-display text-sm font-semibold text-espresso/70">
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`font-display text-2xl font-bold ${card.tone}`}>
                  {stat?.count ?? 0}
                </p>
                <p className="text-xs text-espresso/50">
                  {stat ? formatRupee(Math.abs(stat.variance)) : '—'}
                </p>
              </CardContent>
            </Card>
          );
        })}
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
              <LedgerTable
                entries={entries}
                canDispute={canImport}
                onOpenDispute={(input) => openDispute.mutate(input)}
                onUpdateDispute={(input) => updateDispute.mutate(input)}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
