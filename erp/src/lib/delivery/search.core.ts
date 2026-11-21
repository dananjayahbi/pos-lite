/**
 * ARGUS #268 - the dispatch search placeholder promised "orders, customers"
 * but the API only matched order refs, courier refs, address names and
 * waybills, so a phone lookup returned nothing.
 *
 * Phones are stored inconsistently (`0771234567`, `077 123 4567`,
 * `077-123-4567`). These pure variants let the query match the common formats
 * without a schema change or raw SQL.
 */

function compactPhone(value: string): string {
  return value.replace(/[\s()-]/g, '');
}

/** Search terms to try against phone columns; always includes the raw input. */
export function phoneSearchVariants(search: string): string[] {
  const raw = search.trim();
  if (!raw) return [];
  const variants = new Set<string>([raw]);
  const compact = compactPhone(raw);

  if (/^\d{9,15}$/.test(compact)) {
    variants.add(compact);
    if (compact.length === 10 && compact.startsWith('0')) {
      variants.add(`${compact.slice(0, 3)} ${compact.slice(3, 6)} ${compact.slice(6)}`);
      variants.add(`${compact.slice(0, 3)}-${compact.slice(3, 6)}-${compact.slice(6)}`);
    }
  }

  return [...variants];
}
