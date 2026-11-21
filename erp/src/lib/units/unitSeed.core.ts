/**
 * Lazy-seed decision for built-in units (ARGUS #483 / #485).
 *
 * A built-in row holds its unique key even after a soft delete, so the seeder
 * must revive it rather than try to insert a duplicate. This pure helper picks
 * exactly the rows to clear, leaving custom units untouched.
 */

export interface SeedUnitRow {
  id: string;
  key: string;
  deletedAt: Date | string | null;
}

/** Ids of built-in rows that are currently soft-deleted. */
export function builtInRowIdsToRevive(
  rows: readonly SeedUnitRow[],
  builtInKeys: ReadonlySet<string>,
): string[] {
  return rows
    .filter((row) => builtInKeys.has(row.key) && row.deletedAt != null)
    .map((row) => row.id);
}
