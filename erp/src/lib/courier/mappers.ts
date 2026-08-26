import "server-only";

import Decimal from "decimal.js";
import { formatPhoneNumber } from "@/lib/whatsapp";
import type { CourierOrderPayload } from "@/lib/courier/types";

/**
 * Provider-agnostic delivery -> CourierOrderPayload mapper.
 *
 * Produces the normalized payload that every courier adapter's `uploadSingle`
 * consumes, so dispatch services can build a payload once regardless of carrier.
 * Provider-specific wire formats are handled inside each adapter (e.g. the
 * Trans Express `orders.ts` maps this payload to its API request body).
 */

interface MapperAddress {
  fullName: string;
  phone: string;
  phone2?: string | null | undefined;
  addressLine1: string;
  addressLine2?: string | null | undefined;
  cityId?: number | null | undefined;
  cityName?: string | null | undefined;
  districtId?: number | null | undefined;
}

interface MapperDelivery {
  orderRef: string;
  codAmount: { toString(): string };
  notes?: string | null | undefined;
  itemCount?: number | undefined;
}

/** Normalize an E.164/leading-0 phone for the courier payload. */
function normalizePhone(phone: string): string {
  try {
    return formatPhoneNumber(phone);
  } catch {
    return phone.replace(/[\s\-()]/g, "");
  }
}

/**
 * Build the normalized single-order payload from an address + delivery.
 * Used by dispatch so the courier-facing payload is provider-agnostic.
 */
export function toCourierOrderPayload(
  address: MapperAddress,
  delivery: MapperDelivery,
  opts: { waybillId?: string | undefined; description?: string | undefined } = {},
): CourierOrderPayload {
  const street = address.addressLine2
    ? `${address.addressLine1}, ${address.addressLine2}`
    : address.addressLine1;

  return {
    orderNo: delivery.orderRef,
    customerName: address.fullName,
    address: street,
    phone: normalizePhone(address.phone),
    phone2: address.phone2 ? normalizePhone(address.phone2) : undefined,
    cod: Number(new Decimal(delivery.codAmount.toString()).toFixed(2)),
    cityId: address.cityId ?? undefined,
    cityText: address.cityId ? undefined : (address.cityName ?? undefined),
    districtId: address.districtId ?? undefined,
    description: opts.description ?? (delivery.itemCount ? `${delivery.itemCount} parcel(s)` : undefined),
    note: delivery.notes ?? undefined,
    waybillId: opts.waybillId,
  };
}
