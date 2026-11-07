import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface StatutoryRow {
  staffName: string;
  nic: string | null;
  epfNumber: string | null;
  etfNumber: string | null;
  grossSalary: string;
  employeeEpf: string;
  employerEpf: string;
  employerEtf: string;
}

export interface StatutoryMeta {
  companyName: string;
  periodLabel: string;
  periodMonth: string;
  employerEpfNumber: string;
  employerEtfNumber: string;
  employeeEpfRate: number;
  employerEpfRate: number;
  employerEtfRate: number;
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

function totals(rows: StatutoryRow[]) {
  return rows.reduce(
    (acc, row) => ({
      gross: acc.gross + num(row.grossSalary),
      employeeEpf: acc.employeeEpf + num(row.employeeEpf),
      employerEpf: acc.employerEpf + num(row.employerEpf),
      employerEtf: acc.employerEtf + num(row.employerEtf),
    }),
    { gross: 0, employeeEpf: 0, employerEpf: 0, employerEtf: 0 },
  );
}

function epfSheet(meta: StatutoryMeta, rows: StatutoryRow[]): XLSX.WorkSheet {
  const total = totals(rows);
  const aoa: (string | number)[][] = [
    ['C FORM — CONTRIBUTIONS TO EMPLOYEES PROVIDENT FUND'],
    ['Employer', meta.companyName],
    ['Employer EPF Number', meta.employerEpfNumber || '—'],
    ['Month', meta.periodLabel],
    [],
    [
      'No.',
      'Employee Name',
      'NIC',
      'EPF Number',
      'Total Monthly Earnings (LKR)',
      `Employee EPF ${meta.employeeEpfRate}% (LKR)`,
      `Employer EPF ${meta.employerEpfRate}% (LKR)`,
    ],
    ...rows.map((row, index) => [
      index + 1,
      row.staffName,
      row.nic ?? '',
      row.epfNumber ?? '',
      num(row.grossSalary),
      num(row.employeeEpf),
      num(row.employerEpf),
    ]),
    [
      '',
      '',
      '',
      'Total',
      total.gross,
      total.employeeEpf,
      total.employerEpf,
    ],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 18 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
    { wch: 20 },
  ];
  return sheet;
}

function etfSheet(meta: StatutoryMeta, rows: StatutoryRow[]): XLSX.WorkSheet {
  const total = totals(rows);
  const aoa: (string | number)[][] = [
    ['EMPLOYEES TRUST FUND — MONTHLY RETURN'],
    ['Employer', meta.companyName],
    ['Employer ETF Number', meta.employerEtfNumber || '—'],
    ['Month', meta.periodLabel],
    [],
    [
      'No.',
      'Employee Name',
      'NIC',
      'ETF Number',
      'Total Monthly Earnings (LKR)',
      `Employer ETF ${meta.employerEtfRate}% (LKR)`,
    ],
    ...rows.map((row, index) => [
      index + 1,
      row.staffName,
      row.nic ?? '',
      row.etfNumber ?? '',
      num(row.grossSalary),
      num(row.employerEtf),
    ]),
    ['', '', '', 'Total', total.gross, total.employerEtf],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 18 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
  ];
  return sheet;
}

export function generateStatutoryReturnXlsx(
  meta: StatutoryMeta,
  rows: StatutoryRow[],
): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, epfSheet(meta, rows), 'EPF C-Form');
  XLSX.utils.book_append_sheet(workbook, etfSheet(meta, rows), 'ETF Return');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function generateStatutoryReturnPdf(
  meta: StatutoryMeta,
  rows: StatutoryRow[],
): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const total = totals(rows);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(59, 47, 47);
  doc.text('C FORM — EPF CONTRIBUTIONS', 40, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(107, 91, 91);
  doc.text(
    `${meta.companyName} • EPF No. ${meta.employerEpfNumber || '—'} • ${meta.periodLabel}`,
    40,
    60,
  );

  autoTable(doc, {
    startY: 74,
    margin: { left: 40, right: 40, top: 40, bottom: 40 },
    head: [
      [
        'No.',
        'Employee Name',
        'NIC',
        'EPF No.',
        'Total Earnings (LKR)',
        `Employee EPF ${meta.employeeEpfRate}%`,
        `Employer EPF ${meta.employerEpfRate}%`,
      ],
    ],
    body: rows.map((row, index) => [
      String(index + 1),
      row.staffName,
      row.nic ?? '—',
      row.epfNumber ?? '—',
      money(row.grossSalary),
      money(row.employeeEpf),
      money(row.employerEpf),
    ]),
    foot: [
      ['', '', '', 'Total', money(String(total.gross)), money(String(total.employeeEpf)), money(String(total.employerEpf))],
    ],
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 3.5, textColor: [59, 47, 47] },
    headStyles: { fillColor: [200, 149, 108], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [245, 236, 226], textColor: [59, 47, 47], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 245, 240] },
  });

  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(59, 47, 47);
  doc.text('ETF MONTHLY RETURN', 40, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(107, 91, 91);
  doc.text(
    `${meta.companyName} • ETF No. ${meta.employerEtfNumber || '—'} • ${meta.periodLabel}`,
    40,
    60,
  );

  autoTable(doc, {
    startY: 74,
    margin: { left: 40, right: 40, top: 40, bottom: 40 },
    head: [
      [
        'No.',
        'Employee Name',
        'NIC',
        'ETF No.',
        'Total Earnings (LKR)',
        `Employer ETF ${meta.employerEtfRate}%`,
      ],
    ],
    body: rows.map((row, index) => [
      String(index + 1),
      row.staffName,
      row.nic ?? '—',
      row.etfNumber ?? '—',
      money(row.grossSalary),
      money(row.employerEtf),
    ]),
    foot: [['', '', '', 'Total', money(String(total.gross)), money(String(total.employerEtf))]],
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 3.5, textColor: [59, 47, 47] },
    headStyles: { fillColor: [59, 47, 47], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [245, 236, 226], textColor: [59, 47, 47], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 245, 240] },
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

export function statutoryReturnFilename(
  meta: StatutoryMeta,
  extension: 'xlsx' | 'pdf',
): string {
  return `epf-etf-returns-${meta.periodMonth}.${extension}`;
}
