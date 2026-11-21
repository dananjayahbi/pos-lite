/**
 * ARGUS #52 — sale alert copy.
 *
 * Kept free of Prisma/runtime imports so both the server fan-out and the
 * client notification surfaces can render the same wording. A sale alert is
 * still stored as `SALE_COMPLETED` (the enum has no void member and adding one
 * would need a migration); the void is expressed through the linked sale's
 * current status instead of a new notification type.
 */

export const SALE_VOIDED_TITLE = 'Sale Voided';

export interface RelatedSaleAlert {
  status: string;
  totalAmount: number | string;
}

/** `Sale #A1B2C3D4` — the same short id used by the notification producers. */
export function saleShortId(saleId: string): string {
  return saleId.slice(0, 8).toUpperCase();
}

function formatAmount(totalAmount: number | string): string {
  const amount = Number(totalAmount);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}

export function buildSaleVoidedCopy(
  saleId: string,
  totalAmount: number | string,
): { title: string; body: string } {
  return {
    title: SALE_VOIDED_TITLE,
    body: `Sale #${saleShortId(saleId)} was voided. Rs. ${formatAmount(totalAmount)} reversed.`,
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
