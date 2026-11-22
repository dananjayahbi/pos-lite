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

/**
 * Provenance of the saved waybill template (ARGUS #305/#306). Stored beside the
 * template under `Tenant.settings.delivery.labelMeta` so the designer can show
 * who last changed it and when without a schema change.
 */
export interface LabelTemplateMeta {
  /** ISO timestamp of the last save/reset, or null when never saved. */
  updatedAt: string | null;
  updatedById: string | null;
  updatedByEmail: string | null;
  updatedByRole: string | null;
  /** The last write; null when the tenant still uses the defaults. */
  action: 'saved' | 'reset' | null;
}

export const EMPTY_LABEL_TEMPLATE_META: LabelTemplateMeta = {
  updatedAt: null,
  updatedById: null,
  updatedByEmail: null,
  updatedByRole: null,
  action: null,
};

/** One reviewable label-template audit row (ARGUS #306). */
export interface LabelTemplateHistoryEntry {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string;
  action: string;
  before: unknown;
  after: unknown;
}
