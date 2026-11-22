/**
 * Customer display formatting (ARGUS #319).
 *
 * The directory mixed `+94...`, `077...` and a legacy `088...` prefix on the
 * same screen. Stored values are canonicalized on create, but historical rows
 * (and the secondary contact) predate that rule, so display code normalizes
 * them into one readable Sri Lankan form without rewriting the database.
 */

const SL_MOBILE = /^\+?94(\d{9})$/;
const SL_LOCAL = /^0(\d{9})$/;
const PHONE_SEPARATORS = /[\s\-().]/g;

/**
 * `+94 77 123 4567` for any recognizable SL number; the raw value otherwise.
 * Legacy landline prefixes keep their digits (only the country code changes).
 */
export function formatCustomerPhone(value: string | null | undefined): string {
  const raw = value?.trim() ?? '';
  if (raw === '') return '-';
  const compact = raw.replace(PHONE_SEPARATORS, '');

  const local = SL_LOCAL.exec(compact);
  if (local) return groupSriLanka(local[1]!);

  const international = SL_MOBILE.exec(compact.startsWith('+') ? compact : `+${compact}`);
  if (international) return groupSriLanka(international[1]!);

  return raw;
}

function groupSriLanka(nineDigits: string): string {
  return `+94 ${nineDigits.slice(0, 2)} ${nineDigits.slice(2, 5)} ${nineDigits.slice(5)}`;
}
