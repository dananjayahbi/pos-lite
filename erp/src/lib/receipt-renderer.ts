import { formatRupee } from '@/lib/format';
import { reprintIdentityNotice } from '@/lib/receipt-identity.core';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptSale {
  id: string;
  subtotal: { toString(): string } | number;
  discountAmount: { toString(): string } | number;
  taxAmount: { toString(): string } | number;
  totalAmount: { toString(): string } | number;
  changeGiven?: { toString(): string } | number | null;
  paymentMethod: string | null;
  /** A voided sale must print a VOID stamp and label reversed tenders. */
  status?: string | null;
  createdAt: Date | string;
  lines: Array<{
    productNameSnapshot: string;
    variantDescriptionSnapshot: string;
    quantity: number;
    unitPrice: { toString(): string } | number;
    discountPercent: { toString(): string } | number;
    discountAmount: { toString(): string } | number;
    lineTotalBeforeDiscount: { toString(): string } | number;
    lineTotalAfterDiscount: { toString(): string } | number;
  }>;
  payments: Array<{
    method: string;
    amount: { toString(): string } | number;
    cardReferenceNumber?: string | null;
  }>;
}

export interface ReceiptTenant {
  name: string;
  /** Uploaded store logo; printed on the thermal header (ARGUS #474). */
  logoUrl?: string | null;
  settings: unknown;
}

export interface ReceiptRenderOptions {
  /**
   * True when an already-completed sale is being reprinted. Store identity is
   * read from the current tenant, so the document carries a caveat (ARGUS #472).
   */
  isReprint?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function n(val: { toString(): string } | number | null | undefined): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val.toString());
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function formatDate(d: Date | string): { date: string; time: string } {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return { date: `${dd}/${mm}/${yyyy}`, time: `${hh}:${min}` };
}

function getSettings(settings: unknown): Record<string, unknown> {
  return typeof settings === 'object' && settings !== null
    ? (settings as Record<string, unknown>)
    : {};
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Builder ──────────────────────────────────────────────────────────────────

export function buildThermalReceiptHtml(
  sale: ReceiptSale,
  tenant: ReceiptTenant,
  cashierName: string,
  options: ReceiptRenderOptions = {},
): string {
  const s = getSettings(tenant.settings);
  const { date, time } = formatDate(sale.createdAt);
  const saleRef = sale.id.slice(0, 8).toUpperCase();
  const identityNotice = reprintIdentityNotice(options.isReprint);
  const isVoided = sale.status === 'VOIDED';

  const storeAddress = typeof s.address === 'string' ? s.address : '';
  const storePhone = typeof s.phoneNumber === 'string' ? s.phoneNumber : '';
  const logoUrl = typeof tenant.logoUrl === 'string' ? tenant.logoUrl.trim() : '';
  const receiptFooter =
    typeof s.receiptFooter === 'string'
      ? s.receiptFooter
      : 'Thank you for your purchase!';

  // ── Line items ──
  let linesHtml = '';
  for (const line of sale.lines) {
    const name = esc(truncate(line.productNameSnapshot, 24));
    const variant = esc(line.variantDescriptionSnapshot);
    const qty = line.quantity;
    const price = formatRupee(n(line.unitPrice));
    const lineTotal = formatRupee(n(line.lineTotalAfterDiscount));
    const discAmt = n(line.discountAmount);

    linesHtml += `
      <div class="line-item">
        <div class="item-name">${name}</div>
        ${variant ? `<div class="item-variant">${variant}</div>` : ''}
        <div class="item-row">
          <span>${qty} × ${price}</span>
          <span>${lineTotal}</span>
        </div>
        ${discAmt > 0 ? `<div class="item-discount">Disc: -${formatRupee(discAmt)}</div>` : ''}
      </div>`;
  }

  // ── Payments ──
  let paymentsHtml = '';
  const paymentLabels: Record<string, string> = {
    CASH: 'Cash',
    CARD: 'Card',
    LANKAQR: 'LankaQR',
    STORE_CREDIT: 'Store Credit',
    EXCHANGE_CREDIT: 'Exchange Credit',
  };
  for (const p of sale.payments) {
    const methodLabel = paymentLabels[p.method] ?? p.method;
    paymentsHtml += `
      <div class="item-row">
        <span>${esc(methodLabel)}${isVoided ? ' (reversed)' : ''}</span>
        <span>${formatRupee(n(p.amount))}</span>
      </div>`;
    if (p.cardReferenceNumber) {
      paymentsHtml += `<div class="item-variant">Ref: ${esc(p.cardReferenceNumber)}</div>`;
    }
  }

  const changeGiven = n(sale.changeGiven);

  const now = new Date();
  const printTimestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Receipt${isVoided ? ' (VOID)' : ''} – ${esc(saleRef)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.4;
    width: 80mm;
    max-width: 80mm;
    color: #000;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .void-stamp {
    border: 3px solid #9B2226;
    color: #9B2226;
    font-size: 28px;
    font-weight: bold;
    letter-spacing: 6px;
    text-align: center;
    padding: 4px 0;
    margin: 6px 0 2px;
  }
  .void-note {
    color: #9B2226;
    font-size: 10px;
    text-align: center;
    margin-bottom: 4px;
  }
  .store-name { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
  .brand-logo { max-width: 34mm; max-height: 16mm; object-fit: contain; margin-bottom: 2px; }
  .store-info { font-size: 10px; color: #333; }
  .separator { border-top: 1px dashed #000; margin: 6px 0; }
  .meta-row { display: flex; justify-content: space-between; font-size: 11px; }
  .line-item { margin: 4px 0; }
  .item-name { font-weight: bold; font-size: 12px; }
  .item-variant { font-size: 10px; color: #555; padding-left: 8px; }
  .item-row { display: flex; justify-content: space-between; font-size: 11px; }
  .item-discount { font-size: 10px; color: #900; padding-left: 8px; }
  .totals .item-row { font-size: 12px; margin: 2px 0; }
  .grand-total { font-size: 16px; font-weight: bold; }
  .footer { font-size: 10px; color: #555; margin-top: 8px; text-align: center; }
  .powered { font-size: 9px; color: #999; margin-top: 4px; }
</style>
</head>
<body>

<div class="center">
  ${logoUrl ? `<img class="brand-logo" src="${esc(logoUrl)}" alt="${esc(tenant.name)} logo" />` : ''}
  <div class="store-name">${esc(tenant.name)}</div>
  ${storeAddress ? `<div class="store-info">${esc(storeAddress)}</div>` : ''}
  ${storePhone ? `<div class="store-info">Tel: ${esc(storePhone)}</div>` : ''}
  ${identityNotice ? `<div class="store-info" style="margin-top:4px;border-top:1px dashed #000;padding-top:4px;">${esc(identityNotice)}</div>` : ''}
</div>

${isVoided ? `<div class="void-stamp">VOID</div><div class="void-note">This sale was voided. Stock and tenders were reversed; this is not a valid receipt.</div>` : ''}

<div class="separator"></div>

<div class="meta-row"><span>Ref: ${esc(saleRef)}</span><span>Cashier: ${esc(cashierName)}</span></div>
<div class="meta-row"><span>Date: ${date}</span><span>Time: ${time}</span></div>

<div class="separator"></div>

${linesHtml}

<div class="separator"></div>

<div class="totals">
  ${n(sale.discountAmount) > 0 ? `<div class="item-row"><span>Cart Discount</span><span>-${formatRupee(n(sale.discountAmount))}</span></div>` : ''}
  <div class="item-row"><span>Subtotal</span><span>${formatRupee(n(sale.subtotal))}</span></div>
  <div class="item-row"><span>Tax</span><span>${formatRupee(n(sale.taxAmount))}</span></div>
  <div class="separator"></div>
  <div class="item-row grand-total"><span>TOTAL</span><span>${formatRupee(n(sale.totalAmount))}</span></div>
</div>

<div class="separator"></div>

<div class="totals">
  <div class="bold" style="font-size:11px;margin-bottom:4px;">Payment</div>
  ${paymentsHtml}
  ${sale.paymentMethod === 'CASH' && changeGiven > 0 ? `
  <div class="separator"></div>
  <div class="item-row"><span>Cash Received</span><span>${formatRupee(n(sale.totalAmount) + changeGiven)}</span></div>
  <div class="item-row bold"><span>Change</span><span>${formatRupee(changeGiven)}</span></div>
  ` : ''}
</div>

<div class="separator"></div>

<div class="footer">
  ${esc(receiptFooter)}
  <div class="powered">Powered by AyurPOS</div>
  <div style="font-size:9px;color:#aaa;margin-top:2px;">Printed: ${printTimestamp}</div>
</div>

<script>setTimeout(function(){window.print()},200);</script>
</body>
</html>`;
}
