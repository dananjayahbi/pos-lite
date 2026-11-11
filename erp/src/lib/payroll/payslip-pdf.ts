import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatMinutesAsHm } from '@/lib/utils/attendance-period';

export interface PayrollPayslipCompany {
  name: string;
  address: string;
  phone: string;
  logoUrl: string | null;
}

export interface PayrollPayslipItem {
  staffName: string;
  staffEmail: string;
  role: string;
  nic: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  epfNumber: string | null;
  etfNumber: string | null;
  basicSalary: string;
  allowances: string;
  overtimeMinutes: number;
  overtimeAmount: string;
  commissionAmount: string;
  grossSalary: string;
  noPayDays: string;
  noPayDeduction: string;
  advanceDeduction: string;
  totalDeductions: string;
  employeeEpf: string;
  employerEpf: string;
  employerEtf: string;
  netSalary: string;
}

export interface PayrollPayslipData {
  company: PayrollPayslipCompany;
  periodLabel: string;
  periodMonth: string;
  rates: {
    employeeEpf: number;
    employerEpf: number;
    employerEtf: number;
  };
  item: PayrollPayslipItem;
  generatedAt: Date;
}

const ESPRESSO: [number, number, number] = [59, 47, 47];
const TERRACOTTA: [number, number, number] = [200, 149, 108];
const MUTED: [number, number, number] = [107, 91, 91];

function rupees(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Rs. 0.00';
  return `Rs. ${amount.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function loadLogoDataUrl(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl || !/^https?:\/\//i.test(logoUrl)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(logoUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? '';
    if (!/^image\/(png|jpe?g)/i.test(contentType)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Professional A4 payslip with the tenant's logo and company details.
 * All monetary values are pre-computed by `calculatePayroll`; this renderer
 * only lays them out so the preview, persisted run and PDF cannot disagree.
 */
export async function generatePayrollPayslipPdf(
  data: PayrollPayslipData,
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  const logo = await loadLogoDataUrl(data.company.logoUrl);
  let headerY = margin + 8;

  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin, margin - 6, 46, 46);
      headerY = margin + 18;
    } catch {
      // Unsupported image bytes — fall back to a text-only header.
    }
  }

  const textX = logo ? margin + 58 : margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...ESPRESSO);
  doc.text(data.company.name, textX, headerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const companyLines = [data.company.address, data.company.phone].filter(
    (line) => line.trim().length > 0,
  );
  companyLines.forEach((line, index) => {
    doc.text(line, textX, headerY + 14 + index * 11, { maxWidth: pageWidth - textX - margin });
  });

  doc.setDrawColor(...TERRACOTTA);
  doc.setLineWidth(1.5);
  doc.line(margin, margin + 60, pageWidth - margin, margin + 60);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...ESPRESSO);
  doc.text('PAYSLIP', margin, margin + 82);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(data.periodLabel, pageWidth - margin, margin + 82, { align: 'right' });

  autoTable(doc, {
    startY: margin + 94,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, textColor: ESPRESSO, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 80, textColor: MUTED },
      1: { cellWidth: 150 },
      2: { fontStyle: 'bold', cellWidth: 85, textColor: MUTED },
      3: { cellWidth: 155 },
    },
    body: [
      ['Employee', data.item.staffName, 'Employee ID', data.item.epfNumber ?? '—'],
      ['Role', data.item.role, 'NIC', data.item.nic ?? '—'],
      ['Email', data.item.staffEmail, 'EPF / ETF No.', `${data.item.epfNumber ?? '—'} / ${data.item.etfNumber ?? '—'}`],
      [
        'Bank',
        [data.item.bankName, data.item.bankBranch].filter(Boolean).join(' — ') || '—',
        'Account No.',
        data.item.bankAccountNumber ?? '—',
      ],
    ],
  });

  const afterProfile =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    margin + 170;

  autoTable(doc, {
    startY: afterProfile + 16,
    head: [['Earnings', 'Amount (LKR)']],
    body: [
      ['Basic Salary', rupees(data.item.basicSalary)],
      ['Allowances', rupees(data.item.allowances)],
      [
        `Overtime (${formatMinutesAsHm(data.item.overtimeMinutes)})`,
        rupees(data.item.overtimeAmount),
      ],
      ['Sales Commission', rupees(data.item.commissionAmount)],
      ['Gross Salary', rupees(data.item.grossSalary)],
    ],
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 4, textColor: ESPRESSO },
    headStyles: { fillColor: TERRACOTTA, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [250, 245, 240] },
    didParseCell: (hookData) => {
      if (hookData.row.index === 4 && hookData.section === 'body') {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [245, 236, 226];
      }
    },
  });

  const afterEarnings =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    afterProfile + 120;

  autoTable(doc, {
    startY: afterEarnings + 14,
    head: [['Deductions', 'Amount (LKR)']],
    body: [
      [
        `No-Pay (${data.item.noPayDays} day${data.item.noPayDays === '1.0' ? '' : 's'})`,
        rupees(data.item.noPayDeduction),
      ],
      ['Salary Advances', rupees(data.item.advanceDeduction)],
      [`Employee EPF (${data.rates.employeeEpf}%)`, rupees(data.item.employeeEpf)],
      ['Total Deductions', rupees(data.item.totalDeductions)],
    ],
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 4, textColor: ESPRESSO },
    headStyles: { fillColor: ESPRESSO, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [250, 245, 240] },
    didParseCell: (hookData) => {
      if (hookData.row.index === 3 && hookData.section === 'body') {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [245, 236, 226];
      }
    },
  });

  const afterDeductions =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    afterEarnings + 100;

  autoTable(doc, {
    startY: afterDeductions + 14,
    head: [['Employer Contributions (company cost)', 'Amount (LKR)']],
    body: [
      [`Employer EPF (${data.rates.employerEpf}%)`, rupees(data.item.employerEpf)],
      [`Employer ETF (${data.rates.employerEtf}%)`, rupees(data.item.employerEtf)],
    ],
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3.5, textColor: MUTED },
    headStyles: { fillColor: [241, 232, 222], textColor: ESPRESSO },
  });

  const afterEmployer =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    afterDeductions + 70;

  autoTable(doc, {
    startY: afterEmployer + 16,
    theme: 'grid',
    head: [['NET SALARY (TAKE HOME)', 'Amount (LKR)']],
    body: [['Net Pay', rupees(data.item.netSalary)]],
    styles: {
      font: 'helvetica',
      fontSize: 11,
      fontStyle: 'bold',
      cellPadding: 7,
      textColor: ESPRESSO,
    },
    headStyles: { fillColor: TERRACOTTA, textColor: [255, 255, 255] },
    columnStyles: { 1: { halign: 'right' } },
  });

  const afterNet =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    afterEmployer + 60;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Net salary = Gross salary − (No-pay + Advances) − Employee EPF. Employer EPF/ETF are paid by the company and are not deducted from the employee.',
    margin,
    afterNet + 22,
    { maxWidth: pageWidth - margin * 2 },
  );
  doc.text(
    `Generated ${data.generatedAt.toLocaleString('en-GB')} • ${data.periodMonth} payroll`,
    margin,
    pageHeight - 28,
  );
  doc.text('System-generated payslip — no signature required.', pageWidth - margin, pageHeight - 28, {
    align: 'right',
  });

  return Buffer.from(doc.output('arraybuffer'));
}
