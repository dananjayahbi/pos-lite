import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import { ok, toErrorResponse, unauthorized } from '@/lib/api/error-envelope';
import { getPayrollRun, markPayslipEmailed } from '@/lib/services/payroll.service';
import { buildPayrollPayslip, payslipFilename } from '@/lib/services/payroll-payslip.service';
import { sendEmail } from '@/lib/services/email.service';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/services/audit.service';
import { formatRupee } from '@/lib/format';

/** Email one employee their branded payslip PDF. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Authentication required');

    const tenantId = session.user.tenantId;
    if (!tenantId) return unauthorized('No tenant associated');
    if (!hasPermission(session.user, PERMISSIONS.PAYROLL.runPayroll)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id, userId } = await params;
    const run = await getPayrollRun(tenantId, id);
    const { pdf, item } = await buildPayrollPayslip(tenantId, run, userId);

    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true },
    });

    const html = `
      <div style="font-family: Inter, Arial, sans-serif; color: #1A1210; line-height: 1.6;">
        <h2 style="font-family: 'Playfair Display', Georgia, serif; color: #3A2D28;">
          ${tenant.name} — Payslip
        </h2>
        <p>Dear ${item.staffName},</p>
        <p>Your payslip for <strong>${run.periodMonth}</strong> is attached.</p>
        <p>
          Gross salary: <strong>${formatRupee(item.grossSalary.toString())}</strong><br />
          Total deductions: <strong>${formatRupee(item.totalDeductions.toString())}</strong><br />
          Employee EPF (8%): <strong>${formatRupee(item.employeeEpf.toString())}</strong><br />
          Net salary: <strong>${formatRupee(item.netSalary.toString())}</strong>
        </p>
        <p>If you have any questions about this payslip, please contact the accounts department.</p>
        <p style="color:#6B5B5B;font-size:12px;">This is a system-generated email from ${tenant.name}.</p>
      </div>
    `;

    const result = await sendEmail(
      item.staffEmail,
      `Payslip — ${run.periodMonth} — ${tenant.name}`,
      html,
      {
        text: `Payslip for ${run.periodMonth}. Net salary: ${formatRupee(
          item.netSalary.toString(),
        )}.`,
        attachments: [
          {
            filename: payslipFilename(run.periodMonth, item.staffName),
            content: pdf,
            contentType: 'application/pdf',
          },
        ],
      },
    );

    const status = result.delivered
      ? 'SENT'
      : result.reason === 'provider-not-configured'
        ? 'NOT_CONFIGURED'
        : 'FAILED';
    await markPayslipEmailed(tenantId, run.id, item.userId, status);

    if (result.delivered) {
      await createAuditLog({
        tenantId,
        actorId: session.user.id,
        actorRole: session.user.role ?? 'UNKNOWN',
        entityType: 'PayrollItem',
        entityId: item.id,
        action: AUDIT_ACTIONS.PAYROLL_PAYSLIP_EMAILED,
        after: { runId: run.id, userId: item.userId, email: item.staffEmail },
      });
    }

    return ok({
      delivered: result.delivered,
      reason: result.reason ?? null,
      status,
    });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/payroll/runs/[id]/payslips/[userId]/email');
  }
}
