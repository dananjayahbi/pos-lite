import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getDailyAttendance } from '@/lib/services/timeclock.service';
import { resolveAttendanceDateRange } from '@/lib/attendance/attendanceRange.core';
import { toCsv, csvDownloadResponse, type CsvColumn } from '@/lib/export';
import { toErrorResponse } from '@/lib/api/error-envelope';

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LEAVE: 'Leave',
  HALF_DAY: 'Half Day',
  HOLIDAY: 'Holiday',
  OFF: 'Off',
  SCHEDULED: 'Scheduled',
  INSUFFICIENT: 'Insufficient hours',
};

interface ExportRow {
  date: string;
  staffName: string;
  email: string;
  role: string;
  status: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  punches: number;
  needsReview: boolean;
  notes: string | null;
}

function timeLabel(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

/**
 * ARGUS #359: tenant-wide attendance CSV for a bounded date range.
 * The staff detail page only exported one person's month.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }
    if (!hasPermission(session.user, PERMISSIONS.STAFF.viewAttendance)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const params = request.nextUrl.searchParams;
    const range = resolveAttendanceDateRange({
      from: params.get('from'),
      to: params.get('to'),
      fallback: params.get('date'),
    });
    if (!range.ok) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: range.message } },
        { status: 400 },
      );
    }

    const rows: ExportRow[] = [];
    for (const date of range.dates) {
      const day = await getDailyAttendance(tenantId, date);
      for (const member of day.staff) {
        rows.push({
          date,
          staffName: member.fullName ?? member.email,
          email: member.email,
          role: member.role,
          status: STATUS_LABEL[member.status] ?? member.status,
          clockInAt: member.clockInAt,
          clockOutAt: member.clockOutAt,
          totalMinutes: member.totalMinutes,
          regularMinutes: member.regularMinutes,
          overtimeMinutes: member.overtimeMinutes,
          punches: member.records.length,
          needsReview: member.needsReview,
          notes:
            member.records
              .map((record) => record.notes)
              .filter((note): note is string => Boolean(note))
              .join(' | ') || null,
        });
      }
    }

    const columns: CsvColumn<ExportRow>[] = [
      { header: 'Date', value: (row) => row.date },
      { header: 'Staff', value: (row) => row.staffName },
      { header: 'Email', value: (row) => row.email },
      { header: 'Role', value: (row) => row.role },
      { header: 'Status', value: (row) => row.status },
      { header: 'Clock In', value: (row) => timeLabel(row.clockInAt) },
      { header: 'Clock Out', value: (row) => timeLabel(row.clockOutAt) },
      { header: 'Worked', value: (row) => hours(row.totalMinutes) },
      { header: 'Regular', value: (row) => hours(row.regularMinutes) },
      { header: 'Overtime', value: (row) => hours(row.overtimeMinutes) },
      { header: 'Punches', value: (row) => String(row.punches) },
      { header: 'Needs Review', value: (row) => (row.needsReview ? 'Yes' : '') },
      { header: 'Notes', value: (row) => row.notes ?? '' },
    ];

    const csv = toCsv(columns, rows);
    return csvDownloadResponse(
      csv,
      range.from === range.to
        ? `attendance-${range.from}.csv`
        : `attendance-${range.from}-to-${range.to}.csv`,
    );
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/timeclock/attendance/export');
  }
}
