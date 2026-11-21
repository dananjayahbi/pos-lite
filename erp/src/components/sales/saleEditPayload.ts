import { toYMD } from '@/lib/date-range';

/**
 * The `saleDate` fragment of a sale-edit PATCH (ARGUS #88).
 *
 * `null`/missing means "do not touch the selling timestamp". The caller seeds
 * the date input from `saleDate ?? createdAt`; if the operator leaves that day
 * alone we send no date at all, so saving a customer-only edit cannot move a
 * 23:04 sale to 12:00.
 */
export function saleEditDatePayload(input: {
  saleDate: string | null;
  createdAt: string;
  editedDate: string;
}): { saleDate?: string } {
  const seeded = new Date(input.saleDate ?? input.createdAt);
  if (Number.isNaN(seeded.getTime())) return {};

  const unchangedDay = toYMD(seeded) === input.editedDate;
  if (unchangedDay) return {};

  // Noon local time keeps the calendar day stable across timezones.
  const parsed = new Date(`${input.editedDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return {};
  return { saleDate: parsed.toISOString() };
}
