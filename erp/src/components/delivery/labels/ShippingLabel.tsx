'use client';

import Barcode from 'react-barcode';
import type { ReactNode } from 'react';
import { renderPrintOverlay } from '@/lib/print-overlay';
import {
  buildWaybillDescription,
  formatWaybillAmount,
  formatWaybillDate,
  waybillBarcodeValue,
} from '@/lib/delivery/waybill';
import type { DeliveryLabelTemplate } from '@/types/delivery-label';
import { collectableCodAmount, isPrepaidOrder } from '@/lib/delivery/cod';
import { buildSampleLabelProps, buildSampleSheetProps } from './sampleLabel';

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
  paymentStatus?: string | null | undefined;
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
}

/**
 * The minimal delivery shape needed to print a label. Satisfied by both
 * `DeliveryDetail` and `DeliveryListItem`.
 */
interface LabelDeliveryLike {
  orderRef: string;
  codAmount?: string | number | null;
  paymentStatus?: string | null;
  itemCount?: number | null;
  totalWeightKg?: string | number | null;
  waybill?: string | null;
  deliveredAt?: string | null;
  dispatchedAt?: string | null;
  createdAt?: string | null;
  address?: Partial<Address> | null;
  shipments?: { waybillId?: string | null }[];
}

/** Fixed parts of the courier's Proof of Delivery sticker. */
const COURIER_LOGO = '/delivery/transexpress-logo.png';
const COURIER_FOOTER = [
  'TransExpress Lanka Services (Pvt) Ltd',
  'No: 95, Aththidiya Road, Bellanthara - Direct Line: 011 2 999 888',
];

/** One A4 landscape sheet fits exactly two portrait waybills. */
export const WAYBILL_PER_SHEET = 2;
export const WAYBILL_WIDTH_MM = 148.5;
export const WAYBILL_HEIGHT_MM = 210;

function WaybillRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-[4mm] border-b border-black py-[1.7mm] text-[10pt] font-bold leading-tight">
      <span className="shrink-0">
        <span>{label}</span>
        <span className="ml-[1mm]">:</span>
      </span>
      <span className="break-words text-right">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-[3.5mm] text-[11.5pt] font-bold leading-tight">{children}</h2>;
}

/**
 * Trans Express "Proof of Delivery" waybill.
 *
 * The layout is fixed to the courier's sticker: logo + waybill barcode header,
 * sender block, customer block, order description, and the courier's company
 * footer. Only the sender name/contact come from the tenant template.
 *
 * The component fills its parent cell; printing places two of those cells on
 * one A4 landscape sheet (see `printShippingLabels`).
 */
export function ShippingLabel({ template, address, delivery, waybillId }: ShippingLabelProps) {
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
    showOrderRef: true,
  });
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
    showItemCount: true,
    showWeight: true,
    fallback: delivery.orderRef,
  });
  const date = delivery.deliveredAt ?? delivery.dispatchedAt ?? delivery.createdAt ?? null;

  return (
    <div
      data-testid="waybill-label"
      className="flex h-full w-full flex-col bg-white px-[6mm] py-[5mm] text-black"
    >
      {/* Fixed courier header: logo left, waybill barcode right. */}
      <header className="flex items-start justify-between gap-[4mm] border-b border-black pb-[3mm]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={COURIER_LOGO}
          alt="TransExpress"
          className="h-[17mm] w-auto shrink-0 object-contain"
        />
        {barcodeValue && (
          <div className="flex flex-col items-center">
            <Barcode
              value={barcodeValue}
              width={1.5}
              height={44}
              displayValue={false}
              margin={0}
            />
            <p className="mt-[1mm] font-mono text-[10pt] font-bold tracking-wide">
              {barcodeValue}
            </p>
          </div>
        )}
      </header>

      <SectionTitle>Proof of Delivery</SectionTitle>

      <div className="mt-[1mm]">
        <WaybillRow label="From" value={template.brandName || '-'} />
        <WaybillRow label="Contact" value={template.fromContact || '-'} />
        <WaybillRow label="Date" value={formatWaybillDate(date)} />
        <WaybillRow label="Order No" value={delivery.orderRef || '-'} />
      </div>

      <SectionTitle>Customer Details</SectionTitle>

      <div className="mt-[1mm]">
        <WaybillRow label="To" value={address.fullName || '-'} />
        <WaybillRow label="Address" value={fullAddress || '-'} />
        <WaybillRow label="Branch" value={branch || '-'} />
        <WaybillRow label="Contact" value={contact || '-'} />
        <WaybillRow
          label="COD"
          value={
            isPrepaidOrder(delivery)
              ? 'PREPAID'
              : formatWaybillAmount(collectableCodAmount(delivery).toNumber())
          }
        />
      </div>

      <div className="mt-[3.5mm] flex items-start justify-between gap-[4mm] border-b border-black pb-[1.7mm]">
        <h2 className="shrink-0 text-[11.5pt] font-bold leading-tight">Order Description</h2>
        <span className="break-words text-right text-[10pt] font-bold leading-tight">
          {description}
        </span>
      </div>

      <footer className="mt-[4mm] text-center text-[9.5pt] font-bold leading-snug">
        {COURIER_FOOTER.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </footer>
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
      paymentStatus: delivery.paymentStatus ?? null,
      itemCount: delivery.itemCount ?? 1,
      totalWeightKg: delivery.totalWeightKg,
      deliveredAt: delivery.deliveredAt ?? null,
      dispatchedAt: delivery.dispatchedAt ?? null,
      createdAt: delivery.createdAt ?? null,
    },
    waybillId: delivery.waybill ?? shipment?.waybillId ?? null,
  };
}

/** A4 landscape with two portrait waybills, edge to edge. */
const WAYBILL_SHEET_CSS = `@page { size: A4 landscape; margin: 0; }
.shipping-label-print-root { padding: 0 !important; }
.waybill-sheet { display: grid; grid-template-columns: ${WAYBILL_WIDTH_MM}mm ${WAYBILL_WIDTH_MM}mm; }
.waybill-page {
  width: ${WAYBILL_WIDTH_MM}mm;
  height: ${WAYBILL_HEIGHT_MM}mm;
  overflow: hidden;
  page-break-inside: avoid;
  break-inside: avoid;
}`;

/**
 * Renders a real delivery's label into a print overlay. Only the label is
 * printed; the rest of the app is hidden via injected print CSS.
 */
export function printShippingLabel(delivery: LabelDeliveryLike, template: DeliveryLabelTemplate): void {
  if (!template.brandName?.trim()) {
    throw new Error('Waybill template is not loaded - the sender identity is missing');
  }
  renderPrintOverlay(
    <div className="waybill-sheet">
      <div className="waybill-page">
        <ShippingLabel template={template} {...toLabelProps(delivery)} />
      </div>
    </div>,
    { printStyles: WAYBILL_SHEET_CSS },
  );
}

/** Renders a sample label (from the designer) into the print overlay. */
export function printSampleLabel(template: DeliveryLabelTemplate): void {
  const props = buildSampleLabelProps(template);
  renderPrintOverlay(
    <div className="waybill-sheet">
      <div className="waybill-page">
        <ShippingLabel {...props} />
      </div>
    </div>,
    { printStyles: WAYBILL_SHEET_CSS },
  );
}

/** Prints a full two-up A4 landscape sheet (both sample waybills). */
export function printSampleSheet(template: DeliveryLabelTemplate): void {
  renderPrintOverlay(
    <div className="waybill-sheet">
      {buildSampleSheetProps(template).map((props) => (
        <div className="waybill-page" key={props.waybillId}>
          <ShippingLabel {...props} />
        </div>
      ))}
    </div>,
    { printStyles: WAYBILL_SHEET_CSS },
  );
}

/**
 * Renders multiple deliveries' labels in a single print overlay. Two labels
 * share each A4 landscape sheet, so a whole batch prints without wasting most
 * of the page.
 */
export function printShippingLabels(
  deliveries: LabelDeliveryLike[],
  template: DeliveryLabelTemplate,
): void {
  if (deliveries.length === 0) return;
  if (!template.brandName?.trim()) {
    throw new Error('Waybill template is not loaded - the sender identity is missing');
  }
  renderPrintOverlay(
    <div className="waybill-sheet">
      {deliveries.map((delivery, index) => (
        <div className="waybill-page" key={`${delivery.orderRef}-${index}`}>
          <ShippingLabel template={template} {...toLabelProps(delivery)} />
        </div>
      ))}
    </div>,
    { printStyles: WAYBILL_SHEET_CSS },
  );
}

export { WAYBILL_SHEET_CSS };
