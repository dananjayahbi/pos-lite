/** Hard-coded discount thresholds for CASHIER role. MANAGER and OWNER bypass all thresholds. */
export const POS_DISCOUNT_THRESHOLDS = {
  /** Max line-item discount % a CASHIER can apply without manager override */
  lineItemMaxPercent: 10,
  /** Max cart-level discount % a CASHIER can apply without manager override */
  cartMaxPercent: 5,
} as const;
