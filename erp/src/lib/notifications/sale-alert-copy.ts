/**
 * ARGUS #52 — sale alert copy.
 *
 * Kept free of Prisma/runtime imports so both the server fan-out and the
 * client notification surfaces can render the same wording. A sale alert is
 * still stored as `SALE_COMPLETED` (the enum has no void member and adding one
 * would need a migration); the void is expressed through the linked sale's
 * current status instead of a new notification type.
 */

import { formatSignedRupee } from '@/lib/format';

export const SALE_VOIDED_TITLE = 'Sale Voided';

export interface RelatedSaleAlert {
  status: string;
  totalAmount: number | string;
  zeroValueReason?: string | null;
  /** Buyer name, when the sale is linked to a customer (ARGUS #59). */
  customerName?: string | null;
  /** First line's product snapshot, used when there is no customer (ARGUS #59). */
  productName?: string | null;
}

/** Why a sale completed with a zero (or negative) total. */
const ZERO_VALUE_REASON_LABELS: Record<string, string> = {
  BANK_PAYMENT: 'Bank payment',
  PRODUCT_REPLACEMENT: 'Replacement',
  COMPLIMENTARY_GIFT: 'Complimentary',
};

/** Human label for `Sale.zeroValueReason`, or null when unavailable. */
export function zeroValueReasonLabel(reason?: string | null): string | null {
  if (!reason) return null;
  return ZERO_VALUE_REASON_LABELS[reason] ?? null;
}

/** `Sale #A1B2C3D4` — the same short id used by the notification producers. */
export function saleShortId(saleId: string): string {
  return saleId.slice(0, 8).toUpperCase();
}

export function buildSaleVoidedCopy(
  saleId: string,
  totalAmount: number | string,
): { title: string; body: string } {
  return {
    title: SALE_VOIDED_TITLE,
    body: `Sale #${saleShortId(saleId)} was voided. ${formatSignedRupee(totalAmount)} reversed.`,
  };
}

export const SALE_COMPLETED_TITLE = 'Sale Completed';

export interface SaleCompletedContext {
  /** Persisted `Sale.zeroValueReason`; explains a zero/negative total (ARGUS #58). */
  zeroValueReason?: string | null | undefined;
  /** Buyer name, preferred for the row summary (ARGUS #59). */
  customerName?: string | null | undefined;
  /** First product, used when the sale has no linked customer (ARGUS #59). */
  productName?: string | null | undefined;
}

const SUMMARY_MAX_LENGTH = 32;

function shortSummary(value?: string | null): string | null {
  const trimmed = value?.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.length > SUMMARY_MAX_LENGTH
    ? `${trimmed.slice(0, SUMMARY_MAX_LENGTH - 1)}…`
    : trimmed;
}

/**
 * ARGUS #59: every sale alert used the same title, so 103 rows could not be
 * told apart. Carry the receipt reference plus a short customer (or product)
 * summary instead. The reference is the same 8-character id printed on the
 * receipt; a sale has no separate invoice number.
 */
export function saleAlertTitle(saleId: string, context: SaleCompletedContext = {}): string {
  const reference = saleShortId(saleId ?? '');
  if (!reference) return SALE_COMPLETED_TITLE;

  const summary = shortSummary(context.customerName) ?? shortSummary(context.productName);
  return summary ? `Sale #${reference} · ${summary}` : `Sale #${reference}`;
}

/**
 * Re-render a completed alert from the sale's CURRENT total (ARGUS #53).
 *
 * Some alerts were written before the final delivery charge was applied, so the
 * stored body showed an old amount. The API already joins the linked sale; the
 * UI uses this copy instead of the stale stored body. A zero-value sale also
 * names its reason instead of only saying `Rs. 0.00` (ARGUS #58).
 */
export function buildSaleCompletedCopy(
  saleId: string,
  totalAmount: number | string,
  context: SaleCompletedContext = {},
): { title: string; body: string } {
  const amount = Number(totalAmount);
  const reasonSuffix =
    Number.isFinite(amount) && amount <= 0
      ? ` Reason: ${zeroValueReasonLabel(context.zeroValueReason) ?? 'not recorded'}.`
      : '';

  return {
    title: saleAlertTitle(saleId, context),
    body: `Sale #${saleShortId(saleId)} completed for ${formatSignedRupee(totalAmount)}.${reasonSuffix}`,
  };
}

/**
 * True when a stored `SALE_COMPLETED` alert now points at a voided sale.
 * The API enriches rows with `relatedSale` at read time, so alerts written
 * before the void are labelled correctly without rewriting history.
 */
export function isVoidedSaleAlert(
  type: string,
  relatedSale?: RelatedSaleAlert | null,
): boolean {
  return type === 'SALE_COMPLETED' && relatedSale?.status === 'VOIDED';
}
