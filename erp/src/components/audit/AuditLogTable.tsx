'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DownloadIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { auditListMode } from '@/lib/audit/auditList.core';
import {
  auditChangeSummary,
  formatAuditActionLabel,
  formatAuditDateTime,
  formatAuditRoleLabel,
} from '@/lib/audit/auditPresentation.core';
import {
  AUDIT_PAGE_SIZES,
  DEFAULT_AUDIT_PAGE_SIZE,
  normalizeAuditPageSize,
} from '@/lib/audit/auditFilterState.core';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import AuditLogDetailModal from '@/components/audit/AuditLogDetailModal';
import type { AuditLogFilterState } from '@/components/audit/AuditLogFilters';

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ENTITY_TYPE_COLORS: Record<string, string> = {
  Sale: 'bg-terracotta text-pearl',
  Return: 'bg-sand text-espresso',
  Staff: 'bg-espresso text-pearl',
  Settings: 'bg-mist text-espresso',
};

// ── Props ────────────────────────────────────────────────────────────────────

interface AuditLogTableProps {
  filters: AuditLogFilterState;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AuditLogTable({ filters }: AuditLogTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_AUDIT_PAGE_SIZE);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (filters.entityType !== 'ALL') p.set('entityType', filters.entityType);
    if (filters.action !== 'ALL') p.set('action', filters.action);
    if (filters.startDate) p.set('startDate', filters.startDate);
    if (filters.endDate) p.set('endDate', filters.endDate);
    if (filters.userId) p.set('userId', filters.userId);
    if (filters.search) p.set('search', filters.search);
    p.set('page', String(page));
    p.set('pageSize', String(pageSize));
    return p.toString();
  }, [filters, page, pageSize]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<AuditLogResponse>({
    queryKey: ['auditLogs', filters.entityType, filters.action, filters.startDate, filters.endDate, filters.userId, filters.search, page, pageSize],
    // M35-02 (OBS-75): react-query hands us an AbortSignal — pass it through so
    // a superseded request is cancelled instead of racing the newer one. Without
    // this, rapid filter changes could resolve out of order and flash stale rows
    // (last-write-wins was not guaranteed).
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/audit-logs?${buildParams()}`, { signal });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch audit logs');
      // XC-02 canonical envelope: array `data` + pagination in `meta`.
      return {
        data: json.data as AuditLogEntry[],
        total: json.meta?.total ?? 0,
        page: json.meta?.page ?? 1,
        pageSize: json.meta?.limit ?? pageSize,
      };
    },
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const rangeStart = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const rangeEnd = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  // Reset page when filters or the page size change
  useEffect(() => {
    setPage(1);
  }, [
    filters.entityType,
    filters.action,
    filters.startDate,
    filters.endDate,
    filters.userId,
    filters.search,
    pageSize,
  ]);

  async function handleExport() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // The CSV endpoint exports the complete filtered set (ARGUS #453), so
      // paging params are irrelevant here.
      const params = new URLSearchParams(buildParams());
      params.set('format', 'csv');
      params.delete('page');
      params.delete('pageSize');

      const response = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to export audit logs');
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = 'audit-log-export.csv';
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export audit logs');
    } finally {
      setIsExporting(false);
    }
  }

  const mode = auditListMode({ isLoading, isError, count: data?.data?.length ?? 0 });

  // ── Loading State ──
  if (mode === 'loading') {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  // ── Error State ──
  if (mode === 'error') {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 py-16">
        <p className="font-medium text-red-700">Audit log could not be loaded.</p>
        <p className="mt-1 text-sm text-red-600">
          The request failed; this is not an empty result.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 border-red-300 text-red-700 hover:bg-red-100"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Retry
        </Button>
      </div>
    );
  }

  const entries = data?.data ?? [];

  // ── Empty State ──
  if (mode === 'empty') {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-mist bg-pearl/50 py-16">
        <p className="text-sand-ink">No audit log entries found.</p>
        <p className="mt-1 text-sm text-sand-ink/70">Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <label className="flex items-center gap-2 font-body text-sm text-sand-ink">
          Rows per page
          <select
            className="h-9 rounded-md border border-mist bg-white px-2 text-sm text-espresso"
            value={pageSize}
            onChange={(event) => setPageSize(normalizeAuditPageSize(Number(event.target.value)))}
          >
            {AUDIT_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleExport()}
          disabled={isExporting}
        >
          <DownloadIcon className={`mr-2 h-4 w-4 ${isExporting ? 'animate-pulse' : ''}`} />
          {isExporting ? 'Exporting...' : 'Export filtered CSV'}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-mist">
        <Table>
          <TableHeader>
            <TableRow className="bg-linen/40">
              <TableHead className="text-espresso">Entity Type</TableHead>
              <TableHead className="text-espresso">Entity ID</TableHead>
              <TableHead className="text-espresso">Action</TableHead>
              <TableHead className="text-espresso">User</TableHead>
              <TableHead className="text-espresso">IP</TableHead>
              <TableHead className="text-espresso">Change</TableHead>
              <TableHead className="text-espresso">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow
                key={entry.id}
                className="cursor-pointer hover:bg-linen/20"
                onClick={() => setSelectedEntry(entry)}
              >
                <TableCell>
                  <Badge
                    className={`${ENTITY_TYPE_COLORS[entry.entityType] ?? 'bg-pearl text-espresso border border-mist'} hover:opacity-90`}
                  >
                    {entry.entityType.replace(/([a-z])([A-Z])/g, '$1 $2')}
                  </Badge>
                </TableCell>
                <TableCell
                  className="max-w-[10rem] truncate font-mono text-xs text-sand-ink"
                  title={entry.entityId}
                >
                  {entry.entityId}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-espresso">
                  {formatAuditActionLabel(entry.action)}
                </TableCell>
                <TableCell className="text-sm text-espresso">
                  <div>{entry.actorName}</div>
                  <div className="text-xs text-sand-ink">
                    {formatAuditRoleLabel(entry.actorRole)}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-sand-ink">
                  {entry.ipAddress ?? '-'}
                </TableCell>
                <TableCell
                  className="max-w-[16rem] text-xs text-sand-ink"
                  title={auditChangeSummary(entry.before, entry.after, 20)}
                >
                  {auditChangeSummary(entry.before, entry.after)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-sand-ink">
                  {formatAuditDateTime(entry.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-sand-ink">
            Showing {rangeStart} – {rangeEnd} of {data.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="border-mist"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="border-mist"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <AuditLogDetailModal
        entry={selectedEntry}
        open={selectedEntry !== null}
        onOpenChange={(open) => { if (!open) setSelectedEntry(null); }}
      />
    </>
  );
}
