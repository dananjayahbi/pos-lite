'use client';

import { renderPrintOverlay } from '@/lib/print-overlay';
import { OrderInvoice } from './OrderInvoice';
import type { OrderInvoiceData } from '@/types/order-invoice';

/** Fetch the assembled invoice payload for a delivery. */
export async function fetchOrderInvoice(deliveryId: string): Promise<OrderInvoiceData> {
  const res = await fetch(`/api/store/deliveries/${deliveryId}/invoice`, {
    headers: { Accept: 'application/json' },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? 'Failed to load order invoice');
  }
  return json.data as OrderInvoiceData;
}

/**
 * Renders a single order's invoice into the print overlay and triggers the
 * print dialog. Used from order/delivery detail and row-level actions.
 */
export async function printOrderInvoice(deliveryId: string): Promise<void> {
  const data = await fetchOrderInvoice(deliveryId);
  renderPrintOverlay(<OrderInvoice data={data} />);
}

/**
 * Fetches invoice payloads for multiple deliveries and stacks them in a single
 * print overlay (one invoice per order), so a whole batch can be printed in one
 * dialog. Rejects if any fetch fails.
 */
export async function printOrderInvoices(deliveryIds: string[]): Promise<void> {
  if (deliveryIds.length === 0) return;
  const results = await Promise.all(deliveryIds.map((id) => fetchOrderInvoice(id)));
  renderPrintOverlay(
    <div className="space-y-8">
      {results.map((data) => (
        <OrderInvoice key={data.orderRef} data={data} />
      ))}
    </div>,
  );
}
