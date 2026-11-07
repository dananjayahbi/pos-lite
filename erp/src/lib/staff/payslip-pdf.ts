import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRupee } from '@/lib/format';
import { formatMinutesAsHm } from '@/lib/utils/attendance-period';

export interface PayslipData {
  businessName: string;
  staffName: string;
  email: string;
  role: string;
  periodLabel: string;
  attendance: {
    daysPresent: number;
    daysAbsent: number;
    daysLeave: number;
    daysHalfDay: number;
    daysHoliday: number;
    totalMinutes: number;
    regularMinutes: number;
    overtimeMinutes: number;
  };
  commission: {
    earned: string;
    paid: string;
    unpaid: string;
  };
}

/** Server-side payslip PDF. Covers attendance + commission earnings. */
export function generatePayslipPdf(data: PayslipData): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setTextColor(59, 47, 47);
  doc.text(data.businessName, 40, 44);

  doc.setFontSize(12);
  doc.text('Staff Payslip', 40, 64);
  doc.setFontSize(10);
  doc.setTextColor(107, 91, 91);
  doc.text(data.periodLabel, 40, 80);

  doc.setDrawColor(200, 149, 108);
  doc.setLineWidth(1.5);
  doc.line(40, 90, pageWidth - 40, 90);

  autoTable(doc, {
    startY: 104,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 10, textColor: [59, 47, 47], cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 120 } },
    body: [
      ['Staff', data.staffName],
      ['Email', data.email],
      ['Role', data.role],
      ['Period', data.periodLabel],
    ],
  });

  const afterStaff =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 190;

  autoTable(doc, {
    startY: afterStaff + 20,
    head: [['Attendance', 'Value']],
    body: [
      ['Days Present', String(data.attendance.daysPresent)],
      ['Days Absent', String(data.attendance.daysAbsent)],
      ['Days Leave', String(data.attendance.daysLeave)],
      ['Half Days', String(data.attendance.daysHalfDay)],
      ['Holidays', String(data.attendance.daysHoliday)],
      ['Total Worked', formatMinutesAsHm(data.attendance.totalMinutes)],
      ['Regular Hours', formatMinutesAsHm(data.attendance.regularMinutes)],
      ['Overtime (OT)', formatMinutesAsHm(data.attendance.overtimeMinutes)],
    ],
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 4, textColor: [59, 47, 47] },
    headStyles: { fillColor: [200, 149, 108], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [250, 245, 240] },
  });

  const afterAttendance =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 380;

  autoTable(doc, {
    startY: afterAttendance + 20,
    head: [['Commission', 'Amount']],
    body: [
      ['Earned', formatRupee(data.commission.earned)],
      ['Paid', formatRupee(data.commission.paid)],
      ['Unpaid (Payable)', formatRupee(data.commission.unpaid)],
    ],
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 4, textColor: [59, 47, 47] },
    headStyles: { fillColor: [59, 47, 47], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [250, 245, 240] },
  });

  const afterCommission =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 470;

  autoTable(doc, {
    startY: afterCommission + 20,
    head: [['Pay Summary', 'Amount']],
    body: [['Total Payable (unpaid commission)', formatRupee(data.commission.unpaid)]],
    styles: {
      font: 'helvetica',
      fontSize: 10,
      fontStyle: 'bold',
      cellPadding: 5,
      textColor: [59, 47, 47],
    },
    headStyles: { fillColor: [200, 149, 108], textColor: [255, 255, 255] },
  });

  const afterSummary =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 520;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'This payslip covers attendance and commission earnings recorded in AyurPOS. No base salary is configured for this account.',
    40,
    afterSummary + 24,
    { maxWidth: pageWidth - 80 },
  );
  doc.text(
    `Generated: ${new Date().toLocaleString()}`,
    pageWidth - 40,
    doc.internal.pageSize.getHeight() - 24,
    { align: 'right' },
  );

  return Buffer.from(doc.output('arraybuffer'));
}
