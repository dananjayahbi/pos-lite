/**
 * Helpers for `<input type="datetime-local">`, which works in the browser's
 * local wall-clock time.
 *
 * Appointment instants are stored and sent as ISO UTC strings, so the form must
 * convert in both directions. Slicing the ISO string (the old behaviour)
 * displayed the UTC clock and made every keystroke shift the stored instant by
 * the timezone offset (ARGUS #118).
 */

const pad = (value: number): string => String(value).padStart(2, '0');

/** ISO instant -> `YYYY-MM-DDTHH:mm` in the browser's local time. */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** `YYYY-MM-DDTHH:mm` local time -> ISO UTC instant. */
export function fromDatetimeLocalValue(value: string): string {
  if (!value) return '';
  // A datetime-local value without a zone is parsed as local time by the
  // ECMAScript Date constructor, which is exactly what the control means.
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
