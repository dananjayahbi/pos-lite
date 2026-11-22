/**
 * ARGUS #233 - purchase-order delivery-date validation.
 *
 * The form accepted an expected delivery before the order date, so live POs
 * ordered 29 Oct showed deliveries of 04 Oct / 09 Oct / 17 Sep. The service is
 * the authoritative gate (create and edit), and the UI mirrors the same rule so
 * the operator sees it before saving.
 */

function dayValue(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

/** Message for an impossible delivery day, or `null` when valid/absent. */
export function purchaseOrderDeliveryDateError(
  orderDate: Date | string | null | undefined,
  expectedDeliveryDate: Date | string | null | undefined,
): string | null {
  const order = dayValue(orderDate);
  const delivery = dayValue(expectedDeliveryDate);
  if (order === null || delivery === null) return null;
  return delivery < order
    ? 'Expected delivery date cannot be before the order date'
    : null;
}
