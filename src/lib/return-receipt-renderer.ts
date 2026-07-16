import { formatRupee } from '@/lib/format';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptReturn {
  id: string;
  originalSaleId: string;
  refundMethod: string;
  refundAmount: { toString(): string } | number;
  restockItems: boolean;
  reason: string;
  createdAt: Date | string;
  lines: Array<{
    productNameSnapshot: string;
    variantDescriptionSnapshot: string;
    quantity: number;
    unitPrice: { toString(): string } | number;
    lineRefundAmount: { toString(): string } | number;
    isRestocked: boolean;
  }>;
}

export interface ReceiptTenant {
  name: string;
  settings: unknown;
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

export function buildReturnReceiptHtml(
  returnData: ReceiptReturn,
  tenant: ReceiptTenant,
  cashierName: string,
  managerName: string,
): string {
  const s = getSettings(tenant.settings);
  const { date, time } = formatDate(returnData.createdAt);
  const returnRef = returnData.id.slice(0, 8).toUpperCase();
  const saleRef = returnData.originalSaleId.slice(0, 8).toUpperCase();

  const storeAddress = typeof s.address === 'string' ? s.address : '';
  const storePhone = typeof s.phoneNumber === 'string' ? s.phoneNumber : '';
  const receiptFooter =
    typeof s.receiptFooter === 'string'
      ? s.receiptFooter
      : 'Thank you for visiting!';

  // ── Line items ──
  let linesHtml = '';
  for (const line of returnData.lines) {
    const name = esc(truncate(line.productNameSnapshot, 24));
    const variant = esc(line.variantDescriptionSnapshot);
    const qty = line.quantity;
    const price = formatRupee(n(line.unitPrice));
    const lineTotal = formatRupee(n(line.lineRefundAmount));

    linesHtml += `
      <div class="line-item">
        <div class="item-name">${name}</div>
        ${variant ? `<div class="item-variant">${variant}</div>` : ''}
        <div class="item-row">
          <span>Qty: ${qty} @ ${price}</span>
          <span>= ${lineTotal}</span>
        </div>
      </div>`;
  }

  // ── Refund method details ──
  const refundMethod = returnData.refundMethod;
  let refundMethodLabel = refundMethod;
  let refundDetailHtml = '';

  if (refundMethod === 'CASH') {
    refundMethodLabel = 'Cash Refund';
  } else if (refundMethod === 'CARD_REVERSAL') {
    refundMethodLabel = 'Card Reversal';
    refundDetailHtml = '<div class="item-variant">Reversal Ref: N/A</div>';
  } else if (refundMethod === 'STORE_CREDIT') {
    refundMethodLabel = 'Store Credit';
    refundDetailHtml =
      '<div class="item-variant">Credit Note Issued — Redeemable in future purchase.</div>';
  } else if (refundMethod === 'EXCHANGE') {
    refundMethodLabel = 'Exchange';
  }

  // ── Inventory status ──
  const inventoryStatus = returnData.restockItems
    ? 'Items returned to stock'
    : 'Items not restocked';

  const now = new Date();
  const printTimestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Return Receipt – ${esc(returnRef)}</title>
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
  .store-name { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
  .store-info { font-size: 10px; color: #333; }
  .separator { border-top: 1px dashed #000; margin: 6px 0; }
  .meta-row { display: flex; justify-content: space-between; font-size: 11px; }
  .line-item { margin: 4px 0; }
  .item-name { font-weight: bold; font-size: 12px; }
  .item-variant { font-size: 10px; color: #555; padding-left: 8px; }
  .item-row { display: flex; justify-content: space-between; font-size: 11px; }
  .totals .item-row { font-size: 12px; margin: 2px 0; }
  .grand-total { font-size: 16px; font-weight: bold; }
  .return-title { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin: 4px 0; }
  .footer { font-size: 10px; color: #555; margin-top: 8px; text-align: center; }
  .powered { font-size: 9px; color: #999; margin-top: 4px; }
  .inventory-note { font-size: 10px; color: #333; text-align: center; margin: 4px 0; }
</style>
</head>
<body>

<div class="center">
  <div class="store-name">${esc(tenant.name)}</div>
  ${storeAddress ? `<div class="store-info">${esc(storeAddress)}</div>` : ''}
  ${storePhone ? `<div class="store-info">Tel: ${esc(storePhone)}</div>` : ''}
</div>

<div class="separator"></div>

<div class="center">
  <div class="return-title">Return Receipt</div>
</div>

<div class="meta-row"><span>Original Sale: ${esc(saleRef)}</span></div>
<div class="meta-row"><span>Return Ref: ${esc(returnRef)}</span></div>
<div class="meta-row"><span>Date: ${date}</span><span>Time: ${time}</span></div>
<div class="meta-row"><span>Cashier: ${esc(cashierName)}</span></div>
<div class="meta-row"><span>Authorized By: ${esc(managerName)}</span></div>

<div class="separator"></div>

${linesHtml}

<div class="separator"></div>

<div class="totals">
  <div class="item-row grand-total"><span>TOTAL REFUND</span><span>${formatRupee(n(returnData.refundAmount))}</span></div>
</div>

<div class="meta-row" style="margin-top:4px;"><span>Refund Method: ${esc(refundMethodLabel)}</span></div>
${refundDetailHtml}

<div class="separator"></div>

<div class="inventory-note">${esc(inventoryStatus)}</div>

<div class="separator"></div>

<div class="footer">
  ${esc(receiptFooter)}
  <div class="powered">Powered by VelvetPOS</div>
  <div style="font-size:9px;color:#aaa;margin-top:2px;">Printed: ${printTimestamp}</div>
</div>

<script>setTimeout(function(){window.print()},200);</script>
</body>
</html>`;
}
