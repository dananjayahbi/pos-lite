import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import { getStaffAttendanceReport } from '@/lib/services/timeclock.service';
import {
  resolveAttendanceMonth,
  formatMinutesAsHm,
} from '@/lib/utils/attendance-period';
import { toCsv, csvDownloadResponse, type CsvColumn } from '@/lib/export';
import { toErrorResponse } from '@/lib/api/error-envelope';
import type { StaffAttendanceReportRow } from '@/lib/services/timeclock.service';

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LEAVE: 'Leave',
  HALF_DAY: 'Half Day',
  HOLIDAY: 'Holiday',
};

function timeLabel(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Download one staff member's attendance for a month as CSV. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    if (
      id !== session.user.id &&
      !hasPermission(session.user, PERMISSIONS.STAFF.viewStaff)
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const target = await prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { email: true },
    });
    if (!target) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Staff member not found' } },
        { status: 404 },
      );
    }

    const range = resolveAttendanceMonth(request.nextUrl.searchParams.get('month'));
    const report = await getStaffAttendanceReport(tenantId, id, range.from, range.to);

    const columns: CsvColumn<StaffAttendanceReportRow>[] = [
      { header: 'Date', value: (row) => row.date },
      { header: 'Clock In', value: (row) => timeLabel(row.clockInAt) },
      { header: 'Clock Out', value: (row) => timeLabel(row.clockOutAt) },
      { header: 'Worked', value: (row) => formatMinutesAsHm(row.totalMinutes) },
      { header: 'Regular', value: (row) => formatMinutesAsHm(row.regularMinutes) },
      { header: 'Overtime', value: (row) => formatMinutesAsHm(row.overtimeMinutes) },
      { header: 'Status', value: (row) => STATUS_LABEL[row.status] ?? row.status },
      { header: 'Punches', value: (row) => row.punches },
      { header: 'Notes', value: (row) => row.notes ?? '' },
    ];

    const csv = toCsv(columns, report.rows);
    const emailLocal =
      target.email.split('@')[0]?.replace(/[^a-z0-9]+/gi, '-') || 'staff';
    return csvDownloadResponse(csv, `attendance-${emailLocal}-${range.month}.csv`);
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/staff/[id]/attendance/export');
  }
}
