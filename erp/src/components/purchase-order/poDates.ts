/**
 * Date helpers shared by the purchase-order form and detail page.
 *
 * A `<input type="date">` yields a bare `yyyy-mm-dd`. Every value that leaves
 * the UI is pinned to local noon first, so a backdated order can never drift
 * into the previous day when serialised as UTC.
 */

/** `yyyy-mm-dd` in the viewer's local timezone — what `<Input type="date">` wants. */
export function todayIso(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

/**
 * Local calendar day → ISO string pinned to 12:00 local time.
 * Returns `undefined` for an empty or unparseable day.
 */
export function pinDayToNoonIso(day: string | null | undefined): string | undefined {
  if (!day) return undefined;
  const parsed = new Date(`${day}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/** Add whole days to a local `yyyy-mm-dd` day. */
export function addDays(day: string, days: number): string | undefined {
  if (!day) return undefined;
  const parsed = new Date(`${day}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  parsed.setDate(parsed.getDate() + days);
  const offsetMs = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 10);
}

/** `dd Mon yyyy` for anything ISO-like; `—` when unusable. */
export function formatPoDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** `2026-10` for a `yyyy-mm-dd` day — the month a generated reference belongs to. */
export function monthKey(day: string): string {
  return day.slice(0, 7);
}

/** Local `yyyy-mm-dd` for a stored instant or an existing day string. */
export function localDay(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

/**
 * ARGUS #233 - expected delivery may not precede the order date.
 */
export function poDeliveryDateError(
  orderDay: string | null | undefined,
  deliveryDay: string | null | undefined,
): string | null {
  if (!orderDay || !deliveryDay) return null;
  return deliveryDay < orderDay ? 'Expected delivery cannot be before the order date' : null;
}

/** Due day derived from the order day and the payment term (`null` = immediate). */
export function poDueDay(
  orderDate: string | Date | null | undefined,
  paymentTermDays: number | null | undefined,
): string | undefined {
  const orderDay = localDay(orderDate);
  if (!orderDay) return undefined;
  return addDays(orderDay, paymentTermDays ?? 0);
}

export type PoDueState = 'not_applicable' | 'paid' | 'overdue' | 'due';

/**
 * ARGUS #233 - accounts-payable ageing for the list/detail. Drafts and
 * cancellations are not chased; a fully settled order is "paid"; otherwise the
 * due day decides between due and overdue.
 */
export function poDueState(input: {
  dueDay?: string | undefined;
  status: string;
  outstanding?: number | string | null | undefined;
  today?: string | undefined;
}): PoDueState {
  if (input.status === 'DRAFT' || input.status === 'CANCELLED') return 'not_applicable';
  if (input.outstanding !== undefined && input.outstanding !== null && Number(input.outstanding) <= 0) {
    return 'paid';
  }
  if (!input.dueDay) return 'not_applicable';
  return input.dueDay < (input.today ?? todayIso()) ? 'overdue' : 'due';
}
