import { describe, expect, it } from 'vitest';
import { generatePayrollPayslipPdf } from '@/lib/payroll/payslip-pdf';
import {
  generateBankSheetPdf,
  generateBankSheetXlsx,
} from '@/lib/payroll/bank-sheet';
import {
  generateStatutoryReturnPdf,
  generateStatutoryReturnXlsx,
} from '@/lib/payroll/statutory-return';
import {
  generateSummaryReportPdf,
  generateSummaryReportXlsx,
} from '@/lib/payroll/summary-report';

const meta = {
  companyName: 'Ruhunu Wedagedara',
  periodLabel: 'November 2026',
  periodMonth: '2026-11',
  generatedAt: new Date('2026-11-30T12:00:00Z'),
};

const item = {
  staffName: 'Saman Perera',
  staffEmail: 'saman@example.com',
  role: 'CASHIER',
  nic: '199012345678',
  bankName: 'Commercial Bank',
  bankBranch: 'Colombo',
  bankAccountNumber: '1234567890',
  epfNumber: 'EPF-1',
  etfNumber: 'ETF-1',
  basicSalary: '60000.00',
  allowances: '10000.00',
  overtimeMinutes: 600,
  overtimeAmount: '4326.92',
  commissionAmount: '5000.00',
  grossSalary: '79326.92',
  noPayDays: '2.0',
  noPayDeduction: '4615.38',
  advanceDeduction: '5000.00',
  totalDeductions: '9615.38',
  employeeEpf: '6346.15',
  employerEpf: '9519.23',
  employerEtf: '2379.81',
  netSalary: '63365.39',
  totalCompanyCost: '91225.96',
};

const statutoryMeta = {
  ...meta,
  employerEpfNumber: 'EPF-EMP-1',
  employerEtfNumber: 'ETF-EMP-1',
  employeeEpfRate: 8,
  employerEpfRate: 12,
  employerEtfRate: 3,
};

const summaryTotals = {
  headcount: 1,
  basic: item.basicSalary,
  allowances: item.allowances,
  overtime: item.overtimeAmount,
  commission: item.commissionAmount,
  gross: item.grossSalary,
  deductions: item.totalDeductions,
  employeeEpf: item.employeeEpf,
  employerEpf: item.employerEpf,
  employerEtf: item.employerEtf,
  net: item.netSalary,
  companyCost: item.totalCompanyCost,
};

function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 4).toString('ascii') === '%PDF';
}

function isZip(buffer: Buffer): boolean {
  return buffer.subarray(0, 2).toString('ascii') === 'PK';
}

describe('payroll documents', () => {
  it('renders a branded payslip PDF', async () => {
    const pdf = await generatePayrollPayslipPdf({
      company: {
        name: 'Ruhunu Wedagedara',
        address: 'No. 1, Galle Road, Colombo',
        phone: '+94 11 234 5678',
        logoUrl: null,
      },
      periodLabel: meta.periodLabel,
      periodMonth: meta.periodMonth,
      rates: { employeeEpf: 8, employerEpf: 12, employerEtf: 3 },
      item,
      generatedAt: meta.generatedAt,
    });
    expect(isPdf(pdf)).toBe(true);
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it('renders bank salary sheets in Excel and PDF', () => {
    const rows = [
      {
        staffName: item.staffName,
        bankName: item.bankName,
        bankBranch: item.bankBranch,
        bankAccountNumber: item.bankAccountNumber,
        netSalary: item.netSalary,
      },
    ];
    expect(isZip(generateBankSheetXlsx(meta, rows))).toBe(true);
    expect(isPdf(generateBankSheetPdf(meta, rows))).toBe(true);
  });

  it('renders EPF/ETF returns in Excel and PDF', () => {
    const rows = [
      {
        staffName: item.staffName,
        nic: item.nic,
        epfNumber: item.epfNumber,
        etfNumber: item.etfNumber,
        grossSalary: item.grossSalary,
        employeeEpf: item.employeeEpf,
        employerEpf: item.employerEpf,
        employerEtf: item.employerEtf,
      },
    ];
    expect(isZip(generateStatutoryReturnXlsx(statutoryMeta, rows))).toBe(true);
    expect(isPdf(generateStatutoryReturnPdf(statutoryMeta, rows))).toBe(true);
  });

  it('renders the monthly summary in Excel and PDF', () => {
    const rows = [
      {
        staffName: item.staffName,
        role: item.role,
        basicSalary: item.basicSalary,
        allowances: item.allowances,
        overtimeAmount: item.overtimeAmount,
        commissionAmount: item.commissionAmount,
        grossSalary: item.grossSalary,
        totalDeductions: item.totalDeductions,
        employeeEpf: item.employeeEpf,
        netSalary: item.netSalary,
      },
    ];
    expect(isZip(generateSummaryReportXlsx(meta, summaryTotals, rows))).toBe(true);
    expect(isPdf(generateSummaryReportPdf(meta, summaryTotals, rows))).toBe(true);
  });
});
