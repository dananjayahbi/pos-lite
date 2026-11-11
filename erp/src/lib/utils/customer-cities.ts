/**
 * Pure helpers for the customer city selector.
 *
 * The selector is populated from the tenant's cached Trans Express cities when
 * available. When the cache is empty (no courier account, or locations not
 * synced yet) we fall back to the curated `SRI_LANKA_CITIES` list so the form
 * is never blocked.
 */

export type CustomerCitySource = 'TRANSEXPRESS' | 'FALLBACK';

export interface CustomerCityOption {
  /** Stored value (the city name). */
  value: string;
  /** Display label. */
  label: string;
  /** Trans Express city id when the option came from a synced cache. */
  id?: number;
}

interface CachedCity {
  id: number;
  text: string;
}

/**
 * Build the final, deduplicated, alphabetically sorted option list.
 *
 * `currentCity` is appended when it is missing (for example a legacy customer
 * whose city is no longer in the master list) so editing never loses a value.
 */
export function buildCustomerCityOptions(
  cachedCities: ReadonlyArray<CachedCity>,
  fallbackCities: ReadonlyArray<string>,
  currentCity?: string | null,
): { cities: CustomerCityOption[]; source: CustomerCitySource } {
  const source: CustomerCitySource = cachedCities.length > 0 ? 'TRANSEXPRESS' : 'FALLBACK';
  const seen = new Set<string>();
  const options: CustomerCityOption[] = [];

  const push = (label: string, id?: number) => {
    const trimmed = label.trim();
    if (trimmed.length === 0) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    options.push(id === undefined ? { value: trimmed, label: trimmed } : { value: trimmed, label: trimmed, id });
  };

  for (const city of cachedCities) push(city.text, city.id);
  if (source === 'FALLBACK') {
    for (const city of fallbackCities) push(city);
  }

  if (currentCity) push(currentCity);

  options.sort((a, b) => a.label.localeCompare(b.label));
  return { cities: options, source };
}
