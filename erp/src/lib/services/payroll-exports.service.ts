import { prisma } from '@/lib/prisma';
import { getPayrollRun } from '@/lib/services/payroll.service';
import { readPayrollSettingsFromTenantSettings } from '@/lib/payroll/payroll-settings';
import type { BankSheetRow } from '@/lib/payroll/bank-sheet';
import type { StatutoryRow } from '@/lib/payroll/statutory-return';
import type { SummaryReportItem, SummaryReportTotals } from '@/lib/payroll/summary-report';

export interface PayrollExportContext {
  run: Awaited<ReturnType<typeof getPayrollRun>>;
  companyName: string;
  payrollSettings: ReturnType<typeof readPayrollSettingsFromTenantSettings>;
  generatedAt: Date;
}

export async function getPayrollExportContext(
  tenantId: string,
  runId: string,
): Promise<PayrollExportContext> {
  const [run, tenant] = await Promise.all([
    getPayrollRun(tenantId, runId),
    prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true, settings: true },
    }),
  ]);

  return {
    run,
    companyName: tenant.name,
    payrollSettings: readPayrollSettingsFromTenantSettings(tenant.settings),
    generatedAt: new Date(),
  };
}

export function toBankSheetRows(context: PayrollExportContext): BankSheetRow[] {
  return context.run.items.map((item) => ({
    staffName: item.staffName,
    bankName: item.bankName,
    bankBranch: item.bankBranch,
    bankAccountNumber: item.bankAccountNumber,
    netSalary: item.netSalary.toString(),
  }));
}

export function toStatutoryRows(context: PayrollExportContext): StatutoryRow[] {
  return context.run.items.map((item) => ({
    staffName: item.staffName,
    nic: item.nic,
    epfNumber: item.epfNumber,
    etfNumber: item.etfNumber,
    grossSalary: item.grossSalary.toString(),
    employeeEpf: item.employeeEpf.toString(),
    employerEpf: item.employerEpf.toString(),
    employerEtf: item.employerEtf.toString(),
  }));
}

export function toSummaryItems(context: PayrollExportContext): SummaryReportItem[] {
  return context.run.items.map((item) => ({
    staffName: item.staffName,
    role: item.role,
    basicSalary: item.basicSalary.toString(),
    allowances: item.allowances.toString(),
    overtimeAmount: item.overtimeAmount.toString(),
    commissionAmount: item.commissionAmount.toString(),
    grossSalary: item.grossSalary.toString(),
    totalDeductions: item.totalDeductions.toString(),
    employeeEpf: item.employeeEpf.toString(),
    netSalary: item.netSalary.toString(),
  }));
}

export function summaryTotals(context: PayrollExportContext): SummaryReportTotals {
  const { run } = context;
  return {
    headcount: run.items.length,
    basic: run.totalBasic.toString(),
    allowances: run.totalAllowances.toString(),
    overtime: run.totalOvertime.toString(),
    commission: run.totalCommission.toString(),
    gross: run.totalGross.toString(),
    deductions: run.totalDeductions.toString(),
    employeeEpf: run.totalEmployeeEpf.toString(),
    employerEpf: run.totalEmployerEpf.toString(),
    employerEtf: run.totalEmployerEtf.toString(),
    net: run.totalNet.toString(),
    companyCost: run.totalCompanyCost.toString(),
  };
}

export function periodLabel(periodStart: Date): string {
  return periodStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function formatExtension(value: string | null): 'xlsx' | 'pdf' {
  return value === 'xlsx' ? 'xlsx' : 'pdf';
}
