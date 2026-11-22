'use client';

import { cn } from '@/lib/utils';
import { formatRupee } from '@/lib/format';
import type { OrderInvoiceData } from '@/types/order-invoice';

/**
 * Branded, printable order/shipping invoice.
 *
 * Print contract (Feature update #13):
 *  - A4 portrait only (`@page` is set by `printOrderInvoice`).
 *  - Company logo from the tenant branding, with a monogram fallback so the
 *    header always carries a brand mark.
 *  - No decorative dark fills: the header is white with an espresso rule.
 *  - Payment method/status is always shown (COD or card).
 *
 * Line items come from the linked POS sale, or from the delivery's own
 * `DeliveryLine` snapshots for website/manual orders.
 */
export function OrderInvoice({ data }: { data: OrderInvoiceData }) {
  const address = data.address;
  const fullAddress = address
    ? [
        address.addressLine1,
        address.addressLine2,
        [address.cityName, address.districtName].filter(Boolean).join(', '),
        address.postalCode,
      ]
        .filter(Boolean)
        .join(', ')
    : null;

  const customerName = data.customer?.name ?? address?.fullName ?? 'N/A';
  const customerPhone = data.customer?.phone ?? address?.phone ?? '-';

  const orderDate = new Date(data.createdAt);
  const formattedDate = Number.isNaN(orderDate.getTime())
    ? '-'
    : orderDate.toLocaleString('en-LK', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

  const hasDiscount = data.discountAmount > 0;
  const hasTax = data.taxAmount > 0;
  const hasShipping = data.shippingFee != null;

  const initials =
    data.brandName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('') || 'AY';

  const paymentMethodLabel =
    data.paymentMethod === 'CARD'
      ? data.paymentDetail
        ? `Card (${data.paymentDetail})`
        : 'Card payment'
      : 'Cash on Delivery (COD)';

  const paymentStatusLabel = (() => {
    switch (data.paymentStatus) {
      case 'PAID':
        return 'Paid';
      case 'FAILED':
        return 'Payment failed';
      case 'REFUNDED':
        return 'Refunded';
      case 'PENDING':
      default:
        return data.paymentMethod === 'COD' ? 'Collect on delivery' : 'Awaiting payment';
    }
  })();

  return (
    <div
      data-testid="order-invoice"
      className="invoice-a4 mx-auto w-[794px] max-w-full bg-white p-8 text-espresso"
      style={{ color: '#3A2D28' }}
    >
      {/* Brand header — light surface, no dark banner */}
      <header
        data-testid="invoice-header"
        className="flex items-start justify-between gap-6 border-b-2 pb-4"
        style={{ borderColor: data.borderColor }}
      >
        <div className="flex items-center gap-3">
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.logoUrl}
              alt={`${data.brandName} logo`}
              data-testid="invoice-logo"
              className="h-12 w-12 rounded object-contain"
            />
          ) : (
            <div
              data-testid="invoice-logo"
              className="flex h-12 w-12 items-center justify-center rounded font-display text-lg font-bold"
              style={{ backgroundColor: '#EBE3DB', color: data.accentColor }}
              aria-hidden
            >
              {initials}
            </div>
          )}
          <div>
            <p className="font-display text-2xl font-bold leading-tight">{data.brandName}</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-espresso/55">
              Order / Shipping Invoice
            </p>
            {/* ARGUS #490: seller contact details from the store profile. */}
            {data.seller && (
              <div
                data-testid="invoice-seller-contact"
                className="mt-1 space-y-0.5 text-[10px] leading-snug text-espresso/65"
              >
                {data.seller.address
                  .split(/\r\n|\r|\n/)
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, index) => (
                    <p key={`seller-address-${index}`}>{line}</p>
                  ))}
                {data.seller.phone && <p>Tel: {data.seller.phone}</p>}
                {data.seller.email && <p>{data.seller.email}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-[9px] uppercase tracking-wider text-espresso/50">Invoice No</p>
          <p className="font-mono text-lg font-bold leading-tight">{data.orderRef}</p>
          <p className="text-[11px] text-espresso/60">{formattedDate}</p>
        </div>
      </header>

      {/* Billing / shipping info */}
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="rounded border px-3 py-2" style={{ borderColor: data.borderColor }}>
          <p className="text-[10px] uppercase tracking-wider text-espresso/60">Bill To</p>
          <p className="text-base font-bold">{customerName}</p>
          <p className="text-sm">{customerPhone}</p>
          {data.customer?.email && <p className="text-sm text-espresso/60">{data.customer.email}</p>}
        </div>
        <div className="rounded border px-3 py-2" style={{ borderColor: data.borderColor }}>
          <p className="text-[10px] uppercase tracking-wider text-espresso/60">Ship To</p>
          <p className="text-base font-bold">{address?.fullName ?? customerName}</p>
          <p className="text-sm">{address?.phone ?? customerPhone}</p>
          <p className="text-sm text-espresso/70">{fullAddress ?? '-'}</p>
        </div>
      </div>

      {/* Line items */}
      <table data-testid="invoice-lines" className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr
            className="border-y bg-linen/40 text-left text-[10px] uppercase tracking-wider text-espresso/60"
            style={{ borderColor: data.borderColor }}
          >
            <th className="px-2 py-2">SKU</th>
            <th className="px-2 py-2">Description</th>
            <th className="px-2 py-2 text-right">Qty</th>
            <th className="px-2 py-2 text-right">Unit Price</th>
            <th className="px-2 py-2 text-right">Disc.</th>
            <th className="px-2 py-2 text-right">Line Total</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-espresso/60">
                No product line items were recorded for this delivery.
              </td>
            </tr>
          )}
          {data.lines.map((line, i) => (
            <tr key={`${line.sku}-${i}`} className="border-b border-espresso/10">
              <td className="px-2 py-2 font-mono text-xs">{line.sku}</td>
              <td className="px-2 py-2">{line.description || '-'}</td>
              <td className="px-2 py-2 text-right">{line.quantity}</td>
              <td className="px-2 py-2 text-right">{formatRupee(line.unitPrice)}</td>
              <td className="px-2 py-2 text-right">
                {line.discountAmount > 0 ? formatRupee(line.discountAmount) : '-'}
              </td>
              <td className="px-2 py-2 text-right font-semibold">{formatRupee(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Payment + totals */}
      <div className="mt-5 grid grid-cols-[1fr_320px] items-start gap-6">
        <div
          data-testid="invoice-payment"
          className="rounded border px-3 py-2"
          style={{ borderColor: data.borderColor }}
        >
          <p className="text-[10px] uppercase tracking-wider text-espresso/60">Payment</p>
          <p className="text-sm font-semibold">{paymentMethodLabel}</p>
          <p className="text-xs text-espresso/60">{paymentStatusLabel}</p>
          {data.paymentMethod === 'COD' && (
            <p className="mt-1 text-[11px] text-espresso/50">
              The courier collects this amount when the order is delivered.
            </p>
          )}
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-espresso/60">Subtotal</span>
            <span>{formatRupee(data.subtotal)}</span>
          </div>
          {hasDiscount && (
            <div className="flex justify-between">
              <span className="text-espresso/60">Discount</span>
              <span className="text-terracotta">− {formatRupee(data.discountAmount)}</span>
            </div>
          )}
          {hasTax && (
            <div className="flex justify-between">
              <span className="text-espresso/60">Tax</span>
              <span>{formatRupee(data.taxAmount)}</span>
            </div>
          )}
          {hasShipping && (
            <div className="flex justify-between">
              <span className="text-espresso/60">Shipping Fee</span>
              <span>{formatRupee(data.shippingFee!)}</span>
            </div>
          )}
          {data.codAmount > 0 && data.paymentMethod !== 'CARD' && data.paymentStatus !== 'PAID' && (
            <div className="flex justify-between">
              <span className="text-espresso/60">COD Amount</span>
              <span>{formatRupee(data.codAmount)}</span>
            </div>
          )}
          <div
            className={cn(
              'flex items-center justify-between border-t-2 pt-2 text-base font-bold',
            )}
            style={{ borderColor: data.borderColor }}
          >
            <span>Grand Total</span>
            <span>{formatRupee(data.totalAmount)}</span>
          </div>
        </div>
      </div>

      <p
        className="mt-6 border-t pt-3 text-center text-[10px] text-espresso/50"
        style={{ borderColor: data.borderColor }}
      >
        Thank you for your business. This is a computer-generated invoice from {data.brandName}.
      </p>
    </div>
  );
}
