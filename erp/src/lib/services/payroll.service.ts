import Decimal from 'decimal.js';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { resolveAttendanceMonth } from '@/lib/utils/attendance-period';
import { staffDisplayName } from '@/lib/utils/staff-name';
import { getStaffAttendanceReport } from '@/lib/services/timeclock.service';
import { getCommissionSummaryForUser } from '@/lib/services/commission.service';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/services/audit.service';
import {
  PAYROLL_STATUTORY_RATES,
  calculatePayroll,
  countWeekdaysInMonth,
  deriveNoPayDays,
  moneyString,
} from '@/lib/payroll/calculations';
import {
  PAYROLL_SETTINGS_STORAGE_KEY,
  readPayrollSettingsFromTenantSettings,
  resolveWorkingDays,
  type PayrollSettings,
} from '@/lib/payroll/payroll-settings';
import type {
  PayrollPreview,
  PayrollPreviewRow,
  PayrollRowOverride,
} from '@/lib/payroll/types';

export type { PayrollPreview, PayrollPreviewRow, PayrollRowOverride };

function roleLabel(role: string): string {
  return role.replace(/_/g, ' ');
}

function staffLabel(fullName: string | null, email: string): string {
  return fullName?.trim() || staffDisplayName(email);
}

/**
 * Build the month's payroll rows from live staff, attendance and commission
 * data. This is the single source of truth for both the preview and the
 * generated run; the client may only override no-pay days and advances.
 */
export async function buildPayrollPreview(
  tenantId: string,
  month: string | null | undefined,
  overrides: PayrollRowOverride[] = [],
): Promise<PayrollPreview> {
  const range = resolveAttendanceMonth(month);

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = readPayrollSettingsFromTenantSettings(tenant.settings);
  const workingDays = resolveWorkingDays(settings, countWeekdaysInMonth(range.month));

  const [staff, existingRun] = await Promise.all([
    prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        role: { not: 'SUPER_ADMIN' },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        nic: true,
        basicSalary: true,
        allowances: true,
        bankName: true,
        bankBranch: true,
        bankAccountNumber: true,
        epfNumber: true,
        etfNumber: true,
      },
      orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
    }),
    prisma.payrollRun.findUnique({
      where: { tenantId_periodMonth: { tenantId, periodMonth: range.month } },
      select: { id: true },
    }),
  ]);

  const overrideByUser = new Map(overrides.map((override) => [override.userId, override]));

  const rows: PayrollPreviewRow[] = await Promise.all(
    staff.map(async (member) => {
      const [attendance, commission] = await Promise.all([
        getStaffAttendanceReport(tenantId, member.id, range.from, range.to),
        getCommissionSummaryForUser(tenantId, member.id, range.periodStart, range.periodEnd),
      ]);

      const override = overrideByUser.get(member.id);
      const derivedNoPayDays = deriveNoPayDays(attendance.daysAbsent, attendance.daysHalfDay);
      const noPayDays =
        override?.noPayDays !== undefined && Number.isFinite(override.noPayDays)
          ? new Decimal(Math.max(0, override.noPayDays)).toDecimalPlaces(1)
          : derivedNoPayDays;
      const advanceDeduction =
        override?.advanceDeduction !== undefined && Number.isFinite(override.advanceDeduction)
          ? new Decimal(Math.max(0, override.advanceDeduction))
          : new Decimal(0);

      const basicSalary = member.basicSalary ?? new Decimal(0);
      const allowances = member.allowances ?? new Decimal(0);

      const computed = calculatePayroll({
        basicSalary,
        allowances,
        overtimeMinutes: attendance.overtimeMinutes,
        overtimeMultiplier: settings.overtimeMultiplier,
        workingDays,
        // Only unpaid commission is paid through payroll, so an earlier
        // standalone commission payout is never paid twice.
        commissionAmount: commission.unpaid,
        noPayDays,
        advanceDeduction,
        employeeEpfRate: PAYROLL_STATUTORY_RATES.employeeEpf,
        employerEpfRate: PAYROLL_STATUTORY_RATES.employerEpf,
        employerEtfRate: PAYROLL_STATUTORY_RATES.employerEtf,
      });

      return {
        userId: member.id,
        staffName: staffLabel(member.fullName, member.email),
        staffEmail: member.email,
        role: roleLabel(member.role),
        nic: member.nic,
        bankName: member.bankName,
        bankBranch: member.bankBranch,
        bankAccountNumber: member.bankAccountNumber,
        epfNumber: member.epfNumber,
        etfNumber: member.etfNumber,
        ...computed,
        hasSalaryConfig:
          (member.basicSalary !== null && member.basicSalary.greaterThan(0)) ||
          (member.allowances !== null && member.allowances.greaterThan(0)),
      };
    }),
  );

  const totals = rows.reduce(
    (acc, row) => ({
      basic: acc.basic.add(row.basicSalary),
      allowances: acc.allowances.add(row.allowances),
      overtime: acc.overtime.add(row.overtimeAmount),
      commission: acc.commission.add(row.commissionAmount),
      gross: acc.gross.add(row.grossSalary),
      deductions: acc.deductions.add(row.totalDeductions),
      employeeEpf: acc.employeeEpf.add(row.employeeEpf),
      employerEpf: acc.employerEpf.add(row.employerEpf),
      employerEtf: acc.employerEtf.add(row.employerEtf),
      net: acc.net.add(row.netSalary),
      companyCost: acc.companyCost.add(row.totalCompanyCost),
    }),
    {
      basic: new Decimal(0),
      allowances: new Decimal(0),
      overtime: new Decimal(0),
      commission: new Decimal(0),
      gross: new Decimal(0),
      deductions: new Decimal(0),
      employeeEpf: new Decimal(0),
      employerEpf: new Decimal(0),
      employerEtf: new Decimal(0),
      net: new Decimal(0),
      companyCost: new Decimal(0),
    },
  );

  return {
    month: range.month,
    label: range.label,
    periodStart: range.periodStart.toISOString(),
    periodEnd: range.periodEnd.toISOString(),
    workingDays,
    overtimeMultiplier: settings.overtimeMultiplier,
    rates: PAYROLL_STATUTORY_RATES,
    alreadyGenerated: Boolean(existingRun),
    runId: existingRun?.id ?? null,
    settings,
    rows,
    totals: {
      basic: moneyString(totals.basic),
      allowances: moneyString(totals.allowances),
      overtime: moneyString(totals.overtime),
      commission: moneyString(totals.commission),
      gross: moneyString(totals.gross),
      deductions: moneyString(totals.deductions),
      employeeEpf: moneyString(totals.employeeEpf),
      employerEpf: moneyString(totals.employerEpf),
      employerEtf: moneyString(totals.employerEtf),
      net: moneyString(totals.net),
      companyCost: moneyString(totals.companyCost),
    },
  };
}

export async function getPayrollPreview(
  tenantId: string,
  month: string | null | undefined,
  overrides: PayrollRowOverride[] = [],
): Promise<PayrollPreview> {
  return buildPayrollPreview(tenantId, month, overrides);
}

export interface GeneratePayrollInput {
  tenantId: string;
  month: string | null | undefined;
  generatedById: string;
  generatedByRole: string;
  overrides?: PayrollRowOverride[] | undefined;
  notes?: string | undefined;
}

export async function generatePayrollRun(input: GeneratePayrollInput) {
  const range = resolveAttendanceMonth(input.month);
  const preview = await buildPayrollPreview(input.tenantId, range.month, input.overrides ?? []);

  if (preview.alreadyGenerated) {
    throw ApiError.conflict(`Payroll for ${preview.label} has already been generated`);
  }
  if (preview.rows.length === 0) {
    throw ApiError.validation('No active staff members to pay');
  }

  const costs = preview.rows.reduce(
    (acc, row) => ({
      basic: acc.basic.add(row.basicSalary),
      allowances: acc.allowances.add(row.allowances),
      overtime: acc.overtime.add(row.overtimeAmount),
      commission: acc.commission.add(row.commissionAmount),
      gross: acc.gross.add(row.grossSalary),
      deductions: acc.deductions.add(row.totalDeductions),
      employeeEpf: acc.employeeEpf.add(row.employeeEpf),
      employerEpf: acc.employerEpf.add(row.employerEpf),
      employerEtf: acc.employerEtf.add(row.employerEtf),
      net: acc.net.add(row.netSalary),
      companyCost: acc.companyCost.add(row.totalCompanyCost),
    }),
    {
      basic: new Decimal(0),
      allowances: new Decimal(0),
      overtime: new Decimal(0),
      commission: new Decimal(0),
      gross: new Decimal(0),
      deductions: new Decimal(0),
      employeeEpf: new Decimal(0),
      employerEpf: new Decimal(0),
      employerEtf: new Decimal(0),
      net: new Decimal(0),
      companyCost: new Decimal(0),
    },
  );

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.payrollRun.create({
      data: {
        tenantId: input.tenantId,
        periodMonth: preview.month,
        periodStart: new Date(preview.periodStart),
        periodEnd: new Date(preview.periodEnd),
        workingDays: preview.workingDays,
        overtimeMultiplier: new Decimal(preview.overtimeMultiplier),
        employeeEpfRate: new Decimal(PAYROLL_STATUTORY_RATES.employeeEpf),
        employerEpfRate: new Decimal(PAYROLL_STATUTORY_RATES.employerEpf),
        employerEtfRate: new Decimal(PAYROLL_STATUTORY_RATES.employerEtf),
        totalBasic: costs.basic,
        totalAllowances: costs.allowances,
        totalOvertime: costs.overtime,
        totalCommission: costs.commission,
        totalGross: costs.gross,
        totalDeductions: costs.deductions,
        totalEmployeeEpf: costs.employeeEpf,
        totalEmployerEpf: costs.employerEpf,
        totalEmployerEtf: costs.employerEtf,
        totalNet: costs.net,
        totalCompanyCost: costs.companyCost,
        generatedById: input.generatedById,
        notes: input.notes?.trim() || null,
        items: {
          create: preview.rows.map((row) => ({
            tenantId: input.tenantId,
            userId: row.userId,
            staffName: row.staffName,
            staffEmail: row.staffEmail,
            role: row.role,
            nic: row.nic,
            bankName: row.bankName,
            bankBranch: row.bankBranch,
            bankAccountNumber: row.bankAccountNumber,
            epfNumber: row.epfNumber,
            etfNumber: row.etfNumber,
            basicSalary: new Decimal(row.basicSalary),
            allowances: new Decimal(row.allowances),
            overtimeMinutes: row.overtimeMinutes,
            overtimeAmount: new Decimal(row.overtimeAmount),
            commissionAmount: new Decimal(row.commissionAmount),
            grossSalary: new Decimal(row.grossSalary),
            noPayDays: new Decimal(row.noPayDays),
            noPayDeduction: new Decimal(row.noPayDeduction),
            advanceDeduction: new Decimal(row.advanceDeduction),
            totalDeductions: new Decimal(row.totalDeductions),
            employeeEpf: new Decimal(row.employeeEpf),
            employerEpf: new Decimal(row.employerEpf),
            employerEtf: new Decimal(row.employerEtf),
            netSalary: new Decimal(row.netSalary),
          })),
        },
      },
      include: { items: true },
    });

    // Consume the unpaid commission records included in this payroll so the
    // standalone Staff Commissions page cannot pay the same sale twice.
    for (const row of preview.rows) {
      if (new Decimal(row.commissionAmount).lte(0)) continue;

      const unpaid = await tx.commissionRecord.findMany({
        where: {
          tenantId: input.tenantId,
          userId: row.userId,
          isPaid: false,
          createdAt: { gte: new Date(preview.periodStart), lte: new Date(preview.periodEnd) },
        },
        select: { id: true, earnedAmount: true, paidAmount: true },
      });
      if (unpaid.length === 0) continue;

      const total = unpaid.reduce(
        (sum, record) =>
          sum.add(
            new Decimal(record.earnedAmount.toString()).minus(
              new Decimal(record.paidAmount.toString()),
            ),
          ),
        new Decimal(0),
      );
      if (total.lte(0)) continue;

      const payout = await tx.commissionPayout.create({
        data: {
          tenantId: input.tenantId,
          userId: row.userId,
          periodStart: new Date(preview.periodStart),
          periodEnd: new Date(preview.periodEnd),
          totalEarned: total,
          authorizedById: input.generatedById,
          notes: JSON.stringify({ note: `Included in ${preview.label} payroll` }),
        },
      });
      for (const record of unpaid) {
        await tx.commissionRecord.update({
          where: { id: record.id },
          data: {
            paidAmount: record.earnedAmount,
            isPaid: true,
            payoutId: payout.id,
          },
        });
      }
    }

    return created;
  });

  await createAuditLog({
    tenantId: input.tenantId,
    actorId: input.generatedById,
    actorRole: input.generatedByRole,
    entityType: 'PayrollRun',
    entityId: run.id,
    action: AUDIT_ACTIONS.PAYROLL_RUN_GENERATED,
    after: {
      runId: run.id,
      periodMonth: run.periodMonth,
      itemCount: run.items.length,
      totalGross: run.totalGross.toString(),
      totalNet: run.totalNet.toString(),
      totalCompanyCost: run.totalCompanyCost.toString(),
    },
  });

  return getPayrollRun(input.tenantId, run.id);
}

export async function getPayrollRun(tenantId: string, runId: string) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, tenantId },
    include: {
      items: { orderBy: [{ staffName: 'asc' }] },
    },
  });
  if (!run) throw ApiError.notFound('Payroll run not found');
  return run;
}

export async function getPayrollRunForMonth(tenantId: string, month: string) {
  const range = resolveAttendanceMonth(month);
  return prisma.payrollRun.findUnique({
    where: { tenantId_periodMonth: { tenantId, periodMonth: range.month } },
    include: { items: { orderBy: [{ staffName: 'asc' }] } },
  });
}

export async function listPayrollRuns(tenantId: string, limit = 24) {
  return prisma.payrollRun.findMany({
    where: { tenantId },
    orderBy: [{ periodMonth: 'desc' }],
    take: Math.min(Math.max(limit, 1), 60),
    select: {
      id: true,
      periodMonth: true,
      status: true,
      totalGross: true,
      totalNet: true,
      totalCompanyCost: true,
      generatedAt: true,
      _count: { select: { items: true } },
    },
  });
}

export async function getPayrollSettings(tenantId: string): Promise<PayrollSettings> {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { settings: true },
  });
  return readPayrollSettingsFromTenantSettings(tenant.settings);
}

export async function updatePayrollSettings(input: {
  tenantId: string;
  actorId: string;
  actorRole: string;
  settings: PayrollSettings;
}): Promise<PayrollSettings> {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: input.tenantId },
    select: { settings: true },
  });
  const current =
    typeof tenant.settings === 'object' && tenant.settings !== null
      ? (tenant.settings as Record<string, unknown>)
      : {};

  const updated = await prisma.tenant.update({
    where: { id: input.tenantId },
    data: {
      settings: {
        ...current,
        [PAYROLL_SETTINGS_STORAGE_KEY]: input.settings,
      } as unknown as Prisma.InputJsonObject,
    },
    select: { settings: true },
  });

  await createAuditLog({
    tenantId: input.tenantId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    entityType: 'Tenant',
    entityId: input.tenantId,
    action: AUDIT_ACTIONS.PAYROLL_SETTINGS_UPDATED,
    after: input.settings as unknown as Prisma.InputJsonValue,
  });

  return readPayrollSettingsFromTenantSettings(updated.settings);
}

/** Update a payroll item's email delivery state after a payslip send. */
export async function markPayslipEmailed(
  tenantId: string,
  runId: string,
  userId: string,
  status: 'SENT' | 'NOT_CONFIGURED' | 'FAILED',
): Promise<void> {
  await prisma.payrollItem.updateMany({
    where: { tenantId, payrollRunId: runId, userId },
    data: {
      emailStatus: status,
      ...(status === 'SENT' ? { emailedAt: new Date() } : {}),
    },
  });
}

export type { PayrollSettings };
