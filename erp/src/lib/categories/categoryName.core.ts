/**
 * Category name normalisation (ARGUS #173).
 *
 * The database uniqueness rule is exact and case-sensitive, so a direct API
 * caller could create "Ayurvedic Oils", "ayurvedic oils" and
 * "  Ayurvedic Oils  " as three categories. The UI trimmed and blocked only the
 * exact duplicate. One shared normalisation rule makes create/update reject
 * near-duplicates regardless of the caller.
 */

/**
 * Comparison form: trimmed, internal whitespace collapsed and lower-cased.
 * Storage keeps the operator's casing; only the uniqueness comparison is
 * normalised.
 */
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface CategoryNameCandidate {
  id: string;
  name: string;
}

/**
 * Returns the first candidate whose name normalises to the same value as
 * `name`, ignoring `excludeId` (the category being renamed).
 */
export function findNearDuplicateCategoryName(
  name: string,
  candidates: readonly CategoryNameCandidate[],
  excludeId?: string,
): CategoryNameCandidate | null {
  const target = normalizeCategoryName(name);
  if (!target) return null;

  return (
    candidates.find(
      (candidate) =>
        candidate.id !== excludeId && normalizeCategoryName(candidate.name) === target,
    ) ?? null
  );
}
