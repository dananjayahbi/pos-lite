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
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
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
