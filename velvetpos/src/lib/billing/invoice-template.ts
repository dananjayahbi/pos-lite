import Decimal from "decimal.js";

// ─── Invoice HTML Template ──────────────────────────────────────────────────

interface InvoiceTemplateData {
  invoiceNumber: string;
  createdAt: Date;
  dueDate: Date;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  amount: Decimal | { toString(): string };
  currency: string;
  status: string;
  paidAt: Date | null;
  tenant: { name: string };
  subscription: { plan: { name: string } };
  ownerEmail: string;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function statusBadgeColor(status: string): {
  bg: string;
  text: string;
  label: string;
} {
  switch (status) {
    case "PAID":
      return { bg: "#d4edda", text: "#155724", label: "Paid" };
    case "FAILED":
      return { bg: "#f8d7da", text: "#721c24", label: "Failed" };
    case "VOIDED":
      return { bg: "#e2e3e5", text: "#383d41", label: "Voided" };
    default:
      return { bg: "#fff3cd", text: "#856404", label: "Pending" };
  }
}

export function generateInvoiceHtml(data: InvoiceTemplateData): string {
  const amount = new Decimal(data.amount.toString()).toFixed(2);
  const badge = statusBadgeColor(data.status);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${data.invoiceNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --espresso: #2C1810;
      --pearl: #FAF7F2;
      --linen: #F5F0E8;
      --sand: #D4C5B2;
      --accent: #8B6F47;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', sans-serif;
      background: var(--pearl);
      color: var(--espresso);
      line-height: 1.6;
      padding: 40px;
    }

    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid var(--sand);
      border-radius: 12px;
      overflow: hidden;
    }

    .header {
      background: var(--espresso);
      color: var(--pearl);
      padding: 32px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header h1 {
      font-family: 'Playfair Display', serif;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 1px;
    }

    .header .invoice-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      opacity: 0.8;
      text-align: right;
    }

    .header .invoice-number {
      font-family: 'JetBrains Mono', monospace;
      font-size: 18px;
      font-weight: 500;
      margin-top: 4px;
    }

    .body {
      padding: 40px;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 40px;
    }

    .meta-section h3 {
      font-family: 'Playfair Display', serif;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--accent);
      margin-bottom: 12px;
      border-bottom: 2px solid var(--linen);
      padding-bottom: 6px;
    }

    .meta-section p {
      font-size: 14px;
      margin-bottom: 4px;
    }

    .meta-section .label {
      color: #6b5b4f;
      font-size: 12px;
    }

    .meta-section .value {
      font-weight: 500;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 32px;
    }

    thead th {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--accent);
      padding: 12px 16px;
      border-bottom: 2px solid var(--espresso);
      text-align: left;
    }

    thead th:last-child,
    thead th:nth-child(3) {
      text-align: right;
    }

    tbody td {
      padding: 16px;
      border-bottom: 1px solid var(--linen);
      font-size: 14px;
    }

    tbody td:last-child,
    tbody td:nth-child(3) {
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
    }

    .totals {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 40px;
    }

    .totals-table {
      width: 280px;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
    }

    .totals-row.total {
      border-top: 2px solid var(--espresso);
      margin-top: 8px;
      padding-top: 12px;
      font-weight: 600;
      font-size: 18px;
    }

    .totals-row .amount {
      font-family: 'JetBrains Mono', monospace;
    }

    .footer {
      background: var(--linen);
      padding: 24px 40px;
      text-align: center;
      font-size: 12px;
      color: #6b5b4f;
    }

    .footer a {
      color: var(--accent);
      text-decoration: none;
    }

    @media print {
      body {
        background: #fff;
        padding: 0;
      }

      .invoice-container {
        border: none;
        border-radius: 0;
        box-shadow: none;
      }

      .header {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .status-badge {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .footer {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div>
        <h1>VelvetPOS</h1>
        <p style="font-size:13px; opacity:0.7; margin-top:4px;">Point of Sale Platform</p>
      </div>
      <div>
        <div class="invoice-label">INVOICE</div>
        <div class="invoice-number">${escapeHtml(data.invoiceNumber)}</div>
      </div>
    </div>

    <div class="body">
      <div class="meta-grid">
        <div class="meta-section">
          <h3>Bill To</h3>
          <p class="value">${escapeHtml(data.tenant.name)}</p>
          <p>${escapeHtml(data.ownerEmail)}</p>
        </div>
        <div class="meta-section" style="text-align: right;">
          <h3>Invoice Details</h3>
          <p><span class="label">Date: </span><span class="value">${formatDate(data.createdAt)}</span></p>
          <p><span class="label">Due: </span><span class="value">${formatDate(data.dueDate)}</span></p>
          <p><span class="label">Period: </span><span class="value">${formatDate(data.billingPeriodStart)} — ${formatDate(data.billingPeriodEnd)}</span></p>
          <p style="margin-top: 8px;">
            <span class="status-badge" style="background:${badge.bg}; color:${badge.text};">${badge.label}</span>
            ${data.paidAt ? `<br/><span class="label" style="font-size:11px;">Paid on ${formatDate(data.paidAt)}</span>` : ""}
          </p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(data.subscription.plan.name)} Plan — Subscription</td>
            <td>1</td>
            <td>${escapeHtml(data.currency)} ${amount}</td>
            <td>${escapeHtml(data.currency)} ${amount}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-table">
          <div class="totals-row">
            <span>Subtotal</span>
            <span class="amount">${escapeHtml(data.currency)} ${amount}</span>
          </div>
          <div class="totals-row total">
            <span>Total</span>
            <span class="amount">${escapeHtml(data.currency)} ${amount}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>VelvetPOS &middot; Subscription Invoice</p>
      <p style="margin-top:4px;">Thank you for your business. Use Ctrl+P / Cmd+P to save as PDF.</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
