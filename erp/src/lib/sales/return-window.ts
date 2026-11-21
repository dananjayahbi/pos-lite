/**
 * The customer-facing return window (ARGUS #87).
 *
 * The window is 30 days from the sale's **selling date** - `Sale.saleDate`, the
 * accounting date used by every report and list - not from the row's
 * `createdAt`. A sale entered today for last month was previously returnable
 * for 30 days from the data-entry moment, i.e. longer than the policy states.
 *
 * Legacy rows without `saleDate` fall back to `createdAt`, matching the rest of
 * the app (see `src/lib/reports/accounting.ts`).
 */

export const RETURN_WINDOW_DAYS = 30;

export interface ReturnWindowSale {
  saleDate?: Date | string | null;
  createdAt: Date | string;
}

/** First instant of the window: the recorded selling date. */
export function saleReturnWindowStart(sale: ReturnWindowSale): Date {
  const value = sale.saleDate ?? sale.createdAt;
  return value instanceof Date ? value : new Date(value);
}

/** Last instant of the window: selling date + 30 days. */
export function saleReturnWindowEnd(sale: ReturnWindowSale): Date {
  const end = new Date(saleReturnWindowStart(sale));
  end.setDate(end.getDate() + RETURN_WINDOW_DAYS);
  return end;
}

/** True once `now` is past the end of the return window. */
export function isReturnWindowExpired(
  sale: ReturnWindowSale,
  now: Date = new Date(),
): boolean {
  return now.getTime() > saleReturnWindowEnd(sale).getTime();
}
