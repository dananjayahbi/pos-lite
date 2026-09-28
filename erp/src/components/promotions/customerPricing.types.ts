/**
 * M15-01 (BUG-46) — client-side types for the customer pricing rules UI.
 *
 * These mirror the response shape of the already-shipped API
 * (`/api/store/customer-pricing-rules`): the list/detail routes include
 * `variant` via `variantInclude`, and `Decimal` fields arrive as strings
 * through JSON. Keeping one definition here means the tab, the row and the
 * dialog can never drift apart on the field contract.
 */

/** Variant projection returned alongside each rule (`variantInclude`). */
export interface CustomerPricingRuleVariant {
  id: string;
  sku: string;
  retailPrice: string | number;
  product: { name: string };
}

/** A `CustomerPricingRule` row as returned by the collection/detail routes. */
export interface CustomerPricingRuleRow {
  id: string;
  customerTag: string;
  /** NULL = the rule applies to every variant (evaluation ORs `{variantId:null}`). */
  variantId: string | null;
  price: string | number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
  variant: CustomerPricingRuleVariant | null;
}

/** Values collected by the "Add rule" dialog before being POSTed. */
export interface CustomerPricingRuleDraft {
  customerTag: string;
  variantId: string;
  price: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}