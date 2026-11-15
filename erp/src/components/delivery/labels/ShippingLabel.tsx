'use client';

import Barcode from 'react-barcode';
import { renderPrintOverlay } from '@/lib/print-overlay';
import { cn } from '@/lib/utils';
import {
  buildWaybillDescription,
  formatWaybillAmount,
  formatWaybillDate,
  waybillBarcodeValue,
} from '@/lib/delivery/waybill';
import type {
  DeliveryLabelTemplate,
  LabelPageSize,
} from '@/types/delivery-label';
import { buildSampleLabelProps } from './sampleLabel';

interface Address {
  fullName: string;
  phone: string;
  phone2?: string | null | undefined;
  addressLine1: string;
  addressLine2?: string | null | undefined;
  cityName?: string | null | undefined;
  districtName?: string | null | undefined;
  postalCode?: string | null | undefined;
}

interface DeliveryLike {
  orderRef: string;
  codAmount: string | number;
  itemCount?: number | undefined;
  totalWeightKg?: string | number | null | undefined;
  deliveredAt?: string | null | undefined;
  dispatchedAt?: string | null | undefined;
  createdAt?: string | null | undefined;
}

interface ShippingLabelProps {
  template: DeliveryLabelTemplate;
  address: Address;
  delivery: DeliveryLike;
  waybillId?: string | null;
  origin?: string | null;
  pickupAddress?: string | null;
}

/**
 * The minimal delivery shape needed to print a label. Satisfied by both
 * `DeliveryDetail` and `DeliveryListItem`.
 */
interface LabelDeliveryLike {
  orderRef: string;
  codAmount?: string | number | null;
  itemCount?: number | null;
  totalWeightKg?: string | number | null;
  waybill?: string | null;
  deliveredAt?: string | null;
  dispatchedAt?: string | null;
  createdAt?: string | null;
  address?: Partial<Address> | null;
  shipments?: { waybillId?: string | null }[];
}

const PAGE_WIDTH: Record<LabelPageSize, string> = {
  a4: 'max-w-[190mm]',
  a6: 'max-w-[95mm]',
  thermal: 'max-w-[72mm]',
};

function WaybillRow({
  label,
  value,
  borderColor,
}: {
  label: string;
  value: string;
  borderColor: string;
}) {
  return (
    <div
      className="flex items-start justify-between gap-3 border-b py-[7px]"
      style={{ borderColor }}
    >
      <span className="shrink-0 text-[12px] font-bold leading-tight">{label}</span>
      <span className="text-right text-[12px] font-bold leading-tight break-words">{value}</span>
    </div>
  );
}

/**
 * Courier "Proof of Delivery" waybill.
 *
 * Layout follows the TransExpress barcode-print sticker: logo + waybill barcode
 * header, then the sender, customer, and order blocks as label/value rows, then
 * the company footer. The per-tenant template still controls the logo, colors,
 * which rows are visible, and the sender/footer text.
 */
export function ShippingLabel({
  template,
  address,
  delivery,
  waybillId,
  origin,
  pickupAddress,
}: ShippingLabelProps) {
  const fullAddress = [
    address.addressLine1,
    address.addressLine2,
    [address.cityName, address.districtName].filter(Boolean).join(', '),
    address.postalCode,
  ]
    .filter(Boolean)
    .join(', ');

  const barcodeValue = waybillBarcodeValue({
    waybillId,
    orderRef: delivery.orderRef,
    showOrderRef: template.showOrderRef,
  });
  const centered = template.headerLayout === 'centered';
  const branchParts = [address.cityName, address.districtName].filter(
    (part): part is string => Boolean(part),
  );
  const branch =
    branchParts.length > 0
      ? branchParts.every((part) => part === branchParts[0])
        ? branchParts[0]!
        : branchParts.join(' / ')
      : '';
  const contact = [address.phone, address.phone2].filter(Boolean).join(' / ');
  const description = buildWaybillDescription({
    itemCount: delivery.itemCount,
    totalWeightKg: delivery.totalWeightKg,
    showItemCount: template.showItemCount,
    showWeight: template.showWeight,
    fallback: delivery.orderRef,
  });

  const date =
    delivery.deliveredAt ?? delivery.dispatchedAt ?? delivery.createdAt ?? null;
  const footerAddress =
    (template.showPickupAddress ? template.footerAddress || pickupAddress : null) ?? null;
  const footerPhone = template.footerPhone || template.fromContact || null;

  return (
    <div
      data-testid="waybill-label"
      className={cn(
        'mx-auto w-full border bg-white p-4 text-[#111111] shadow print:shadow-none',
        PAGE_WIDTH[template.pageSize],
      )}
      style={{ borderColor: template.borderColor }}
    >
      {/* Logo + waybill barcode */}
      <div
        className={cn(
          'flex items-start gap-3 border-b-2 pb-3',
          centered ? 'flex-col items-center text-center' : 'justify-between',
        )}
        style={{ borderColor: template.borderColor }}
      >
        <div className={cn('flex items-center gap-3', centered && 'flex-col text-center')}>
          {template.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={template.logoUrl}
              alt=""
              className="h-14 w-14 shrink-0 object-contain"
            />
          )}
          <div>
            <p
              className="font-display text-base font-bold leading-tight"
              style={{ color: template.accentColor }}
            >
              {template.brandName || origin || 'AyurPOS'}
            </p>
            {template.showOrigin && origin && (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-black/60">
                {origin}
              </p>
            )}
          </div>
        </div>

        {template.showBarcodes && barcodeValue && (
          <div className={cn('flex max-w-[58%] flex-col items-end', centered && 'items-center')}>
            <Barcode
              value={barcodeValue}
              width={template.pageSize === 'a4' ? 1.8 : 1.15}
              height={template.pageSize === 'a4' ? 56 : 46}
              displayValue={false}
              margin={0}
            />
            <p className="mt-1 font-mono text-sm font-bold tracking-wide">{barcodeValue}</p>
          </div>
        )}
      </div>

      {/* Sender block */}
      <h2
        className="mt-3 text-[15px] font-bold leading-tight"
        style={{ color: template.accentColor }}
      >
        Proof of Delivery
      </h2>
      <div className="mt-1">
        <WaybillRow
          label="From"
          value={template.brandName || origin || '—'}
          borderColor={template.borderColor}
        />
        <WaybillRow
          label="Contact"
          value={template.fromContact || '—'}
          borderColor={template.borderColor}
        />
        <WaybillRow
          label="Date"
          value={formatWaybillDate(date)}
          borderColor={template.borderColor}
        />
        {template.showOrderRef && (
          <WaybillRow
            label="Order No"
            value={delivery.orderRef || '—'}
            borderColor={template.borderColor}
          />
        )}
      </div>

      {/* Customer block */}
      <h2 className="mt-3 text-[15px] font-bold leading-tight" style={{ color: template.accentColor }}>
        Customer Details
      </h2>
      <div className="mt-1">
        <WaybillRow
          label="To"
          value={address.fullName || '—'}
          borderColor={template.borderColor}
        />
        <WaybillRow
          label="Address"
          value={fullAddress || '—'}
          borderColor={template.borderColor}
        />
        <WaybillRow label="Branch" value={branch || '—'} borderColor={template.borderColor} />
        <WaybillRow label="Contact" value={contact || '—'} borderColor={template.borderColor} />
        {template.showCod && (
          <WaybillRow
            label="COD"
            value={formatWaybillAmount(delivery.codAmount)}
            borderColor={template.borderColor}
          />
        )}
      </div>

      {/* Order description */}
      <h2 className="mt-3 text-[15px] font-bold leading-tight" style={{ color: template.accentColor }}>
        Order Description
      </h2>
      <div className="mt-1">
        <WaybillRow
          label="Items"
          value={description || delivery.orderRef || '—'}
          borderColor={template.borderColor}
        />
      </div>

      {/* Company footer */}
      {(template.brandName || footerAddress || footerPhone || template.footerNote) && (
        <footer
          className="mt-4 border-t pt-3 text-center"
          style={{ borderColor: template.borderColor }}
        >
          <p className="text-[11px] font-bold leading-tight">{template.brandName}</p>
          {footerAddress && (
            <p className="text-[11px] font-semibold leading-tight">
              {footerAddress}
              {footerPhone ? ` - Direct Line: ${footerPhone}` : ''}
            </p>
          )}
          {!footerAddress && footerPhone && (
            <p className="text-[11px] font-semibold leading-tight">Direct Line: {footerPhone}</p>
          )}
          {template.footerNote && (
            <p className="mt-1 text-[10px] font-semibold leading-tight">{template.footerNote}</p>
          )}
        </footer>
      )}
    </div>
  );
}

/** Accepts a full delivery object (detail payload) and derives label props. */
export function toLabelProps(delivery: LabelDeliveryLike): {
  address: Address;
  delivery: DeliveryLike;
  waybillId?: string | null;
} {
  const address = (delivery.address ?? {}) as Partial<Address>;
  const shipment = delivery.shipments?.[0];
  return {
    address: {
      fullName: address.fullName ?? '',
      phone: address.phone ?? '',
      phone2: address.phone2,
      addressLine1: address.addressLine1 ?? '',
      addressLine2: address.addressLine2,
      cityName: address.cityName,
      districtName: address.districtName,
      postalCode: address.postalCode,
    },
    delivery: {
      orderRef: delivery.orderRef ?? '',
      codAmount: delivery.codAmount ?? 0,
      itemCount: delivery.itemCount ?? 1,
      totalWeightKg: delivery.totalWeightKg,
      deliveredAt: delivery.deliveredAt ?? null,
      dispatchedAt: delivery.dispatchedAt ?? null,
      createdAt: delivery.createdAt ?? null,
    },
    waybillId: delivery.waybill ?? shipment?.waybillId ?? null,
  };
}

/**
 * Renders a real delivery's label into a print overlay. Only the label is
 * printed; the rest of the app is hidden via injected print CSS.
 */
export function printShippingLabel(delivery: LabelDeliveryLike, template: DeliveryLabelTemplate): void {
  renderPrintOverlay(<ShippingLabel template={template} {...toLabelProps(delivery)} />);
}

/** Renders a sample label (from the designer) into the print overlay. */
export function printSampleLabel(template: DeliveryLabelTemplate): void {
  renderPrintOverlay(<ShippingLabel {...buildSampleLabelProps(template)} />);
}

/**
 * Renders multiple deliveries' labels stacked in a single print overlay (one
 * label per order), so a whole batch can be printed in one dialog.
 */
export function printShippingLabels(
  deliveries: LabelDeliveryLike[],
  template: DeliveryLabelTemplate,
): void {
  if (deliveries.length === 0) return;
  renderPrintOverlay(
    <div className="space-y-6">
      {deliveries.map((delivery) => (
        <ShippingLabel key={delivery.orderRef} template={template} {...toLabelProps(delivery)} />
      ))}
    </div>,
  );
}

