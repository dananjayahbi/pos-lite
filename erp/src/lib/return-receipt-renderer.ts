import { formatRupee } from '@/lib/format';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptReturn {
  id: string;
  originalSaleId: string;
  refundMethod: string;
  refundAmount: { toString(): string } | number;
  /** Tax component included in refundAmount (0 on legacy returns). */
  taxAmount?: { toString(): string } | number | null;
  restockItems: boolean;
  reason: string;
  createdAt: Date | string;
  /** Original sale totals, shown so the customer can see the sale context. */
  originalSale?: {
    totalAmount: { toString(): string } | number;
    taxAmount?: { toString(): string } | number | null;
    deliveryCharge?: { toString(): string } | number | null;
    /** Tender header/legs used to name a card/QR reversal truthfully. */
    paymentMethod?: string | null;
    payments?: Array<{ method: string }> | null;
  } | null;
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
  logoUrl?: string | null;
  settings: unknown;
}

// ── Brand palette (matches globals.css) ──────────────────────────────────────

const ESPRESSO = '#3A2D28';
const TERRACOTTA = '#A48374';
const SAND = '#CBAD8D';
const MIST = '#D1C7BD';
const LINEN = '#EBE3DB';
const MUTED_INK = '#7B6E64';

// ── Helpers ──────────────────────────────────────────────────────────────────

function n(val: { toString(): string } | number | null | undefined): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val.toString());
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

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0] ?? '')
      .join('')
      .toUpperCase() || 'AY'
  );
}

/**
 * ARGUS #96/#101: name the digital tender actually collected. Payment legs are
 * authoritative (a split sale can have cash + card/QR); the sale header is the
 * fallback for legacy rows. Returns null when only cash/unknown was collected,
 * so the receipt never claims "original card" for a QR-only sale.
 */
function originalDigitalTenderLabel(
  originalSale: NonNullable<ReceiptReturn['originalSale']>,
): string | null {
  const methods = new Set(
    (originalSale.payments ?? []).map((payment) => payment.method),
  );
  const hasCard = methods.has('CARD');
  const hasQr = methods.has('LANKAQR');

  if (hasCard && hasQr) return 'card/LankaQR';
  if (hasQr) return 'LankaQR';
  if (hasCard) return 'card';

  if (originalSale.paymentMethod === 'LANKAQR') return 'LankaQR';
  if (originalSale.paymentMethod === 'CARD') return 'card';
  if (originalSale.paymentMethod === 'SPLIT') return 'card/QR';
  return null;
}

// ── Builder ──────────────────────────────────────────────────────────────────

/**
 * Builds the printable return receipt as a standalone A4 portrait page.
 *
 * Layout mirrors the branded order invoice (`OrderInvoice`): white sheet, tenant
 * logo with a monogram fallback, espresso text, terracotta/sand accents and thin
 * rules instead of dark bands. The page is sized for A4 only (180 mm content
 * width inside 10 mm margins), so it no longer prints as an 80 mm thermal slip
 * stretched across a landscape A4 sheet.
 *
 * The document is opened in a new tab by the returns UI. Scripts are limited to
 * the auto-print call; all tenant/return text is escaped.
 */
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
    typeof s.receiptFooter === 'string' && s.receiptFooter.trim() !== ''
      ? s.receiptFooter
      : 'Thank you for shopping with us!';
  const logoUrl = typeof tenant.logoUrl === 'string' ? tenant.logoUrl.trim() : '';

  // ── Line items ──
  let linesHtml = '';
  let totalQuantity = 0;
  for (const line of returnData.lines) {
    totalQuantity += line.quantity;
    const name = esc(line.productNameSnapshot);
    const variant = esc(line.variantDescriptionSnapshot);
    const price = formatRupee(n(line.unitPrice));
    const lineTotal = formatRupee(n(line.lineRefundAmount));
    const restocked = line.isRestocked
      ? '<span class="pill pill-yes">Restocked</span>'
      : '<span class="pill pill-no">Not restocked</span>';

    linesHtml += `
          <tr>
            <td>${name}</td>
            <td class="variant">${variant || '-'}</td>
            <td class="num">${line.quantity}</td>
            <td class="num">${price}</td>
            <td class="num strong">${lineTotal}</td>
            <td class="center">${restocked}</td>
          </tr>`;
  }

  if (returnData.lines.length === 0) {
    linesHtml = `
          <tr>
            <td colspan="6" class="empty">No item lines were recorded for this return.</td>
          </tr>`;
  }

  // ── Refund method details ──
  const refundMethod = returnData.refundMethod;
  let refundMethodLabel = refundMethod;
  let refundNote = '';

  if (refundMethod === 'CASH') {
    refundMethodLabel = 'Cash Refund';
    refundNote = 'Cash was handed back to the customer at the counter.';
  } else if (refundMethod === 'CARD_REVERSAL') {
    refundMethodLabel = 'Card Reversal';
    // ARGUS #96/#101: a reversal is only allowed against a card/QR tender, and
    // the receipt must name the channel actually used (QR is not a card).
    const tender = returnData.originalSale
      ? originalDigitalTenderLabel(returnData.originalSale)
      : null;
    refundNote = tender
      ? `The refund is reversed to the original ${tender} payment channel.`
      : 'The refund is reversed through the original card/QR payment channel.';
  } else if (refundMethod === 'STORE_CREDIT') {
    refundMethodLabel = 'Store Credit';
    // There is no separate credit-note redemption/expiry; the refund simply
    // lands on the customer's existing store-credit balance (ARGUS #101).
    refundNote =
      "The refund has been added to the customer's store-credit balance and can be used on a future purchase.";
  } else if (refundMethod === 'EXCHANGE') {
    refundMethodLabel = 'Exchange';
    refundNote = 'The returned items were exchanged for other items in store.';
  }

  // ── Inventory status ──
  const allRestocked =
    returnData.lines.length > 0 && returnData.lines.every((line) => line.isRestocked);
  const anyRestocked = returnData.lines.some((line) => line.isRestocked);
  const restockStatus = allRestocked
    ? 'All items returned to stock'
    : anyRestocked
      ? 'Partially returned to stock'
      : 'Not returned to stock';

  const now = new Date();
  const printTimestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const taxRefunded = n(returnData.taxAmount);
  const totalRefund = n(returnData.refundAmount);
  const taxProvided = returnData.taxAmount != null;
  const goodsRefunded = Math.max(totalRefund - taxRefunded, 0);
  const originalSaleTotal =
    returnData.originalSale != null ? n(returnData.originalSale.totalAmount) : null;
  const notRefunded =
    originalSaleTotal !== null ? originalSaleTotal - totalRefund : null;

  const logoHtml = logoUrl
    ? `<img class="brand-logo" src="${esc(logoUrl)}" alt="${esc(tenant.name)} logo" />`
    : `<div class="brand-logo brand-monogram" aria-hidden="true">${esc(initialsOf(tenant.name))}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Return Receipt – ${esc(returnRef)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body { background: #ffffff; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: ${ESPRESSO};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* A4 at 96 dpi is 794 px; 180 mm is the printable width inside 10 mm margins. */
  .sheet {
    width: 180mm;
    max-width: 100%;
    margin: 0 auto;
    padding: 8mm 0 6mm;
  }

  .doc-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8mm;
    padding-bottom: 4mm;
    border-bottom: 2px solid ${ESPRESSO};
  }

  .brand { display: flex; align-items: flex-start; gap: 3.5mm; min-width: 0; }

  .brand-logo {
    width: 16mm;
    height: 16mm;
    border-radius: 2mm;
    object-fit: contain;
    flex: 0 0 auto;
  }

  .brand-monogram {
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${LINEN};
    color: ${TERRACOTTA};
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 18pt;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .brand-name {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 20pt;
    font-weight: 700;
    line-height: 1.1;
    color: ${ESPRESSO};
  }

  .brand-meta {
    margin-top: 1mm;
    font-size: 9pt;
    color: ${MUTED_INK};
  }

  .doc-id { text-align: right; flex: 0 0 auto; }

  .doc-kicker {
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${TERRACOTTA};
  }

  .doc-ref {
    margin-top: 1mm;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 16pt;
    font-weight: 700;
    line-height: 1.1;
  }

  .doc-date { margin-top: 1mm; font-size: 9pt; color: ${MUTED_INK}; }

  /* ── Summary ── */
  .summary {
    margin-top: 5mm;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 3mm;
  }

  .summary-cell {
    border: 1px solid ${MIST};
    border-radius: 2mm;
    padding: 2.5mm 3mm;
    background: #ffffff;
  }

  .summary-cell.wide { grid-column: span 3; }

  .label {
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${MUTED_INK};
  }

  .value {
    margin-top: 0.8mm;
    font-size: 10.5pt;
    font-weight: 600;
    word-break: break-word;
  }

  .value.mono {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 10pt;
  }

  .value .sub { font-weight: 400; color: ${MUTED_INK}; }

  .badge {
    display: inline-block;
    margin-top: 0.8mm;
    padding: 0.6mm 2.2mm;
    border: 1px solid ${SAND};
    border-radius: 999px;
    background: ${LINEN};
    font-size: 8.5pt;
    font-weight: 700;
    color: ${ESPRESSO};
  }

  /* ── Items ── */
  .section-title {
    margin: 6mm 0 2mm;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 12pt;
    font-weight: 700;
    color: ${ESPRESSO};
  }

  table.items {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
  }

  table.items thead { display: table-header-group; }

  table.items th {
    padding: 2mm 2.5mm;
    border-top: 1px solid ${SAND};
    border-bottom: 1px solid ${SAND};
    background: ${LINEN};
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    text-align: left;
    color: ${MUTED_INK};
  }

  table.items td {
    padding: 2.2mm 2.5mm;
    border-bottom: 1px solid ${MIST};
    vertical-align: top;
  }

  table.items tr { break-inside: avoid; page-break-inside: avoid; }

  table.items .num { text-align: right; white-space: nowrap; }
  table.items .center { text-align: center; }
  table.items .variant { color: ${MUTED_INK}; }
  table.items .strong { font-weight: 700; }
  table.items .empty { padding: 6mm; text-align: center; color: ${MUTED_INK}; }

  .pill {
    display: inline-block;
    padding: 0.4mm 2mm;
    border-radius: 999px;
    font-size: 8pt;
    font-weight: 700;
    white-space: nowrap;
  }

  .pill-yes { background: #E7F3E8; color: #2F6B36; }
  .pill-no { background: ${LINEN}; color: ${MUTED_INK}; }

  /* ── Totals ── */
  .totals-row {
    margin-top: 5mm;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 72mm;
    gap: 6mm;
    align-items: start;
  }

  .refund-note {
    border-left: 3px solid ${TERRACOTTA};
    padding: 1mm 0 1mm 3mm;
    font-size: 9pt;
    color: ${MUTED_INK};
  }

  .refund-note strong { display: block; color: ${ESPRESSO}; font-size: 9.5pt; }

  .totals { display: flex; flex-direction: column; gap: 1.5mm; }

  .totals-line {
    display: flex;
    justify-content: space-between;
    font-size: 9.5pt;
    color: ${MUTED_INK};
  }

  .totals-line span:last-child { color: ${ESPRESSO}; font-weight: 600; }

  .totals-grand {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 4mm;
    margin-top: 1.5mm;
    padding-top: 2.5mm;
    border-top: 2px solid ${ESPRESSO};
    font-size: 11pt;
    font-weight: 700;
  }

  .totals-grand .amount {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 15pt;
    color: ${ESPRESSO};
  }

  /* ── Signatures ── */
  .signatures {
    margin-top: 12mm;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16mm;
  }

  .signature { border-top: 1px solid ${MIST}; padding-top: 1.5mm; }

  .signature .role {
    font-size: 8pt;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${MUTED_INK};
  }

  .signature .name { font-size: 9.5pt; font-weight: 600; }

  /* ── Footer ── */
  .doc-footer {
    margin-top: 10mm;
    padding-top: 3mm;
    border-top: 1px solid ${MIST};
    text-align: center;
    font-size: 8.5pt;
    color: ${MUTED_INK};
  }

  .doc-footer .powered { margin-top: 1mm; font-size: 7.5pt; color: ${MIST}; }

  /* Screen preview: white A4 sheet on a neutral desk. Print forces white. */
  @media screen {
    html, body { background: #E8E3DC; }
    body { padding: 10mm 0; }
    .sheet {
      background: #ffffff;
      width: 210mm;
      min-height: 277mm;
      padding: 10mm;
      box-shadow: 0 2mm 8mm rgba(58, 45, 40, 0.18);
    }
  }

  @media print {
    html, body { background: #ffffff !important; }
    body { padding: 0 !important; }
    .sheet { width: 180mm !important; min-height: 0 !important; padding: 0 !important; box-shadow: none !important; }
  }
</style>
</head>
<body>

<main class="sheet">

  <header class="doc-header">
    <div class="brand">
      ${logoHtml}
      <div>
        <div class="brand-name">${esc(tenant.name)}</div>
        ${storeAddress ? `<div class="brand-meta">${esc(storeAddress)}</div>` : ''}
        ${storePhone ? `<div class="brand-meta">Tel: ${esc(storePhone)}</div>` : ''}
      </div>
    </div>
    <div class="doc-id">
      <div class="doc-kicker">Return Receipt</div>
      <div class="doc-ref">${esc(returnRef)}</div>
      <div class="doc-date">${date} &middot; ${time}</div>
    </div>
  </header>

  <section class="summary">
    <div class="summary-cell">
      <div class="label">Original Sale</div>
      <div class="value mono">${esc(saleRef)}</div>
    </div>
    <div class="summary-cell">
      <div class="label">Processed By</div>
      <div class="value">${esc(cashierName)}</div>
    </div>
    <div class="summary-cell">
      <div class="label">Authorized By</div>
      <div class="value">${esc(managerName)}</div>
    </div>
    <div class="summary-cell">
      <div class="label">Refund Method</div>
      <div class="value"><span class="badge">${esc(refundMethodLabel)}</span></div>
    </div>
    <div class="summary-cell">
      <div class="label">Restock Status</div>
      <div class="value">${esc(restockStatus)}</div>
    </div>
    <div class="summary-cell">
      <div class="label">Items Returned</div>
      <div class="value">${totalQuantity} item${totalQuantity === 1 ? '' : 's'} on ${returnData.lines.length} line${returnData.lines.length === 1 ? '' : 's'}</div>
    </div>
    <div class="summary-cell wide">
      <div class="label">Return Reason</div>
      <div class="value"><span class="sub">${esc(returnData.reason || '-')}</span></div>
    </div>
  </section>

  <h2 class="section-title">Returned Items</h2>

  <table class="items">
    <thead>
      <tr>
        <th>Product</th>
        <th>Variant</th>
        <th class="num">Qty</th>
        <th class="num">Unit Price</th>
        <th class="num">Refund</th>
        <th class="center">Stock</th>
      </tr>
    </thead>
    <tbody>${linesHtml}
    </tbody>
  </table>

  <div class="totals-row">
    <div class="refund-note">
      <strong>${esc(refundMethodLabel)}</strong>
      ${esc(refundNote || '-')}
    </div>
    <div class="totals">
      <div class="totals-line"><span>Items returned</span><span>${totalQuantity}</span></div>
      <div class="totals-line"><span>Refund method</span><span>${esc(refundMethodLabel)}</span></div>
      <div class="totals-line"><span>Goods refunded</span><span>${formatRupee(goodsRefunded)}</span></div>
      ${taxProvided ? `<div class="totals-line"><span>Tax refunded</span><span>${formatRupee(taxRefunded)}</span></div>` : ''}
      ${originalSaleTotal !== null ? `<div class="totals-line"><span>Original sale total</span><span>${formatRupee(originalSaleTotal)}</span></div>` : ''}
      ${notRefunded !== null && notRefunded > 0.005 ? `<div class="totals-line"><span>Not refunded (original − refund)</span><span>${formatRupee(notRefunded)}</span></div>` : ''}
      <div class="totals-grand"><span>Total Refund</span><span class="amount">${formatRupee(totalRefund)}</span></div>
    </div>
  </div>

  <div class="signatures">
    <div class="signature">
      <div class="role">Customer Signature</div>
      <div class="name">&nbsp;</div>
    </div>
    <div class="signature">
      <div class="role">Authorized By</div>
      <div class="name">${esc(managerName)}</div>
    </div>
  </div>

  <footer class="doc-footer">
    ${esc(receiptFooter)}
    <div class="powered">Powered by AyurPOS &middot; Printed ${printTimestamp}</div>
  </footer>

</main>

<script>setTimeout(function(){window.print()},250);</script>
</body>
</html>`;
}
