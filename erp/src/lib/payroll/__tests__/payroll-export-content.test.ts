import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  BANK_WORKSHEET_SHEET_NAME,
  generateBankSheetXlsx,
} from '@/lib/payroll/bank-sheet';
import {
  generateStatutoryReturnXlsx,
} from '@/lib/payroll/statutory-return';
import {
  generateSummaryReportXlsx,
  type SummaryReportItem,
  type SummaryReportTotals,
} from '@/lib/payroll/summary-report';

/**
 * ARGUS #393: the old documents suite only checked file signatures. These
 * assertions read the workbooks back and validate cell values, totals,
 * headcount and blank statutory/bank fields.
 */

const meta = {
  companyName: 'Ruhunu Wedagedara',
  periodLabel: 'November 2026',
  periodMonth: '2026-11',
  generatedAt: new Date('2026-11-30T12:00:00Z'),
};

const items: SummaryReportItem[] = [
  {
    staffName: 'Saman Perera',
    role: 'CASHIER',
    basicSalary: '26000.00',
    allowances: '0.00',
    overtimeAmount: '0.00',
    commissionAmount: '0.00',
    grossSalary: '26000.00',
    totalDeductions: '0.00',
    employeeEpf: '2080.00',
    netSalary: '23920.00',
  },
  {
    staffName: 'Nimal Silva',
    role: 'MANAGER',
    basicSalary: '34109.56',
    allowances: '0.00',
    overtimeAmount: '0.00',
    commissionAmount: '0.00',
    grossSalary: '34109.56',
    totalDeductions: '3000.00',
    employeeEpf: '2728.76',
    netSalary: '28380.80',
  },
];

const totals: SummaryReportTotals = {
  headcount: 2,
  basic: '60109.56',
  allowances: '0.00',
  overtime: '0.00',
  commission: '0.00',
  gross: '60109.56',
  deductions: '3000.00',
  employeeEpf: '4808.76',
  deductionsIncludingEpf: '7808.76',
  employerEpf: '7213.15',
  employerEtf: '1803.29',
  net: '52300.80',
  companyCost: '69126.00',
};

function readSheet(buffer: Buffer, sheetName: string, cellNF = true): unknown[][] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellNF });
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]!, {
    header: 1,
  }) as unknown[][];
}

describe('summary workbook content', () => {
  const buffer = generateSummaryReportXlsx(meta, totals, items);
  const summary = readSheet(buffer, 'Summary');
  const employees = readSheet(buffer, 'Employees');

  it('prints the same headcount as the PDF', () => {
    expect(summary[5]).toEqual(['Headcount', 2]);
  });

  it('prints money totals, including the deduction total that reconciles net', () => {
    const value = (label: string): unknown =>
      summary.find((row) => row[0] === label)?.[1];
    expect(value('Basic salaries')).toBe(60109.56);
    expect(value('No-pay + advances')).toBe(3000);
    expect(value('Employee EPF')).toBe(4808.76);
    expect(value('Total deductions incl. employee EPF')).toBe(7808.76);
    expect(value('Net payable')).toBe(52300.8);
    expect(value('Total company cost')).toBe(69126);
  });

  it('adds a total row to the employee detail sheet', () => {
    expect(employees[0]).toContain('Employee EPF');
    expect(employees[4]?.[0]).toBe('Total');
    expect(Number(employees[4]?.[2])).toBeCloseTo(60109.56, 2);
    expect(Number(employees[4]?.[7])).toBeCloseTo(3000, 2);
    expect(Number(employees[4]?.[8])).toBeCloseTo(4808.76, 2);
    expect(Number(employees[4]?.[9])).toBeCloseTo(52300.8, 2);
  });

  it('formats every money cell to two decimals', () => {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellNF: true });
    expect(workbook.Sheets['Summary']!['B8']?.z).toBe('#,##0.00');
    expect(workbook.Sheets['Employees']!['G5']?.z).toBe('#,##0.00');
    expect(workbook.Sheets['Employees']!['J5']?.z).toBe('#,##0.00');
  });
});

describe('bank worksheet blank fields', () => {
  it('keeps missing bank details blank and still totals net pay', () => {
    const buffer = generateBankSheetXlsx(meta, [
      {
        staffName: 'Saman Perera',
        nic: null,
        bankName: null,
        bankBranch: null,
        bankAccountNumber: null,
        netSalary: '23920.00',
      },
      {
        staffName: 'Nimal Silva',
        nic: '199012345678',
        bankName: 'Commercial Bank',
        bankBranch: 'Colombo',
        bankAccountNumber: '1234567890',
        netSalary: '28380.80',
      },
    ]);

    const rows = readSheet(buffer, BANK_WORKSHEET_SHEET_NAME);
    expect(rows[6]).toEqual([1, 'Saman Perera', '', '', '', '', 23920]);
    expect(rows[7]?.[6]).toBe(28380.8);
    expect(rows[9]).toEqual(['', '', '', '', '', 'Total', 52300.8]);
  });
});

describe('statutory return blank fields', () => {
  const statutoryMeta = {
    ...meta,
    employerEpfNumber: 'EPF-EMP-1',
    employerEtfNumber: 'ETF-EMP-1',
    employeeEpfRate: 8,
    employerEpfRate: 12,
    employerEtfRate: 3,
  };

  it('keeps missing NIC/EPF/ETF blank instead of inventing values', () => {
    const buffer = generateStatutoryReturnXlsx(statutoryMeta, [
      {
        staffName: 'Saman Perera',
        nic: null,
        epfNumber: null,
        etfNumber: null,
        grossSalary: '26000.00',
        employeeEpf: '2080.00',
        employerEpf: '3120.00',
        employerEtf: '780.00',
      },
      {
        staffName: 'Nimal Silva',
        nic: '199012345678',
        epfNumber: 'EPF-2',
        etfNumber: 'ETF-2',
        grossSalary: '34109.56',
        employeeEpf: '2728.76',
        employerEpf: '4093.15',
        employerEtf: '1023.29',
      },
    ]);

    const epf = readSheet(buffer, 'EPF C-Form');
    expect(epf[7]).toEqual([1, 'Saman Perera', '', '', 26000, 2080, 3120]);
    expect(epf[9]).toEqual(['', '', '', 'Total', 60109.56, 4808.76, 7213.15]);

    const etf = readSheet(buffer, 'ETF Return');
    expect(etf[7]).toEqual([1, 'Saman Perera', '', '', 26000, 780]);
    expect(etf[9]).toEqual(['', '', '', 'Total', 60109.56, 1803.29]);
  });

  it('prints the employer registration number or "-" when absent', () => {
    const buffer = generateStatutoryReturnXlsx(
      { ...statutoryMeta, employerEpfNumber: '' },
      [],
    );
    const epf = readSheet(buffer, 'EPF C-Form');
    expect(epf[2]).toEqual(['Employer EPF Number', '-']);
  });
});
