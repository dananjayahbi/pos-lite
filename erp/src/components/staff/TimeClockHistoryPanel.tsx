'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import {
  formatAttendanceDate,
  shiftReferenceLabel,
} from '@/lib/attendance/attendancePresentation.core';

interface TimeClockRecord {
  id: string;
  clockedInAt: string;
  clockedOutAt: string | null;
  durationMinutes: number | null;
  notes: string | null;
  shift: { id: string; openedAt: string; closedAt: string | null } | null;
}

interface TimeClockData {
  records: TimeClockRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Full-history totals from the server (ARGUS #352). */
  summary: {
    hoursThisWeek: number;
    hoursThisMonth: number;
  };
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function TimeClockHistoryPanel({
  staffId,
  title = 'Time Clock',
}: {
  staffId: string;
  title?: string;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery<{ success: boolean; data: TimeClockData }>({
    queryKey: ['timeclock', staffId, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        userId: staffId,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/store/timeclock?${params}`);
      if (!res.ok) throw new Error('Failed to fetch time clock history');
      return res.json();
    },
    enabled: !!staffId,
  });

  const records = data?.data;
  // The API aggregates the full history; it is unaffected by `page`.
  const summary = records?.summary ?? { hoursThisWeek: 0, hoursThisMonth: 0 };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-display text-espresso">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary" className="gap-1 text-xs">
            Hours This Week: {summary.hoursThisWeek.toFixed(1)}h
          </Badge>
          <Badge variant="secondary" className="gap-1 text-xs">
            Hours This Month: {summary.hoursThisMonth.toFixed(1)}h
          </Badge>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !records?.records.length ? (
          <p className="py-4 text-center text-sm text-sand-ink">No time clock records found.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm">
                      {formatAttendanceDate(record.clockedInAt)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {new Date(record.clockedInAt).toLocaleTimeString('en-LK', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {record.clockedOutAt
                        ? new Date(record.clockedOutAt).toLocaleTimeString('en-LK', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.durationMinutes !== null ? formatMinutes(record.durationMinutes) : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {record.shift ? (
                        <span title={shiftReferenceLabel(record.shift).title}>
                          {shiftReferenceLabel(record.shift).label}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-sand-ink">
                      {record.notes ?? '-'}
                    </TableCell>
                    <TableCell>
                      {record.clockedOutAt ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {records.totalPages > 1 && (
              <div className="flex justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                >
                  Previous
                </Button>
                <span className="self-center text-sm text-sand-ink">
                  Page {page} of {records.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= records.totalPages}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
