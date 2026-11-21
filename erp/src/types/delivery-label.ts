/** Shared types for the Trans Express waybill design. */

/**
 * Per-tenant waybill template. The design itself is fixed (copied from the
 * courier's Proof of Delivery sticker); only the sender identity varies.
 * Persisted under `Tenant.settings.delivery.label`.
 */
export interface DeliveryLabelTemplate {
  /** Sender name printed in the "From" row. Sourced from the Store Profile. */
  brandName: string;
  /** Sender contact printed in the "Contact" row. Sourced from the Store Profile. */
  fromContact: string;
  /** Pickup/return address printed when the Store Profile has one. */
  pickupAddress?: string;
}

/**
 * Tenant identity used as the client-side fallback when a saved waybill
 * template has empty sender fields (ARGUS #298). Returned alongside the
 * template so the print path never needs a second, independently failing read.
 */
export interface LabelBranding {
  name: string;
  address: string;
  phoneNumber: string;
}
