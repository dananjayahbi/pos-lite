import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import { getStaffAttendanceReport } from '@/lib/services/timeclock.service';
import { getCommissionSummaryForUser } from '@/lib/services/commission.service';
import { resolveAttendanceMonth } from '@/lib/utils/attendance-period';
import { generatePayslipPdf } from '@/lib/staff/payslip-pdf';
import { staffDisplayName } from '@/lib/utils/staff-name';
import { toErrorResponse } from '@/lib/api/error-envelope';

/** Download a staff member's attendance + commission payslip for a month. */
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

    const staff = await prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: {
        email: true,
        fullName: true,
        role: true,
        commissionRate: true,
        tenant: { select: { name: true } },
      },
    });
    if (!staff) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Staff member not found' } },
        { status: 404 },
      );
    }

    const range = resolveAttendanceMonth(request.nextUrl.searchParams.get('month'));
    const [report, commission] = await Promise.all([
      getStaffAttendanceReport(tenantId, id, range.from, range.to),
      getCommissionSummaryForUser(tenantId, id, range.periodStart, range.periodEnd),
    ]);

    const pdf = generatePayslipPdf({
      businessName: staff.tenant?.name ?? 'AyurPOS',
      staffName: staff.fullName?.trim() || staffDisplayName(staff.email),
      email: staff.email,
      role: staff.role.replace(/_/g, ' '),
      periodLabel: range.label,
      attendance: {
        daysPresent: report.daysPresent,
        daysAbsent: report.daysAbsent,
        daysLeave: report.daysLeave,
        daysHalfDay: report.daysHalfDay,
        daysHoliday: report.daysHoliday,
        totalMinutes: report.totalMinutes,
        regularMinutes: report.regularMinutes,
        overtimeMinutes: report.overtimeMinutes,
      },
      commission,
    });

    const emailLocal =
      staff.email.split('@')[0]?.replace(/[^a-z0-9]+/gi, '-') || 'staff';
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="payslip-${emailLocal}-${range.month}.pdf"`,
        'Content-Length': String(pdf.byteLength),
      },
    });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/staff/[id]/payslip');
  }
}
