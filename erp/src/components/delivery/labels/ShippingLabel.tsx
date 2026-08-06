'use client';

import { createRoot } from 'react-dom/client';
import Barcode from 'react-barcode';
import type { DeliveryDetail } from '@/types/delivery';

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
}

interface ShippingLabelProps {
  brandName?: string | null;
  address: Address;
  delivery: DeliveryLike;
  waybillId?: string | null;
  origin?: string | null;
  pickupAddress?: string | null;
  showBarcodes?: boolean;
}

function formatLkr(value: string | number): string {
  const num = Number(value);
  return `Rs. ${num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Branded shipping label with a prominent brand header, enlarged bold customer
 * info for dispatch handlers, and dual barcodes: a small internal barcode
 * (order ref) top-right and a large courier barcode (waybill) at center.
 */
export function ShippingLabel({
  brandName = 'Ruhunu Wedagedara',
  address,
  delivery,
  waybillId,
  origin,
  pickupAddress,
  showBarcodes = true,
}: ShippingLabelProps) {
  const fullAddress = [
    address.addressLine1,
    address.addressLine2,
    [address.cityName, address.districtName].filter(Boolean).join(', '),
    address.postalCode,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="mx-auto w-85 border-2 border-espresso bg-white text-espresso shadow print:shadow-none">
      {/* Brand header */}
      <div className="flex items-center justify-between border-b-2 border-espresso bg-linen px-3 py-2">
        <div>
          <p className="font-display text-lg font-bold leading-tight">{brandName}</p>
          <p className="text-[10px] tracking-wide">{origin ?? 'AyurPOS'}</p>
        </div>
        {showBarcodes && delivery.orderRef && (
          <Barcode value={delivery.orderRef} width={1} height={26} fontSize={9} displayValue={false} />
        )}
      </div>

      {/* Customer block */}
      <div className="px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-espresso/60">Ship to</p>
        <p className="font-display text-xl font-bold leading-snug">{address.fullName}</p>
        <p className="text-base font-semibold">{address.phone}{address.phone2 ? ` · ${address.phone2}` : ''}</p>
        <p className="mt-1 text-sm font-medium leading-snug">{fullAddress}</p>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-1 border-t border-espresso/30 px-3 py-2 text-xs">
        <div>
          <p className="text-espresso/60">Order Ref</p>
          <p className="font-mono font-semibold">{delivery.orderRef}</p>
        </div>
        <div>
          <p className="text-espresso/60">COD</p>
          <p className="font-semibold">{formatLkr(delivery.codAmount)}</p>
        </div>
        <div>
          <p className="text-espresso/60">Items</p>
          <p className="font-semibold">{delivery.itemCount ?? 1}</p>
        </div>
        <div>
          <p className="text-espresso/60">Weight</p>
          <p className="font-semibold">
            {delivery.totalWeightKg ? `${delivery.totalWeightKg} kg` : '—'}
          </p>
        </div>
      </div>

      {/* Courier barcode */}
      {showBarcodes && waybillId && (
        <div className="flex flex-col items-center border-t border-espresso/30 px-3 py-2">
          <Barcode value={waybillId} width={2} height={50} fontSize={12} />
          <p className="font-mono text-xs">{waybillId}</p>
        </div>
      )}

      {pickupAddress && (
        <p className="border-t border-espresso/30 px-3 py-1 text-[10px] text-espresso/60">
          Pickup: {pickupAddress}
        </p>
      )}
    </div>
  );
}

/** Accepts a full delivery object (detail payload) and derives label props. */
export function toLabelProps(delivery: DeliveryDetail): {
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
    },
    waybillId: delivery.waybill ?? shipment?.waybillId ?? null,
  };
}

/** Opens a new window and renders the branded label for printing/saving. */
export function printShippingLabel(delivery: DeliveryDetail) {
  const win = window.open('', '_blank', 'width=420,height=620');
  if (!win) return;
  win.document.write(
    `<!doctype html><html><head><title>Shipping Label</title><style>body{margin:0;padding:16px;font-family:system-ui,sans-serif}</style></head><body>`,
  );
  win.document.close();

  const container = win.document.createElement('div');
  win.document.body.appendChild(container);
  const props = toLabelProps(delivery);
  createRoot(container).render(<ShippingLabel {...props} />);
}

