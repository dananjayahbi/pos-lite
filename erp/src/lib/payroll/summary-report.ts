import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface SummaryReportTotals {
  headcount: number;
  basic: string;
  allowances: string;
  overtime: string;
  commission: string;
  gross: string;
  deductions: string;
  employeeEpf: string;
  employerEpf: string;
  employerEtf: string;
  net: string;
  companyCost: string;
}

export interface SummaryReportItem {
  staffName: string;
  role: string;
  basicSalary: string;
  allowances: string;
  overtimeAmount: string;
  commissionAmount: string;
  grossSalary: string;
  totalDeductions: string;
  employeeEpf: string;
  netSalary: string;
}

export interface SummaryReportMeta {
  companyName: string;
  periodLabel: string;
  periodMonth: string;
  generatedAt: Date;
}

function num(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: string): string {
  return num(value).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const SUMMARY_ROWS: Array<[string, keyof SummaryReportTotals]> = [
  ['Basic salaries', 'basic'],
  ['Allowances', 'allowances'],
  ['Overtime', 'overtime'],
  ['Sales commission', 'commission'],
  ['Gross salary', 'gross'],
  ['Deductions (no-pay + advances)', 'deductions'],
  ['Employee EPF', 'employeeEpf'],
  ['Employer EPF', 'employerEpf'],
  ['Employer ETF', 'employerEtf'],
  ['Net salaries paid', 'net'],
  ['Total company cost', 'companyCost'],
];

export function generateSummaryReportXlsx(
  meta: SummaryReportMeta,
  totals: SummaryReportTotals,
  items: SummaryReportItem[],
): Buffer {
  const workbook = XLSX.utils.book_new();

  const summaryAoa: (string | number)[][] = [
    [`${meta.companyName} — Monthly Payroll Summary`],
    [`Period: ${meta.periodLabel}`, `Generated: ${meta.generatedAt.toLocaleString('en-GB')}`],
    [],
    ['Item', 'Amount (LKR)'],
    ...SUMMARY_ROWS.map(([label, key]) => [
      label,
      key === 'headcount' ? totals.headcount : num(totals[key] as string),
    ]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryAoa);
  summarySheet['!cols'] = [{ wch: 34 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  const detailAoa: (string | number)[][] = [
    ['Employee', 'Role', 'Basic', 'Allowances', 'OT', 'Commission', 'Gross', 'Deductions', 'Employee EPF', 'Net'],
    ...items.map((item) => [
      item.staffName,
      item.role,
      num(item.basicSalary),
      num(item.allowances),
      num(item.overtimeAmount),
      num(item.commissionAmount),
      num(item.grossSalary),
      num(item.totalDeductions),
      num(item.employeeEpf),
      num(item.netSalary),
    ]),
  ];
  const detailSheet = XLSX.utils.aoa_to_sheet(detailAoa);
  detailSheet['!cols'] = new Array(10).fill({ wch: 16 });
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Employees');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function generateSummaryReportPdf(
  meta: SummaryReportMeta,
  totals: SummaryReportTotals,
  items: SummaryReportItem[],
): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(59, 47, 47);
  doc.text(`${meta.companyName} — Monthly Payroll Summary`, 40, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(107, 91, 91);
  doc.text(`Period: ${meta.periodLabel}`, 40, 60);
  doc.text(`Headcount: ${totals.headcount}`, pageWidth - 40, 60, { align: 'right' });
  doc.setDrawColor(200, 149, 108);
  doc.setLineWidth(1.5);
  doc.line(40, 70, pageWidth - 40, 70);

  autoTable(doc, {
    startY: 82,
    head: [['Company cost breakdown', 'Amount (LKR)']],
    body: SUMMARY_ROWS.map(([label, key]) => [
      label,
      money(totals[key] as string),
    ]),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 4.5, textColor: [59, 47, 47] },
    headStyles: { fillColor: [200, 149, 108], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [250, 245, 240] },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (hookData) => {
      const rawRow = hookData.row.raw as unknown[];
      const label = String(rawRow[0] ?? '');
      if (label === 'Total company cost' || label === 'Net salaries paid') {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [245, 236, 226];
      }
    },
  });

  const afterSummary =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 300;

  autoTable(doc, {
    startY: afterSummary + 18,
    head: [
      [
        'Employee',
        'Basic',
        'Allow.',
        'OT',
        'Commission',
        'Gross',
        'Deductions',
        'EPF (8%)',
        'Net',
      ],
    ],
    body: items.map((item) => [
      item.staffName,
      money(item.basicSalary),
      money(item.allowances),
      money(item.overtimeAmount),
      money(item.commissionAmount),
      money(item.grossSalary),
      money(item.totalDeductions),
      money(item.employeeEpf),
      money(item.netSalary),
    ]),
    styles: { font: 'helvetica', fontSize: 6.8, cellPadding: 2.5, textColor: [59, 47, 47] },
    headStyles: { fillColor: [59, 47, 47], textColor: [255, 255, 255], fontSize: 7 },
    alternateRowStyles: { fillColor: [250, 245, 240] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(153, 153, 153);
    doc.text(
      `Generated ${meta.generatedAt.toLocaleString('en-GB')} • Page ${page} of ${pageCount}`,
      pageWidth - 40,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'right' },
    );
  }

  return Buffer.from(doc.output('arraybuffer'));
}

export function summaryReportFilename(
  meta: SummaryReportMeta,
  extension: 'xlsx' | 'pdf',
): string {
  return `payroll-summary-${meta.periodMonth}.${extension}`;
}
