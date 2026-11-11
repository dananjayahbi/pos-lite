'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Pencil, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { staffDisplayName } from '@/lib/utils/staff-name';
import {
  AttendanceStatusDialog,
  type AttendanceStatusValue,
} from '@/components/staff/AttendanceStatusDialog';
import { AttendanceAdjustDialog } from '@/components/staff/AttendanceAdjustDialog';

interface AttendanceRecord {
  id: string;
  clockedInAt: string;
  clockedOutAt: string | null;
  notes: string | null;
  durationMinutes: number;
  isOpen: boolean;
}

interface AttendanceRow {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  status: AttendanceStatusValue;
  clockInAt: string | null;
  clockOutAt: string | null;
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  records: AttendanceRecord[];
  attendance: { id: string; status: AttendanceStatusValue; notes: string | null } | null;
}

interface AttendanceResponse {
  date: string;
  standardWorkdayMinutes: number;
  staff: AttendanceRow[];
}

const STATUS_LABEL: Record<AttendanceStatusValue, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LEAVE: 'Leave',
  HALF_DAY: 'Half Day',
  HOLIDAY: 'Holiday',
};

const STATUS_CLASS: Record<AttendanceStatusValue, string> = {
  PRESENT: 'border border-green-200 bg-green-100 text-green-800',
  ABSENT: 'border border-red-200 bg-red-100 text-red-800',
  LEAVE: 'border border-amber-200 bg-amber-100 text-amber-800',
  HALF_DAY: 'border border-blue-200 bg-blue-100 text-blue-800',
  HOLIDAY: 'border border-slate-200 bg-slate-100 text-slate-700',
};

function todayYmd(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-LK', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
}

function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function TimeclockPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canManage =
    !permissionsLoading && hasPermission(PERMISSIONS.STAFF.manageAttendance);

  const [date, setDate] = useState(todayYmd());
  const [adjustRow, setAdjustRow] = useState<AttendanceRow | null>(null);
  const [statusRow, setStatusRow] = useState<AttendanceRow | null>(null);

  const { data, isLoading, error } = useQuery<{
    success: boolean;
    data: AttendanceResponse;
  }>({
    queryKey: ['attendance', date],
    queryFn: async () => {
      const res = await fetch(
        `/api/store/timeclock/attendance?date=${encodeURIComponent(date)}`,
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to load attendance');
      }
      return json;
    },
  });

  const rows = useMemo(() => data?.data?.staff ?? [], [data]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (row.status === 'PRESENT') acc.present += 1;
        else if (row.status === 'ABSENT') acc.absent += 1;
        else if (row.status === 'LEAVE') acc.onLeave += 1;
        else if (row.status === 'HALF_DAY') acc.halfDay += 1;
        acc.overtimeMinutes += row.overtimeMinutes;
        return acc;
      },
      { present: 0, absent: 0, onLeave: 0, halfDay: 0, overtimeMinutes: 0 },
    );
  }, [rows]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['timeclock-me'] });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Attendance</h1>
        <p className="mt-1 text-sm text-sand-ink">
          Daily clock times, attendance status and overtime for every staff member.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <Label htmlFor="attendance-date" className="font-body text-sm text-sand-ink">
              Date
            </Label>
            <Input
              id="attendance-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1 w-44 border-mist"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-mist text-espresso"
            onClick={() => setDate(todayYmd())}
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Today
          </Button>
          <p className="pb-2 text-xs text-sand-ink">
            Standard workday: 8h. Time beyond 8h is shown separately as OT.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-sand-ink">Present</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold text-green-700">{summary.present}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-sand-ink">Absent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold text-red-700">{summary.absent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-sand-ink">On Leave / Half Day</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold text-amber-700">
              {summary.onLeave + summary.halfDay}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-sand-ink">Overtime Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold text-terracotta">
              {formatMinutes(summary.overtimeMinutes)}
            </p>
          </CardContent>
        </Card>
      </div>

      <ErrorBoundary>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-sm text-[#9B2226]">
              {error instanceof Error ? error.message : 'Failed to load attendance'}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-espresso">All Staff Attendance</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-linen/40">
                    <TableHead className="text-espresso">Staff</TableHead>
                    <TableHead className="text-espresso">Role</TableHead>
                    <TableHead className="text-espresso">Status</TableHead>
                    <TableHead className="text-espresso">Clock In</TableHead>
                    <TableHead className="text-espresso">Clock Out</TableHead>
                    <TableHead className="text-right text-espresso">Worked</TableHead>
                    <TableHead className="text-right text-espresso">OT</TableHead>
                    <TableHead className="text-right text-espresso">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sand-ink">
                        No active staff found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const hasOpenPunch = row.records.some((record) => record.isOpen);
                      return (
                        <TableRow key={row.userId} className="hover:bg-linen/20">
                          <TableCell>
                            <p className="font-medium text-espresso">
                              {row.fullName ?? staffDisplayName(row.email)}
                            </p>
                            <p className="text-xs text-sand-ink">{row.email}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {roleLabel(row.role)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${STATUS_CLASS[row.status]}`}>
                              {STATUS_LABEL[row.status]}
                            </Badge>
                            {hasOpenPunch && (
                              <Badge className="ml-1 border border-amber-200 bg-amber-50 text-xs text-amber-700">
                                Active
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {row.clockInAt ? formatTime(row.clockInAt) : '—'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {row.clockOutAt ? formatTime(row.clockOutAt) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {row.totalMinutes > 0 ? formatMinutes(row.totalMinutes) : '—'}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono text-sm ${
                              row.overtimeMinutes > 0 ? 'font-semibold text-terracotta' : 'text-sand-ink'
                            }`}
                          >
                            {row.overtimeMinutes > 0
                              ? `+${formatMinutes(row.overtimeMinutes)}`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {canManage ? (
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-espresso"
                                  disabled={row.records.length === 0}
                                  onClick={() => setAdjustRow(row)}
                                >
                                  <Pencil className="mr-1 h-3.5 w-3.5" />
                                  Adjust
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-espresso"
                                  onClick={() => setStatusRow(row)}
                                >
                                  <Settings2 className="mr-1 h-3.5 w-3.5" />
                                  Status
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-sand-ink">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </ErrorBoundary>

      <AttendanceAdjustDialog
        open={adjustRow !== null}
        onOpenChange={(open) => {
          if (!open) setAdjustRow(null);
        }}
        row={adjustRow}
        date={date}
        onSaved={invalidate}
      />

      <AttendanceStatusDialog
        open={statusRow !== null}
        onOpenChange={(open) => {
          if (!open) setStatusRow(null);
        }}
        row={statusRow}
        date={date}
        onSaved={invalidate}
      />
    </div>
  );
}
