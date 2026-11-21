import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';
import {
  getPayrollRun,
  getPayrollRunPaymentInfo,
} from '@/lib/services/payroll.service';
import { readPayrollSettingsFromTenantSettings } from '@/lib/payroll/payroll-settings';
import type { BankSheetRow } from '@/lib/payroll/bank-sheet';
import type { StatutoryRow } from '@/lib/payroll/statutory-return';
import type { SummaryReportItem, SummaryReportTotals } from '@/lib/payroll/summary-report';
import type { PayrollRunPaymentInfo } from '@/lib/payroll/payroll-run-status';
import {
  buildPayrollExportProvenance,
  type PayrollExportProvenance,
} from '@/lib/payroll/export-provenance';
import {
  buildExportPreflight,
  type PayrollExportKind,
  type PayrollExportPreflight,
  type PayrollExportStaffRow,
} from '@/lib/payroll/export-preflight';

export interface PayrollExportContext {
  run: Awaited<ReturnType<typeof getPayrollRun>>;
  companyName: string;
  payrollSettings: ReturnType<typeof readPayrollSettingsFromTenantSettings>;
  generatedAt: Date;
  /** ARGUS #385: derived from the PAYROLL_RUN_PAID audit entry. */
  payment: PayrollRunPaymentInfo;
  /** ARGUS #387: company identity is current, not snapshotted on the run. */
  provenance: PayrollExportProvenance;
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

  const companyName = tenant.name;
  const payrollSettings = readPayrollSettingsFromTenantSettings(tenant.settings);
  const generatedAt = new Date();

  return {
    run,
    companyName,
    payrollSettings,
    generatedAt,
    payment: await getPayrollRunPaymentInfo(tenantId, run.id, run.status),
    provenance: buildPayrollExportProvenance({
      companyName,
      employerEpfNumber: payrollSettings.employerEpfNumber,
      employerEtfNumber: payrollSettings.employerEtfNumber,
      generatedAt,
    }),
  };
}

export function toBankSheetRows(context: PayrollExportContext): BankSheetRow[] {
  return context.run.items.map((item) => ({
    staffName: item.staffName,
    nic: item.nic,
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
    deductionsIncludingEpf: new Decimal(run.totalDeductions)
      .add(run.totalEmployeeEpf)
      .toFixed(2),
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

/** Staff details needed by the bank sheet / C-form / ETF return checks. */
export function toPreflightStaff(context: PayrollExportContext): PayrollExportStaffRow[] {
  return context.run.items.map((item) => ({
    staffName: item.staffName,
    bankName: item.bankName,
    bankAccountNumber: item.bankAccountNumber,
    nic: item.nic,
    epfNumber: item.epfNumber,
    etfNumber: item.etfNumber,
  }));
}

/**
 * ARGUS #378: completeness gate for one export. `summary` has no required
 * staff identity fields, so it is always complete.
 */
export function buildPayrollExportPreflight(
  context: PayrollExportContext,
  kind: PayrollExportKind,
): PayrollExportPreflight {
  return buildExportPreflight({
    kind,
    staff: toPreflightStaff(context),
    employerEpfNumber: context.payrollSettings.employerEpfNumber,
    employerEtfNumber: context.payrollSettings.employerEtfNumber,
  });
}

export type PayrollExportPreflights = Record<PayrollExportKind, PayrollExportPreflight>;

export function buildPayrollExportPreflights(
  context: PayrollExportContext,
): PayrollExportPreflights {
  return {
    'bank-sheet': buildPayrollExportPreflight(context, 'bank-sheet'),
    statutory: buildPayrollExportPreflight(context, 'statutory'),
    summary: buildPayrollExportPreflight(context, 'summary'),
  };
}

/** Download links may explicitly override a flagged (incomplete) export. */
export function allowsIncompleteExport(value: string | null): boolean {
  return value === '1' || value === 'true';
}
