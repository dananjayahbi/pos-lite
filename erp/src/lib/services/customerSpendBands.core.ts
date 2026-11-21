/**
 * Customer spend-band definitions (ARGUS #312).
 *
 * The customer list filter used to describe its bands with overlapping
 * boundaries: "Under Rs. 5,000" was `<= 5000` and "Rs. 5,000 - 25,000" was
 * `>= 5000`, so a customer who had spent exactly Rs. 5,000 appeared in both
 * bands. The visible totals then disagreed (44 vs 43) depending on which band
 * was selected.
 *
 * Bands are now defined once here as disjoint, inclusive ranges and consumed by
 * the list UI for both its labels and its query bounds:
 *
 *   under 5000        -> [0, 4999.99]
 *   5000 - 24999.99   -> [5000, 24999.99]
 *   25000 and over    -> [25000, unbounded)
 *
 * `totalSpend` is stored as Decimal(12, 2), so 4999.99 is the largest value
 * that can fall in the first band.
 */

export type CustomerSpendBandKey =
  | 'ANY'
  | 'UNDER_5000'
  | 'FROM_5000_TO_24999'
  | 'FROM_25000';

export interface CustomerSpendBand {
  key: CustomerSpendBandKey;
  label: string;
  /** Inclusive lower bound; undefined means unbounded. */
  min?: number;
  /** Inclusive upper bound; undefined means unbounded. */
  max?: number;
}

export const CUSTOMER_SPEND_BANDS: readonly CustomerSpendBand[] = [
  { key: 'ANY', label: 'Any' },
  { key: 'UNDER_5000', label: 'Under Rs. 5,000', max: 4999.99 },
  { key: 'FROM_5000_TO_24999', label: 'Rs. 5,000 - 24,999.99', min: 5000, max: 24999.99 },
  { key: 'FROM_25000', label: 'Rs. 25,000+', min: 25000 },
];

/** True when `spend` belongs to the band (inclusive on both bounds). */
export function matchesCustomerSpendBand(
  spend: number,
  band: CustomerSpendBand,
): boolean {
  if (band.min !== undefined && spend < band.min) return false;
  if (band.max !== undefined && spend > band.max) return false;
  return true;
}

/**
 * Assign a spend value to its single band. Values below the first band's floor
 * (only possible for negative data) still count as "under 5,000"; the bands
 * remain exhaustive so every customer lands in exactly one bucket.
 */
export function customerSpendBandFor(spend: number): CustomerSpendBandKey {
  if (spend < 5000) return 'UNDER_5000';
  if (spend < 25000) return 'FROM_5000_TO_24999';
  return 'FROM_25000';
}

export interface CustomerSpendLike {
  totalSpend: number | string;
}

/**
 * Count customers per band. `ANY` is the total, so the three bucket counts
 * always sum to it - the invariant the overlapping bands broke.
 */
export function countCustomersBySpendBand(
  customers: readonly CustomerSpendLike[],
): Record<CustomerSpendBandKey, number> {
  const counts: Record<CustomerSpendBandKey, number> = {
    ANY: 0,
    UNDER_5000: 0,
    FROM_5000_TO_24999: 0,
    FROM_25000: 0,
  };

  for (const customer of customers) {
    const spend = Number(customer.totalSpend);
    if (!Number.isFinite(spend)) continue;
    counts.ANY += 1;
    counts[customerSpendBandFor(spend)] += 1;
  }

  return counts;
}
