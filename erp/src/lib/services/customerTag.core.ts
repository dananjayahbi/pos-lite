/**
 * Customer-tag canonicalization (ARGUS #333).
 *
 * Customer tags and customer-pricing rules used to be compared as typed, so a
 * rule for `wholesale` never matched a customer tagged `WHOLESALE`. The store
 * convention (and the customer editor's presets) is upper-case, so every rule
 * tag is trimmed and upper-cased before storage and comparison. Matching in
 * `evaluateCustomerPricing` is also case-insensitive so existing lower-case
 * customer tags still work.
 */

/** Canonical rule/customer tag: trimmed, upper-case, empty stays empty. */
export function canonicalCustomerTag(raw: string): string {
  return raw.trim().toUpperCase();
}

export interface CustomerTagOption {
  tag: string;
  customerCount: number;
}

/**
 * Distinct canonical tags across customers, with the number of customers
 * carrying each tag (a customer that lists the same tag twice counts once).
 */
export function summarizeCustomerTags(
  tagLists: readonly (readonly string[])[],
): CustomerTagOption[] {
  const counts = new Map<string, number>();

  for (const tags of tagLists) {
    const seen = new Set<string>();
    for (const raw of tags) {
      const tag = canonicalCustomerTag(raw);
      if (tag === '' || seen.has(tag)) continue;
      seen.add(tag);
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, customerCount]) => ({ tag, customerCount }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

/** Case-insensitive tag equality. */
export function customerTagMatches(a: string, b: string): boolean {
  const left = canonicalCustomerTag(a);
  const right = canonicalCustomerTag(b);
  return left !== '' && left === right;
}

/** True when at least one customer carries the candidate tag. */
export function hasCustomerTag(
  tagLists: readonly (readonly string[])[],
  candidate: string,
): boolean {
  return tagLists.some((tags) => tags.some((tag) => customerTagMatches(tag, candidate)));
}
