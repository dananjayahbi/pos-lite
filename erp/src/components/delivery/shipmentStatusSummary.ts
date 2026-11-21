/**
 * ARGUS #270 — shipment vs delivery status summary.
 *
 * CourierShipment (the carrier's view) and Delivery (our business view) are
 * separate state machines, so they can legitimately disagree: a shipment may
 * still be SUBMITTED while the delivery was marked DELIVERED from a status
 * update. The detail card shows both and explains the divergence instead of
 * rendering only one of them under a generic "status" label.
 */
export interface ShipmentDeliverySummary {
  shipmentStatus: string | null;
  deliveryStatus: string;
  diverged: boolean;
  hint: string | null;
}

function humanize(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function summarizeShipmentDeliveryStatus(
  shipmentStatus: string | null | undefined,
  deliveryStatus: string,
): ShipmentDeliverySummary {
  const normalizedShipment = shipmentStatus ?? null;
  const diverged = normalizedShipment !== null && normalizedShipment !== deliveryStatus;

  return {
    shipmentStatus: normalizedShipment,
    deliveryStatus,
    diverged,
    hint: diverged
      ? `Carrier shipment is ${humanize(normalizedShipment)} while the delivery record is ${humanize(deliveryStatus)}. Refresh tracking or check the carrier.`
      : null,
  };
}
