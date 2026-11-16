/** Shared types for the Trans Express waybill design. */

/**
 * Per-tenant waybill template. The design itself is fixed (copied from the
 * courier's Proof of Delivery sticker); only the sender identity varies.
 * Persisted under `Tenant.settings.delivery.label`.
 */
export interface DeliveryLabelTemplate {
  /** Sender name printed in the "From" row. Falls back to tenant branding. */
  brandName: string;
  /** Sender contact printed in the "Contact" row. */
  fromContact: string;
}
