'use client';

import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Barcode from 'react-barcode';
import { cn } from '@/lib/utils';
import type { DeliveryLabelTemplate } from '@/types/delivery-label';
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
  address?: Partial<Address> | null;
  shipments?: { waybillId?: string | null }[];
}

function formatLkr(value: string | number): string {
  const num = Number(value);
  return `Rs. ${num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Branded shipping label rendered from a per-tenant template. Colors, header
 * layout, field visibility, and the footer note all come from `template`.
 * The label is self-contained enough to be rendered inside a print overlay.
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

  const showOrderBarcode = template.showBarcodes && template.showOrderRef && Boolean(delivery.orderRef);
  const centered = template.headerLayout === 'centered';

  return (
    <div
      className="mx-auto w-85 border-2 bg-white text-espresso shadow print:shadow-none"
      style={{ borderColor: template.borderColor }}
    >
      {/* Brand header */}
      <div
        className={cn(
          'flex items-center gap-2 border-b-2 px-3 py-2',
          centered ? 'flex-col justify-center gap-1 text-center' : 'justify-between',
        )}
        style={{ borderColor: template.borderColor, backgroundColor: template.accentColor, color: '#ffffff' }}
      >
        <div className="flex items-center gap-2">
          {template.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={template.logoUrl} alt="" className="h-8 w-8 rounded bg-white object-contain" />
          )}
          <div>
            <p className="font-display text-lg font-bold leading-tight">{template.brandName}</p>
            {template.showOrigin && origin && (
              <p className="text-[10px] tracking-wide text-white/80">{origin}</p>
            )}
          </div>
        </div>
        {showOrderBarcode && (
          <Barcode value={delivery.orderRef} width={1} height={26} fontSize={9} displayValue={false} lineColor="#ffffff" />
        )}
      </div>

      {/* Customer block */}
      <div className="px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-espresso/60">Ship to</p>
        <p className="font-display text-xl font-bold leading-snug">{address.fullName}</p>
        <p className="text-base font-semibold">
          {address.phone}
          {address.phone2 ? ` · ${address.phone2}` : ''}
        </p>
        <p className="mt-1 text-sm font-medium leading-snug">{fullAddress}</p>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-1 border-t px-3 py-2 text-xs" style={{ borderColor: template.borderColor }}>
        {template.showOrderRef && (
          <div>
            <p className="text-espresso/60">Order Ref</p>
            <p className="font-mono font-semibold">{delivery.orderRef}</p>
          </div>
        )}
        {template.showCod && (
          <div>
            <p className="text-espresso/60">COD</p>
            <p className="font-semibold">{formatLkr(delivery.codAmount)}</p>
          </div>
        )}
        {template.showItemCount && (
          <div>
            <p className="text-espresso/60">Items</p>
            <p className="font-semibold">{delivery.itemCount ?? 1}</p>
          </div>
        )}
        {template.showWeight && (
          <div>
            <p className="text-espresso/60">Weight</p>
            <p className="font-semibold">
              {delivery.totalWeightKg ? `${delivery.totalWeightKg} kg` : '—'}
            </p>
          </div>
        )}
      </div>

      {/* Courier barcode */}
      {template.showBarcodes && waybillId && (
        <div className="flex flex-col items-center border-t px-3 py-2" style={{ borderColor: template.borderColor }}>
          <Barcode value={waybillId} width={2} height={50} fontSize={12} />
          <p className="font-mono text-xs">{waybillId}</p>
        </div>
      )}

      {template.showPickupAddress && pickupAddress && (
        <p className="border-t px-3 py-1 text-[10px] text-espresso/60" style={{ borderColor: template.borderColor }}>
          Pickup: {pickupAddress}
        </p>
      )}

      {template.footerNote && (
        <p
          className="border-t px-3 py-1 text-center text-[10px] font-semibold"
          style={{ borderColor: template.borderColor }}
        >
          {template.footerNote}
        </p>
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
    },
    waybillId: delivery.waybill ?? shipment?.waybillId ?? null,
  };
}

/**
 * Renders arbitrary label content into a print overlay and triggers the dialog.
 * Only the content is printed; the rest of the app is hidden via print CSS.
 */
function renderLabelOverlay(content: React.ReactNode): void {
  const overlay = document.createElement('div');
  overlay.className = 'shipping-label-print-root';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '9999',
    background: '#ffffff',
    overflow: 'auto',
    padding: '16px',
  });
  document.body.appendChild(overlay);

  const root: Root = createRoot(overlay);
  // flushSync commits the label BEFORE the print dialog opens, otherwise the
  // browser may snapshot an empty overlay (createRoot.render is async).
  flushSync(() => {
    root.render(content);
  });

  const style = document.createElement('style');
  style.textContent = `@media print {
    body > *:not(.shipping-label-print-root) { display: none !important; }
    .shipping-label-print-root { display: block !important; position: static !important; overflow: visible !important; padding: 8px !important; }
  }
  /* Force background colors and images to print regardless of the browser's
     "Background graphics" print setting. */
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }`;
  document.head.appendChild(style);

  let fallback: number | undefined;
  const cleanup = () => {
    root.unmount();
    overlay.remove();
    style.remove();
    window.removeEventListener('afterprint', cleanup);
    if (fallback) window.clearTimeout(fallback);
  };
  fallback = window.setTimeout(cleanup, 5000);
  window.addEventListener('afterprint', cleanup);

  // Wait for images (e.g. the logo) to finish loading so they appear in the
  // print snapshot, then trigger the dialog.
  const images = Array.from(overlay.querySelectorAll('img'));
  const imagePromises = images.map(
    (img) =>
      new Promise<void>((resolve) => {
        if (img.complete) return resolve();
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      }),
  );

  Promise.all(imagePromises).then(() => window.print());
}

/**
 * Renders a real delivery's label into a print overlay. Only the label is
 * printed; the rest of the app is hidden via injected print CSS.
 */
export function printShippingLabel(delivery: LabelDeliveryLike, template: DeliveryLabelTemplate): void {
  renderLabelOverlay(<ShippingLabel template={template} {...toLabelProps(delivery)} />);
}

/** Renders a sample label (from the designer) into the print overlay. */
export function printSampleLabel(template: DeliveryLabelTemplate): void {
  renderLabelOverlay(<ShippingLabel {...buildSampleLabelProps(template)} />);
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
  renderLabelOverlay(
    <div className="space-y-6">
      {deliveries.map((delivery) => (
        <ShippingLabel key={delivery.orderRef} template={template} {...toLabelProps(delivery)} />
      ))}
    </div>,
  );
}

