'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

const PAGE_SIZE = 50;

const ENTITY_TYPE_COLORS: Record<string, string> = {
  Sale: 'bg-terracotta text-pearl',
  Return: 'bg-sand text-espresso',
  Staff: 'bg-espresso text-pearl',
  Settings: 'bg-mist text-espresso',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatActionName(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface AuditLogTableProps {
  filters: AuditLogFilterState;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AuditLogTable({ filters }: AuditLogTableProps) {
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (filters.entityType !== 'ALL') p.set('entityType', filters.entityType);
    if (filters.startDate) p.set('startDate', filters.startDate);
    if (filters.endDate) p.set('endDate', filters.endDate);
    if (filters.userId) p.set('userId', filters.userId);
    p.set('page', String(page));
    p.set('pageSize', String(PAGE_SIZE));
    return p.toString();
  }, [filters, page]);

  const { data, isLoading } = useQuery<AuditLogResponse>({
    queryKey: ['auditLogs', filters.entityType, filters.startDate, filters.endDate, filters.userId, page],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs?${buildParams()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch audit logs');
      return json.data;
    },
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const rangeStart = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const rangeEnd = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters.entityType, filters.startDate, filters.endDate, filters.userId]);

  // ── Loading State ──
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const entries = data?.data ?? [];

  // ── Empty State ──
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-mist bg-pearl/50 py-16">
        <p className="text-sand">No audit log entries found.</p>
        <p className="mt-1 text-sm text-sand/70">Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-mist">
        <Table>
          <TableHeader>
            <TableRow className="bg-linen/40">
              <TableHead className="text-espresso">Entity Type</TableHead>
              <TableHead className="text-espresso">Entity ID</TableHead>
              <TableHead className="text-espresso">Action</TableHead>
              <TableHead className="text-espresso">Performed By</TableHead>
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
                <TableCell className="font-mono text-xs text-sand">
                  {truncateId(entry.entityId)}
                </TableCell>
                <TableCell className="text-sm text-espresso">
                  {formatActionName(entry.action)}
                </TableCell>
                <TableCell className="text-sm text-espresso">
                  {entry.actorId ?? 'System'}
                </TableCell>
                <TableCell className="text-sm text-sand">
                  {formatDate(entry.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-sand">
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
