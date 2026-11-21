'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProductionLogs } from '@/hooks/useBom';
import {
  factoryFeedErrorMessage,
  resolveFactoryFeedState,
} from '@/components/raw-materials/factoryDashboardState';
import { formatShortDateTime, formatRupee } from '@/lib/format';

const PAGE_SIZE = 25;

/**
 * ARGUS #259 - a full production log. The dashboard only ever rendered the
 * compact six-row summary, so older runs and the actor/note/batch/consumption
 * detail were unreachable. Each row expands in place to show the run's frozen
 * recipe and the batch number recorded with the production audit row.
 */
export function ProductionHistoryClient() {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data, isError, isLoading, error, isFetching, refetch } = useProductionLogs({
    page,
    limit: PAGE_SIZE,
  });
  const logs = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const mode = resolveFactoryFeedState({ isError, isLoading, itemCount: logs.length });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Production history</h1>
          <p className="mt-1 font-body text-sm text-mist-ink">
            Every production run with its actor, note, batch and raw-material consumption.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/factory/bom">Manage BOMs</Link>
        </Button>
      </div>

      {mode === 'error' ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-10 text-center"
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
      ) : mode === 'loading' ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : mode === 'empty' ? (
        <p className="rounded-lg border border-mist bg-pearl/40 px-4 py-12 text-center text-sm text-mist-ink">
          No production runs recorded yet.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-mist bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-linen/40 text-left text-xs uppercase tracking-wide text-mist-ink">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Quantity</th>
                  <th className="px-4 py-3 font-medium">Material cost</th>
                  <th className="px-4 py-3 font-medium">By</th>
                  <th className="px-4 py-3 font-medium">Batch</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Detail</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => {
                  const expanded = expandedId === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr>
                        <td className="px-4 py-3">
                          <div className="text-espresso">{log.variantName}</div>
                          <div className="text-xs text-mist-ink">
                            {log.variantSku} · {log.bomName}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-espresso">+{log.quantity}</td>
                        <td className="px-4 py-3 text-mist-ink">
                          {formatRupee(log.materialCost)}
                        </td>
                        <td className="px-4 py-3 text-mist-ink">{log.actorName}</td>
                        <td className="px-4 py-3 font-mono text-xs text-mist-ink">
                          {log.batchNumber ?? '-'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-mist-ink">
                          {formatShortDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-expanded={expanded}
                            aria-controls={`production-detail-${log.id}`}
                            onClick={() => setExpandedId(expanded ? null : log.id)}
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            )}
                            <span className="ml-1">{expanded ? 'Hide' : 'Detail'}</span>
                          </Button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr id={`production-detail-${log.id}`}>
                          <td colSpan={7} className="bg-pearl/30 px-4 py-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-1 text-sm">
                                <p className="font-medium text-espresso">Run</p>
                                <p className="text-mist-ink">
                                  Actor: <span className="text-espresso">{log.actorName}</span>
                                </p>
                                <p className="text-mist-ink">
                                  Note:{' '}
                                  <span className="text-espresso">
                                    {log.note?.trim() || 'No note recorded'}
                                  </span>
                                </p>
                                <p className="text-mist-ink">
                                  Batch:{' '}
                                  <span className="font-mono text-xs text-espresso">
                                    {log.batchNumber ?? 'Not recorded'}
                                  </span>
                                </p>
                              </div>
                              <div className="space-y-1 text-sm">
                                <p className="font-medium text-espresso">
                                  Raw-material consumption
                                </p>
                                {log.consumption.length === 0 ? (
                                  <p className="text-mist-ink">No ingredients recorded.</p>
                                ) : (
                                  <ul className="space-y-1">
                                    {log.consumption.map((line) => (
                                      <li
                                        key={line.rawMaterialId}
                                        className="flex justify-between gap-4 text-mist-ink"
                                      >
                                        <span>{line.rawMaterialName}</span>
                                        <span className="whitespace-nowrap text-espresso">
                                          {line.quantity} {line.unitShortLabel}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="font-body text-sm text-sand-ink">
              Page {page} of {totalPages} ({total} runs)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => {
                  setExpandedId(null);
                  setPage((current) => Math.max(1, current - 1));
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => {
                  setExpandedId(null);
                  setPage((current) => Math.min(totalPages, current + 1));
                }}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
