import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  describePayrollRunStatus,
  type PayrollRunPaymentInfo,
} from '@/lib/payroll/payroll-run-status';

export interface BankSheetRow {
  staffName: string;
  /** NIC is useful when a bank asks for an identity reference; snapshot field. */
  nic?: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  netSalary: string;
}

export interface BankSheetMeta {
  companyName: string;
  periodLabel: string;
  periodMonth: string;
  generatedAt: Date;
  /** ARGUS #385: generated runs are unpaid; never imply a completed payment. */
  status?: string;
  payment?: PayrollRunPaymentInfo | null;
}

/** Honest naming - this is not a bank-specific batch/upload format. */
export const BANK_WORKSHEET_TITLE = 'Bank Salary Worksheet';
export const BANK_WORKSHEET_SHEET_NAME = 'Bank Salary Worksheet';
export const BANK_WORKSHEET_DISCLAIMER =
  'Salary worksheet for manual bank upload. This is not a bank batch file: confirm branch/account codes, account type, debit account, payment date, narration and transaction code with your bank.';

const WORKSHEET_HEAD = [
  'No.',
  'Employee Name',
  'NIC',
  'Bank',
  'Branch',
  'Account Number',
  'Net Salary (LKR)',
];

function rupees(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
}

export function generateBankSheetXlsx(meta: BankSheetMeta, rows: BankSheetRow[]): Buffer {
  const status = describePayrollRunStatus({
    status: meta.status ?? 'GENERATED',
    payment: meta.payment ?? null,
  });
  const aoa: (string | number)[][] = [
    [`${meta.companyName} - ${BANK_WORKSHEET_TITLE}`],
    [`Period: ${meta.periodLabel}`, `Generated: ${meta.generatedAt.toLocaleString('en-GB')}`],
    [`Status: ${status.exportMarker}`],
    [BANK_WORKSHEET_DISCLAIMER],
    [],
    WORKSHEET_HEAD,
    ...rows.map((row, index) => [
      index + 1,
      row.staffName,
      row.nic ?? '',
      row.bankName ?? '',
      row.bankBranch ?? '',
      row.bankAccountNumber ?? '',
      Number(rupees(row.netSalary).replace(/,/g, '')),
    ]),
    [],
    ['', '', '', '', '', 'Total', rows.reduce((sum, row) => sum + Number(row.netSalary), 0)],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 22 },
    { wch: 16 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, BANK_WORKSHEET_SHEET_NAME);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function generateBankSheetPdf(meta: BankSheetMeta, rows: BankSheetRow[]): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(59, 47, 47);
  doc.text(`${meta.companyName} - ${BANK_WORKSHEET_TITLE}`, 40, 42);

  const status = describePayrollRunStatus({
    status: meta.status ?? 'GENERATED',
    payment: meta.payment ?? null,
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(107, 91, 91);
  doc.text(`Period: ${meta.periodLabel}`, 40, 60);
  doc.text(`Generated: ${meta.generatedAt.toLocaleString('en-GB')}`, pageWidth - 40, 60, {
    align: 'right',
  });
  doc.setFontSize(8);
  doc.text(`Status: ${status.exportMarker}`, 40, 73);
  doc.setFontSize(7.5);
  doc.text(
    'Worksheet for manual bank upload - not a bank batch file. Confirm branch/account codes, account type, debit account, payment date, narration and transaction code with your bank.',
    40,
    85,
    { maxWidth: pageWidth - 80 },
  );

  doc.setDrawColor(200, 149, 108);
  doc.setLineWidth(1.5);
  doc.line(40, 100, pageWidth - 40, 100);

  autoTable(doc, {
    startY: 110,
    margin: { left: 40, right: 40, top: 40, bottom: 40 },
    head: [WORKSHEET_HEAD],
    body: rows.map((row, index) => [
      String(index + 1),
      row.staffName,
      row.nic ?? '-',
      row.bankName ?? '-',
      row.bankBranch ?? '-',
      row.bankAccountNumber ?? '-',
      rupees(row.netSalary),
    ]),
    foot: [
      [
        '',
        '',
        '',
        '',
        '',
        'Total',
        rows.reduce((sum, row) => sum + Number(row.netSalary), 0).toLocaleString('en-LK', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      ],
    ],
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: [59, 47, 47] },
    headStyles: { fillColor: [200, 149, 108], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [245, 236, 226], textColor: [59, 47, 47], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 245, 240] },
    columnStyles: { 6: { halign: 'right' } },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(153, 153, 153);
    doc.text(
      `Page ${page} of ${pageCount} - salary worksheet, not a bank batch file`,
      pageWidth - 40,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'right' },
    );
  }

  return Buffer.from(doc.output('arraybuffer'));
}

export function bankSheetFilename(meta: BankSheetMeta, extension: 'xlsx' | 'pdf'): string {
  return `bank-salary-worksheet-${meta.periodMonth}.${extension}`;
}
