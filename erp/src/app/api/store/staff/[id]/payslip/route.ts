import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import { getStaffAttendanceReport } from '@/lib/services/timeclock.service';
import { getCommissionSummaryForUser } from '@/lib/services/commission.service';
import { tenantDetails } from '@/lib/services/payroll-payslip.service';
import { resolveAttendanceMonth } from '@/lib/utils/attendance-period';
import { generatePayslipPdf } from '@/lib/staff/payslip-pdf';
import { generatePayrollPayslipPdf } from '@/lib/payroll/payslip-pdf';
import {
  PAYROLL_STATUTORY_RATES,
  countWeekdaysInMonth,
  deriveNoPayDays,
} from '@/lib/payroll/calculations';
import { readPayrollSettingsFromTenantSettings, resolveWorkingDays } from '@/lib/payroll/payroll-settings';
import { buildPayslipSummary } from '@/lib/payroll/payslip-summary';
import { staffDisplayName } from '@/lib/utils/staff-name';
import { toErrorResponse } from '@/lib/api/error-envelope';

/**
 * Download a staff member's document for a month.
 *
 * With a configured salary this is a real payslip (basic salary, allowances,
 * overtime, unpaid commission, EPF/ETF and net pay) built with the shared
 * payroll calculator. Without a salary it is explicitly labelled an
 * Attendance & Commission Statement instead of a payslip claiming a payable
 * total (ARGUS #338).
 */
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
        nic: true,
        basicSalary: true,
        allowances: true,
        bankName: true,
        bankBranch: true,
        bankAccountNumber: true,
        epfNumber: true,
        etfNumber: true,
        tenant: { select: { name: true, logoUrl: true, settings: true } },
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

    // Same tenant payroll settings the payroll run uses, so a payslip taken
    // from the staff page matches the month's generated run.
    const settings = readPayrollSettingsFromTenantSettings(staff.tenant?.settings);
    const workingDays = resolveWorkingDays(settings, countWeekdaysInMonth(range.month));

    const summary = buildPayslipSummary({
      basicSalary: staff.basicSalary ?? 0,
      allowances: staff.allowances ?? 0,
      overtimeMinutes: report.overtimeMinutes,
      workingDays,
      overtimeMultiplier: settings.overtimeMultiplier,
      commission,
      noPayDays: deriveNoPayDays(report.daysAbsent, report.daysHalfDay),
    });

    const staffName = staff.fullName?.trim() || staffDisplayName(staff.email);
    const businessName = staff.tenant?.name ?? 'AyurPOS';
    const role = staff.role.replace(/_/g, ' ');

    let pdf: Buffer;
    let filePrefix: string;

    if (summary.documentKind === 'PAYSLIP' && summary.payroll) {
      const details = tenantDetails(staff.tenant?.settings);
      const payroll = summary.payroll;
      pdf = await generatePayrollPayslipPdf({
        company: {
          name: businessName,
          address: details.address,
          phone: details.phone,
          logoUrl: staff.tenant?.logoUrl ?? null,
        },
        periodLabel: range.label,
        periodMonth: range.month,
        rates: {
          employeeEpf: PAYROLL_STATUTORY_RATES.employeeEpf,
          employerEpf: PAYROLL_STATUTORY_RATES.employerEpf,
          employerEtf: PAYROLL_STATUTORY_RATES.employerEtf,
        },
        item: {
          staffName,
          staffEmail: staff.email,
          role,
          nic: staff.nic,
          bankName: staff.bankName,
          bankBranch: staff.bankBranch,
          bankAccountNumber: staff.bankAccountNumber,
          epfNumber: staff.epfNumber,
          etfNumber: staff.etfNumber,
          basicSalary: payroll.basicSalary,
          allowances: payroll.allowances,
          overtimeMinutes: payroll.overtimeMinutes,
          overtimeAmount: payroll.overtimeAmount,
          commissionAmount: payroll.commissionAmount,
          grossSalary: payroll.grossSalary,
          noPayDays: payroll.noPayDays,
          noPayDeduction: payroll.noPayDeduction,
          advanceDeduction: payroll.advanceDeduction,
          totalDeductions: payroll.totalDeductions,
          employeeEpf: payroll.employeeEpf,
          employerEpf: payroll.employerEpf,
          employerEtf: payroll.employerEtf,
          netSalary: payroll.netSalary,
        },
        generatedAt: new Date(),
      });
      filePrefix = 'payslip';
    } else {
      pdf = generatePayslipPdf({
        businessName,
        staffName,
        email: staff.email,
        role,
        periodLabel: range.label,
        title: summary.title,
        footerNote: summary.footerNote,
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
        commission: summary.commission,
      });
      filePrefix = 'statement';
    }

    const emailLocal =
      staff.email.split('@')[0]?.replace(/[^a-z0-9]+/gi, '-') || 'staff';
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filePrefix}-${emailLocal}-${range.month}.pdf"`,
        'Content-Length': String(pdf.byteLength),
      },
    });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/staff/[id]/payslip');
  }
}
