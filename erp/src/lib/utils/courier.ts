import "server-only";

import Decimal from "decimal.js";

/**
 * Shared courier/delivery helpers: weight accumulation and city resolution.
 */

/** Sum line weights (weightKg × quantity) into a total parcel weight (kg). */
export function sumLineWeights(
  lines: { weightKg?: Decimal | string | number | null; quantity?: number }[],
): Decimal {
  return lines.reduce((total, line) => {
    if (line.weightKg === null || line.weightKg === undefined) return total;
    return total.plus(new Decimal(line.weightKg.toString()).times(line.quantity ?? 1));
  }, new Decimal(0));
}

/**
 * Best-effort city → city_id resolver.
 * Prefers exact (case-insensitive) match, then trimmed match. Returns null when
 * no city_id is available so callers fall back to the "without-city" endpoint.
 */
export function resolveCityId(
  cities: { id: number; text: string }[],
  cityName?: string | null,
): number | null {
  return resolveLocationId(cities, cityName);
}

/**
 * Best-effort district → district_id resolver (same fuzzy-match strategy as
 * cities, so website free-text district names map to the cached numeric id used
 * by the shipping-fee rate engine).
 */
export function resolveDistrictId(
  districts: { id: number; text: string }[],
  districtName?: string | null,
): number | null {
  return resolveLocationId(districts, districtName);
}

/** Shared fuzzy matcher used by city/district resolvers. */
function resolveLocationId(
  locations: { id: number; text: string }[],
  name?: string | null,
): number | null {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  const exact = locations.find((c) => c.text.trim().toLowerCase() === normalized);
  if (exact) return exact.id;

  const partial = locations.find((c) => c.text.trim().toLowerCase().includes(normalized));
  return partial?.id ?? null;
}
