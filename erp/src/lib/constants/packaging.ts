import type { PackagingCategory } from '@/generated/prisma/client';

/**
 * BUG-58 / M23-02: packaging list ordering contract.
 *
 * Postgres native enums sort by label declaration order (OID), NOT
 * alphabetically, so a DB-level `orderBy: { category: 'asc' }` returns
 * POLYMAILER → TAPE → LABEL (declaration order) rather than the alphabet.
 *
 * The frozen pin (`tests/23` §1.F6) asserts a non-decreasing **string**
 * comparison across the returned category list, so the contract is plain
 * alphabetical by category text, then by name. The list is small and
 * unpaginated, so the sort happens in-process against the text.
 */
export function comparePackagingItems<T extends { category: PackagingCategory; name: string }>(
  a: T,
  b: T,
): number {
  if (a.category < b.category) return -1;
  if (a.category > b.category) return 1;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}