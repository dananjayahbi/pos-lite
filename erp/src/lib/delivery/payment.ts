/**
 * ARGUS #277 - the delivery detail showed the COD amount but not how the order
 * is paid or whether it is settled, so a COD-collect order and a paid order
 * looked the same. These helpers keep the wording consistent.
 */

function text(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** `CARD` -> `Card`, `COD` -> `COD`, empty -> `-`. */
export function paymentMethodLabel(value: string | null | undefined): string {
  const method = text(value);
  if (!method) return '-';
  if (method.toUpperCase() === 'COD') return 'COD';
  if (method.toUpperCase() === 'CARD') return 'Card';
  return method.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

/** `PAID` -> `Paid`, `PENDING` -> `Pending`, empty -> `-`. */
export function paymentStatusLabel(value: string | null | undefined): string {
  const status = text(value);
  if (!status) return '-';
  return status.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

/**
 * One compact label for the Order Information card: `COD · Paid`,
 * `Card · Pending`, or whichever half is known.
 */
export function describePayment(
  method: string | null | undefined,
  status: string | null | undefined,
): string {
  const parts = [paymentMethodLabel(method), paymentStatusLabel(status)].filter(
    (part) => part !== '-',
  );
  return parts.length > 0 ? parts.join(' · ') : '-';
}
