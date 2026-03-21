'use server';

import net from 'node:net';
import { prisma } from '@/lib/prisma';

// ── Types ────────────────────────────────────────────────────────────────────

export type PrinterConfig = {
  type: 'NETWORK' | 'USB';
  host?: string;
  port?: number;
  paperWidth?: '58mm' | '80mm';
};

// ── ESC/POS Command Constants ────────────────────────────────────────────────

const ESC_INIT = Buffer.from([0x1b, 0x40]);
const ESC_BOLD_ON = Buffer.from([0x1b, 0x45, 0x01]);
const ESC_BOLD_OFF = Buffer.from([0x1b, 0x45, 0x00]);
const ESC_ALIGN_CENTER = Buffer.from([0x1b, 0x61, 0x01]);
const ESC_ALIGN_LEFT = Buffer.from([0x1b, 0x61, 0x00]);
const ESC_ALIGN_RIGHT = Buffer.from([0x1b, 0x61, 0x02]);
const GS_CUT = Buffer.from([0x1d, 0x56, 0x00]);
const ESC_DOUBLE_HEIGHT = Buffer.from([0x1b, 0x21, 0x10]);
const ESC_NORMAL = Buffer.from([0x1b, 0x21, 0x00]);
const LINE_FEED = Buffer.from([0x0a]);

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLineWidth(config: PrinterConfig): number {
  return config.paperWidth === '80mm' ? 48 : 32;
}

function textToBuffer(text: string): Buffer {
  return Buffer.from(text, 'utf-8');
}

function padLine(left: string, right: string, width: number): string {
  const gap = width - left.length - right.length;
  if (gap < 1) return left + ' ' + right;
  return left + ' '.repeat(gap) + right;
}

function centerText(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const pad = Math.floor((width - text.length) / 2);
  return ' '.repeat(pad) + text;
}

function divider(width: number): string {
  return '-'.repeat(width);
}

function formatMoney(amount: unknown): string {
  const num = typeof amount === 'number' ? amount : Number(amount);
  return num.toFixed(2);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Network Printer Transport ────────────────────────────────────────────────

export async function sendToPrinter(config: PrinterConfig, data: Buffer): Promise<void> {
  if (config.type === 'USB') {
    throw new Error('USB printing is not supported in this environment. Use a network printer.');
  }

  if (!config.host) {
    throw new Error('Printer host address is required for network printing.');
  }

  const port = config.port ?? 9100;
  const timeout = 5000;

  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host: config.host!, port }, () => {
      socket.write(data, (err) => {
        socket.end();
        if (err) {
          reject(new Error(`Failed to write to printer: ${err.message}`));
        }
      });
    });

    socket.setTimeout(timeout);

    socket.on('close', () => resolve());
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Printer connection timed out'));
    });
    socket.on('error', (err) => {
      socket.destroy();
      reject(new Error(`Printer connection error: ${err.message}`));
    });
  });
}

// ── Receipt Builder ──────────────────────────────────────────────────────────

function buildReceiptBuffer(parts: Buffer[]): Buffer {
  return Buffer.concat(parts);
}

function line(text: string): Buffer[] {
  return [textToBuffer(text), LINE_FEED];
}

// ── printSaleReceipt ─────────────────────────────────────────────────────────

export async function printSaleReceipt(saleId: string): Promise<void> {
  const sale = await prisma.sale.findUniqueOrThrow({
    where: { id: saleId },
    include: {
      lines: { include: { variant: { include: { product: true } } } },
      customer: true,
      shift: { include: { tenant: true } },
      cashier: true,
      payments: true,
    },
  });

  const tenant = sale.shift.tenant;
  const settings = tenant.settings as Record<string, unknown> | null;
  const printerConfig: PrinterConfig = {
    type: 'NETWORK',
    host: (settings as any)?.hardware?.printer?.host ?? '192.168.1.100',
    port: (settings as any)?.hardware?.printer?.port ?? 9100,
    paperWidth: (settings as any)?.hardware?.printer?.paperWidth ?? '58mm',
  };

  const w = getLineWidth(printerConfig);
  const parts: Buffer[] = [];

  // Initialize
  parts.push(ESC_INIT);

  // Header
  parts.push(ESC_ALIGN_CENTER, ESC_DOUBLE_HEIGHT);
  parts.push(...line(tenant.name.toUpperCase()));
  parts.push(ESC_NORMAL);

  if ((settings as any)?.receiptHeader) {
    parts.push(...line(String((settings as any).receiptHeader)));
  }

  parts.push(...line(divider(w)));
  parts.push(ESC_ALIGN_LEFT);

  // Sale info
  parts.push(...line(padLine('Receipt:', sale.id.slice(-8).toUpperCase(), w)));
  parts.push(...line(padLine('Date:', formatDate(sale.completedAt ?? sale.createdAt), w)));
  parts.push(...line(padLine('Cashier:', sale.cashier.email.split('@')[0]!, w)));

  if (sale.customer) {
    parts.push(...line(padLine('Customer:', sale.customer.name, w)));
  }

  parts.push(...line(divider(w)));

  // Column headers
  parts.push(ESC_BOLD_ON);
  parts.push(...line(padLine('Item', 'Amount', w)));
  parts.push(ESC_BOLD_OFF);
  parts.push(...line(divider(w)));

  // Line items
  for (const sl of sale.lines) {
    const name =
      sl.productNameSnapshot.length > w - 12
        ? sl.productNameSnapshot.slice(0, w - 12)
        : sl.productNameSnapshot;

    parts.push(...line(name));

    const qtyPrice = `  ${sl.quantity} x ${formatMoney(sl.unitPrice)}`;
    const lineTotal = formatMoney(sl.lineTotalAfterDiscount);
    parts.push(...line(padLine(qtyPrice, lineTotal, w)));

    if (Number(sl.discountAmount) > 0) {
      parts.push(...line(padLine('  Disc:', `-${formatMoney(sl.discountAmount)}`, w)));
    }
  }

  parts.push(...line(divider(w)));

  // Totals
  parts.push(...line(padLine('Subtotal:', formatMoney(sale.subtotal), w)));

  if (Number(sale.discountAmount) > 0) {
    parts.push(...line(padLine('Discount:', `-${formatMoney(sale.discountAmount)}`, w)));
  }

  parts.push(...line(padLine('Tax:', formatMoney(sale.taxAmount), w)));

  parts.push(ESC_BOLD_ON);
  parts.push(...line(padLine('TOTAL:', formatMoney(sale.totalAmount), w)));
  parts.push(ESC_BOLD_OFF);

  parts.push(...line(divider(w)));

  // Payments
  for (const pmt of sale.payments) {
    const label = pmt.method === 'CASH' ? 'Cash' : 'Card';
    parts.push(...line(padLine(label + ':', formatMoney(pmt.amount), w)));
  }

  if (sale.changeGiven && Number(sale.changeGiven) > 0) {
    parts.push(...line(padLine('Change:', formatMoney(sale.changeGiven), w)));
  }

  parts.push(...line(divider(w)));

  // Footer
  parts.push(ESC_ALIGN_CENTER);

  if ((settings as any)?.receiptFooter) {
    parts.push(...line(String((settings as any).receiptFooter)));
  } else {
    parts.push(...line('Thank you for your purchase!'));
  }

  parts.push(...line(''));
  parts.push(...line(''));
  parts.push(GS_CUT);

  const data = buildReceiptBuffer(parts);
  await sendToPrinter(printerConfig, data);
}

// ── printZReport ─────────────────────────────────────────────────────────────

export async function printZReport(shiftId: string): Promise<void> {
  const shift = await prisma.shift.findUniqueOrThrow({
    where: { id: shiftId },
    include: {
      tenant: true,
      cashier: true,
      closure: true,
      sales: { where: { status: 'COMPLETED' }, include: { payments: true } },
      cashMovements: true,
    },
  });

  const tenant = shift.tenant;
  const settings = tenant.settings as Record<string, unknown> | null;
  const printerConfig: PrinterConfig = {
    type: 'NETWORK',
    host: (settings as any)?.hardware?.printer?.host ?? '192.168.1.100',
    port: (settings as any)?.hardware?.printer?.port ?? 9100,
    paperWidth: (settings as any)?.hardware?.printer?.paperWidth ?? '58mm',
  };

  const w = getLineWidth(printerConfig);
  const parts: Buffer[] = [];

  // Compute totals
  let totalSalesAmount = 0;
  let totalCash = 0;
  let totalCard = 0;
  let salesCount = 0;

  for (const sale of shift.sales) {
    salesCount++;
    totalSalesAmount += Number(sale.totalAmount);
    for (const pmt of sale.payments) {
      if (pmt.method === 'CASH') totalCash += Number(pmt.amount);
      else totalCard += Number(pmt.amount);
    }
  }

  let cashMovementsIn = 0;
  let cashMovementsOut = 0;

  for (const cm of shift.cashMovements) {
    const amt = Number(cm.amount);
    if (cm.type === 'MANUAL_IN' || cm.type === 'OPENING_FLOAT') {
      cashMovementsIn += amt;
    } else {
      cashMovementsOut += amt;
    }
  }

  const openingFloat = Number(shift.openingFloat);
  const expectedCash = openingFloat + totalCash + cashMovementsIn - cashMovementsOut;

  // Initialize
  parts.push(ESC_INIT);

  // Header
  parts.push(ESC_ALIGN_CENTER, ESC_DOUBLE_HEIGHT);
  parts.push(...line('Z-REPORT'));
  parts.push(ESC_NORMAL);
  parts.push(...line(tenant.name));
  parts.push(...line(divider(w)));
  parts.push(ESC_ALIGN_LEFT);

  // Shift info
  parts.push(...line(padLine('Shift:', shift.id.slice(-8).toUpperCase(), w)));
  parts.push(...line(padLine('Cashier:', shift.cashier.email.split('@')[0]!, w)));
  parts.push(...line(padLine('Opened:', formatDate(shift.openedAt), w)));

  if (shift.closedAt) {
    parts.push(...line(padLine('Closed:', formatDate(shift.closedAt), w)));
  }

  parts.push(...line(divider(w)));

  // Sales summary
  parts.push(ESC_BOLD_ON);
  parts.push(...line('SALES SUMMARY'));
  parts.push(ESC_BOLD_OFF);
  parts.push(...line(padLine('Transactions:', String(salesCount), w)));
  parts.push(...line(padLine('Gross Sales:', formatMoney(totalSalesAmount), w)));

  // Returns (from closure if available)
  if (shift.closure) {
    const returnsAmt = Number(shift.closure.totalReturnsAmount);
    const returnsCount = shift.closure.totalReturnsCount;
    if (returnsCount > 0) {
      parts.push(...line(padLine('Returns:', `-${formatMoney(returnsAmt)}`, w)));
      parts.push(
        ...line(padLine('Net Revenue:', formatMoney(totalSalesAmount - returnsAmt), w)),
      );
    }
  }

  parts.push(...line(divider(w)));

  // Payment breakdown
  parts.push(ESC_BOLD_ON);
  parts.push(...line('PAYMENT BREAKDOWN'));
  parts.push(ESC_BOLD_OFF);
  parts.push(...line(padLine('Cash:', formatMoney(totalCash), w)));
  parts.push(...line(padLine('Card:', formatMoney(totalCard), w)));
  parts.push(...line(padLine('Total:', formatMoney(totalSalesAmount), w)));

  parts.push(...line(divider(w)));

  // Cash movements
  if (shift.cashMovements.length > 0) {
    parts.push(ESC_BOLD_ON);
    parts.push(...line('CASH MOVEMENTS'));
    parts.push(ESC_BOLD_OFF);

    for (const cm of shift.cashMovements) {
      const label = cm.type.replace(/_/g, ' ');
      const prefix = cm.type === 'PETTY_CASH_OUT' || cm.type === 'MANUAL_OUT' ? '-' : '+';
      parts.push(...line(padLine(label, `${prefix}${formatMoney(cm.amount)}`, w)));
    }

    parts.push(...line(divider(w)));
  }

  // Cash reconciliation
  parts.push(ESC_BOLD_ON);
  parts.push(...line('CASH RECONCILIATION'));
  parts.push(ESC_BOLD_OFF);
  parts.push(...line(padLine('Opening Float:', formatMoney(openingFloat), w)));
  parts.push(...line(padLine('+ Cash Sales:', formatMoney(totalCash), w)));
  parts.push(...line(padLine('+ Cash In:', formatMoney(cashMovementsIn), w)));
  parts.push(...line(padLine('- Cash Out:', formatMoney(cashMovementsOut), w)));
  parts.push(...line(padLine('Expected Cash:', formatMoney(expectedCash), w)));

  if (shift.closure) {
    const actual = Number(shift.closure.closingCashCount);
    const variance = Number(shift.closure.cashDifference);
    parts.push(...line(padLine('Actual Cash:', formatMoney(actual), w)));

    parts.push(ESC_BOLD_ON);
    const varianceLabel = variance >= 0 ? `+${formatMoney(variance)}` : formatMoney(variance);
    parts.push(...line(padLine('Variance:', varianceLabel, w)));
    parts.push(ESC_BOLD_OFF);
  }

  parts.push(...line(divider(w)));

  // Footer
  parts.push(ESC_ALIGN_CENTER);
  parts.push(...line(`Printed: ${formatDate(new Date())}`));
  parts.push(...line(''));
  parts.push(...line(''));
  parts.push(GS_CUT);

  const data = buildReceiptBuffer(parts);
  await sendToPrinter(printerConfig, data);
}

// ── testPrint ────────────────────────────────────────────────────────────────

export async function testPrint(printerConfig: PrinterConfig): Promise<void> {
  const w = getLineWidth(printerConfig);
  const parts: Buffer[] = [];

  parts.push(ESC_INIT);
  parts.push(ESC_ALIGN_CENTER);
  parts.push(ESC_DOUBLE_HEIGHT);
  parts.push(...line('VelvetPOS'));
  parts.push(ESC_NORMAL);
  parts.push(...line(divider(w)));
  parts.push(...line('Printer OK'));
  parts.push(...line(formatDate(new Date())));
  parts.push(...line(divider(w)));
  parts.push(...line(''));
  parts.push(...line(''));
  parts.push(GS_CUT);

  const data = buildReceiptBuffer(parts);
  await sendToPrinter(printerConfig, data);
}
