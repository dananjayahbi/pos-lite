'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDeliveries } from '@/hooks/delivery';
import {
  mergeFailedDeliveries,
  summarizeFailedDeliveries,
} from '@/lib/delivery/failedQueue';
import { formatRupee } from '@/lib/format';

const QUEUE_LIMIT = 200;

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function FailedDeliveriesClient() {
  const failed = useDeliveries({ status: 'FAILED', limit: QUEUE_LIMIT });
  const returned = useDeliveries({ status: 'RETURNED', limit: QUEUE_LIMIT });

  const rows = mergeFailedDeliveries(
    failed.data?.items ?? [],
    returned.data?.items ?? [],
  );
  const summary = summarizeFailedDeliveries(rows);
  const isLoading = failed.isLoading || returned.isLoading;
  const isError = failed.isError || returned.isError;
  const error = failed.error ?? returned.error;
  const totalFetched = (failed.data?.total ?? 0) + (returned.data?.total ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">
            Failed Deliveries &amp; Recovery
          </h1>
          <p className="mt-1 font-body text-sm text-sand-ink">
            Failed and returned parcels waiting for a recovery action. Open a delivery to log a
            follow-up, reschedule or redeliver it.
          </p>
        </div>
        <Button variant="outline" asChild className="border-mist font-body text-espresso">
          <Link href="/reports/recovery-staff-performance">
            View staff performance
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Queue total" value={String(summary.total)} />
        <StatCard label="Failed" value={String(summary.failed)} />
        <StatCard label="Returned" value={String(summary.returned)} />
        <StatCard label="COD at risk" value={formatRupee(summary.codTotal)} />
      </div>

      {totalFetched > rows.length && (
        <p className="font-body text-xs text-sand-ink">
          Showing the first {QUEUE_LIMIT} failed and {QUEUE_LIMIT} returned deliveries.
        </p>
      )}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 px-4 py-6 text-center font-body text-sm text-terracotta">
          Could not load the recovery queue:{' '}
          {error instanceof Error ? error.message : 'unknown error'}
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-mist bg-pearl py-16 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-mist-ink" />
          <p className="mt-3 font-display text-base text-espresso">No failed deliveries</p>
          <p className="mt-1 font-body text-sm text-sand-ink">
            Failed and returned parcels will appear here for recovery.
          </p>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <Card className="border-mist">
          <CardHeader>
            <CardTitle className="font-display text-espresso">Recovery Queue</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-linen/40">
                  <TableHead className="text-espresso">Order</TableHead>
                  <TableHead className="text-espresso">Customer</TableHead>
                  <TableHead className="text-espresso">Status</TableHead>
                  <TableHead className="text-espresso">Failure reason</TableHead>
                  <TableHead className="text-right text-espresso">COD</TableHead>
                  <TableHead className="text-espresso">Dispatched</TableHead>
                  <TableHead className="text-right text-espresso">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs text-espresso">
                      {row.orderRef}
                    </TableCell>
                    <TableCell className="font-body text-sm">
                      {row.address?.fullName ?? row.customer?.name ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.status === 'FAILED' ? 'text-terracotta' : 'text-sand-ink'
                        }
                      >
                        {row.status === 'FAILED' ? 'Failed' : 'Returned'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-body text-xs text-sand-ink">
                      {row.failureReason ?? '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatRupee(row.codAmount)}
                    </TableCell>
                    <TableCell className="font-body text-xs text-sand-ink">
                      {formatDate(row.dispatchedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" asChild className="border-mist">
                        <Link href={`/delivery/${row.id}`}>Open recovery</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-mist">
      <CardContent className="p-4">
        <p className="font-body text-xs uppercase tracking-wide text-mist-ink">{label}</p>
        <p className="mt-1 font-display text-xl font-semibold text-espresso">{value}</p>
      </CardContent>
    </Card>
  );
}
