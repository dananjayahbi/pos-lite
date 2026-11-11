import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { generatePayrollPayslipPdf } from '@/lib/payroll/payslip-pdf';

type PayrollRunWithItems = Awaited<
  ReturnType<typeof import('@/lib/services/payroll.service').getPayrollRun>
>;

function tenantDetails(settings: unknown): { address: string; phone: string } {
  const source =
    typeof settings === 'object' && settings !== null
      ? (settings as Record<string, unknown>)
      : {};
  return {
    address: typeof source.address === 'string' ? source.address : '',
    phone: typeof source.phoneNumber === 'string' ? source.phoneNumber : '',
  };
}

function periodLabel(periodStart: Date): string {
  return periodStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** Build the branded PDF for one payroll item, resolving tenant branding. */
export async function buildPayrollPayslip(
  tenantId: string,
  run: PayrollRunWithItems,
  userId: string,
): Promise<{ pdf: Buffer; item: PayrollRunWithItems['items'][number] }> {
  const item = run.items.find((row) => row.userId === userId);
  if (!item) throw ApiError.notFound('Payslip not found');

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { name: true, logoUrl: true, settings: true },
  });
  const details = tenantDetails(tenant.settings);

  const pdf = await generatePayrollPayslipPdf({
    company: {
      name: tenant.name,
      address: details.address,
      phone: details.phone,
      logoUrl: tenant.logoUrl,
    },
    periodLabel: periodLabel(new Date(run.periodStart)),
    periodMonth: run.periodMonth,
    rates: {
      employeeEpf: Number(run.employeeEpfRate),
      employerEpf: Number(run.employerEpfRate),
      employerEtf: Number(run.employerEtfRate),
    },
    item: {
      staffName: item.staffName,
      staffEmail: item.staffEmail,
      role: item.role,
      nic: item.nic,
      bankName: item.bankName,
      bankBranch: item.bankBranch,
      bankAccountNumber: item.bankAccountNumber,
      epfNumber: item.epfNumber,
      etfNumber: item.etfNumber,
      basicSalary: item.basicSalary.toString(),
      allowances: item.allowances.toString(),
      overtimeMinutes: item.overtimeMinutes,
      overtimeAmount: item.overtimeAmount.toString(),
      commissionAmount: item.commissionAmount.toString(),
      grossSalary: item.grossSalary.toString(),
      noPayDays: item.noPayDays.toString(),
      noPayDeduction: item.noPayDeduction.toString(),
      advanceDeduction: item.advanceDeduction.toString(),
      totalDeductions: item.totalDeductions.toString(),
      employeeEpf: item.employeeEpf.toString(),
      employerEpf: item.employerEpf.toString(),
      employerEtf: item.employerEtf.toString(),
      netSalary: item.netSalary.toString(),
    },
    generatedAt: new Date(),
  });

  return { pdf, item };
}

export function payslipFilename(periodMonth: string, staffName: string): string {
  const safeName = staffName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  return `payslip-${periodMonth}-${safeName || 'staff'}.pdf`;
}
