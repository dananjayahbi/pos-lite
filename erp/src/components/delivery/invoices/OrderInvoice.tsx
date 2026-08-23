'use client';

import { cn } from '@/lib/utils';
import { formatRupee } from '@/lib/format';
import type { OrderInvoiceData } from '@/types/order-invoice';

/**
 * Branded, printable order/shipping invoice. Reuses the same branding approach
 * as `ShippingLabel` (logo, brand header, accent/border colors) so labels and
 * invoices stay visually consistent. Self-contained and print-ready: it is
 * rendered inside a print overlay via `printOrderInvoice`.
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
  const customerPhone = data.customer?.phone ?? address?.phone ?? '—';

  const orderDate = new Date(data.createdAt);
  const formattedDate = Number.isNaN(orderDate.getTime())
    ? '—'
    : orderDate.toLocaleString('en-LK', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

  const hasDiscount = data.discountAmount > 0;
  const hasTax = data.taxAmount > 0;
  const hasShipping = data.shippingFee != null;

  return (
    <div
      className="mx-auto w-[794px] max-w-full bg-white p-6 text-espresso print:w-full print:p-4"
      style={{ color: '#3A2D28' }}
    >
      {/* Brand header */}
      <div
        className="flex items-center justify-between border-b-2 px-4 py-3 text-white"
        style={{ backgroundColor: data.accentColor, borderColor: data.borderColor }}
      >
        <div className="flex items-center gap-3">
          {data.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt="" className="h-10 w-10 rounded bg-white object-contain" />
          )}
          <div>
            <p className="font-display text-xl font-bold leading-tight">{data.brandName}</p>
            <p className="text-[11px] tracking-wide text-white/80">Order / Shipping Invoice</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold">{data.orderRef}</p>
          <p className="text-[11px] text-white/80">{formattedDate}</p>
        </div>
      </div>

      {/* Billing / shipping info */}
      <div className="mt-4 grid grid-cols-2 gap-4">
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
          <p className="text-sm text-espresso/70">{fullAddress ?? '—'}</p>
        </div>
      </div>

      {/* Line items */}
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y text-left text-[10px] uppercase tracking-wider text-espresso/60"
            style={{ borderColor: data.borderColor }}>
            <th className="py-2 pr-2">SKU</th>
            <th className="py-2 pr-2">Description</th>
            <th className="py-2 pr-2 text-right">Qty</th>
            <th className="py-2 pr-2 text-right">Unit Price</th>
            <th className="py-2 pr-2 text-right">Disc.</th>
            <th className="py-2 text-right">Line Total</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-espresso/60">
                No line items recorded for this order.
              </td>
            </tr>
          )}
          {data.lines.map((line, i) => (
            <tr key={`${line.sku}-${i}`} className="border-b border-espresso/10">
              <td className="py-2 pr-2 font-mono text-xs">{line.sku}</td>
              <td className="py-2 pr-2">{line.description || '—'}</td>
              <td className="py-2 pr-2 text-right">{line.quantity}</td>
              <td className="py-2 pr-2 text-right">{formatRupee(line.unitPrice)}</td>
              <td className="py-2 pr-2 text-right">
                {line.discountAmount > 0 ? formatRupee(line.discountAmount) : '—'}
              </td>
              <td className="py-2 text-right font-semibold">{formatRupee(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-4 flex justify-end">
        <div className="w-72 space-y-1 text-sm">
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
          {data.codAmount > 0 && (
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

      <p className="mt-6 border-t pt-2 text-center text-[10px] text-espresso/50"
        style={{ borderColor: data.borderColor }}>
        Thank you for your business. This is a computer-generated invoice from {data.brandName}.
      </p>
    </div>
  );
}
