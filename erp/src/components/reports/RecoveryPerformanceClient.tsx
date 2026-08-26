'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useReportContext } from '@/lib/reports/ReportContext';
import type { RecoveryStaffPerformance, RecoveryStaffRow } from '@/lib/services/recovery-stats.service';

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return toYMD(d);
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultTo(): string {
  return toYMD(new Date());
}

interface RecoveryResponse {
  success: boolean;
  data: RecoveryStaffPerformance;
  error?: { code: string; message: string };
}

async function fetchRecoveryPerformance(from: string, to: string): Promise<RecoveryStaffPerformance> {
  const res = await fetch(
    `/api/reports/recovery-staff-performance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  if (res.status === 403) throw new Error('ACCESS_DENIED');
  if (!res.ok) throw new Error('Failed to fetch report');
  const json: RecoveryResponse = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? 'Unknown error');
  return json.data;
}

type SortKey = 'assignedFailed' | 'totalAttempts' | 'redelivered' | 'cancelled' | 'recoveryRate';

function sortRows(rows: RecoveryStaffRow[], key: SortKey, dir: 'asc' | 'desc') {
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    return dir === 'asc' ? av - bv : bv - av;
  });
}

export default function RecoveryPerformanceClient() {
  const searchParams = useSearchParams();
  const from = searchParams.get('from') ?? defaultFrom();
  const to = searchParams.get('to') ?? defaultTo();
  const { setReportData } = useReportContext();

  const [sortKey, setSortKey] = useState<SortKey>('recoveryRate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading, error } = useQuery({
    queryKey: ['recovery-staff-performance', from, to],
    queryFn: () => fetchRecoveryPerformance(from, to),
  });

  const sorted = useMemo(() => {
    if (!data) return [];
    return sortRows(data.staff, sortKey, sortDir);
  }, [data, sortKey, sortDir]);

  useEffect(() => {
    if (!data) return;
    const rows: Record<string, unknown>[] = data.staff.map((s) => ({
      Staff: s.email,
      Role: s.role,
      'Assigned Failed': s.assignedFailed,
      'Total Attempts': s.totalAttempts,
      'Follow-ups': s.followUpCalls,
      Rescheduled: s.rescheduled,
      Redelivered: s.redelivered,
      Cancelled: s.cancelled,
      'Recovery Rate %': s.recoveryRate,
    }));
    setReportData(rows);
  }, [data, setReportData]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function indicator(key: SortKey) {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  if (isLoading) {
    return <div className="p-8 text-center text-espresso/50">Loading recovery performance…</div>;
  }

  if (error) {
    if (error.message === 'ACCESS_DENIED') {
      return (
        <div className="mx-auto max-w-5xl p-6">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 text-center text-red-700">
              <p className="text-lg font-semibold">Access Denied</p>
              <p className="mt-1 text-sm">You do not have permission to view this report.</p>
            </CardContent>
          </Card>
        </div>
      );
    }
    return <div className="p-6 text-center text-red-600">Failed to load report: {error.message}</div>;
  }

  if (!data) return null;
  const t = data.totals;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Staff With Recovery" value={String(data.staff.length)} />
        <StatCard label="Failed Orders Assigned" value={String(t.totalAssignedFailed)} />
        <StatCard label="Total Attempts" value={String(t.totalAttempts)} />
        <StatCard label="Redelivered" value={String(t.totalRedelivered)} />
        <StatCard label="Recovery Rate" value={`${t.overallRecoveryRate}%`} />
      </div>

      <Card>
        <CardHeader className="bg-mist rounded-t-lg">
          <CardTitle className="text-espresso text-base">Recovery Performance by Staff</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No recovery activity for this date range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Follow-ups</TableHead>
                    <TableHead>Rescheduled</TableHead>
                    <TableHead>Redelivered</TableHead>
                    <TableHead>Cancelled</TableHead>
                    <TableHead onClick={() => toggleSort('recoveryRate')} className="cursor-pointer">
                      Rate{indicator('recoveryRate')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((row) => (
                    <TableRow key={row.staffId}>
                      <TableCell className="font-medium">{row.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.role.replace(/_/g, ' ')}</Badge>
                      </TableCell>
                      <TableCell>{row.assignedFailed}</TableCell>
                      <TableCell>{row.totalAttempts}</TableCell>
                      <TableCell>{row.followUpCalls}</TableCell>
                      <TableCell>{row.rescheduled}</TableCell>
                      <TableCell className="text-green-700">{row.redelivered}</TableCell>
                      <TableCell className="text-red-700">{row.cancelled}</TableCell>
                      <TableCell>{row.recoveryRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-espresso/50">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-espresso">{value}</p>
      </CardContent>
    </Card>
  );
}
