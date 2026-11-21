/**
 * Detection rules for QA inventory fixtures (ARGUS #155).
 *
 * Live/production data accumulated rows named `QA Replacement Fixture …`.
 * Detection is pure and conservative: only the documented fixture prefix
 * matches, so real products are never treated as fixtures automatically.
 */

export const QA_FIXTURE_NAME_PREFIX = 'QA Replacement Fixture';

export function isQaFixtureProductName(name: string | null | undefined): boolean {
  if (!name) return false;
  return name.trim().toLowerCase().startsWith(QA_FIXTURE_NAME_PREFIX.toLowerCase());
}

export interface QaFixtureCandidate {
  id: string;
  name: string;
  deletedAt: Date | string | null;
}

export interface QaFixtureSummary {
  total: number;
  live: number;
  deleted: number;
  liveIds: string[];
  deletedIds: string[];
}

/** Splits fixture products into the live and already-soft-deleted sets. */
export function summarizeQaFixtures(rows: readonly QaFixtureCandidate[]): QaFixtureSummary {
  const fixtures = rows.filter((row) => isQaFixtureProductName(row.name));
  const liveIds = fixtures.filter((row) => row.deletedAt == null).map((row) => row.id);
  const deletedIds = fixtures.filter((row) => row.deletedAt != null).map((row) => row.id);

  return {
    total: fixtures.length,
    live: liveIds.length,
    deleted: deletedIds.length,
    liveIds,
    deletedIds,
  };
}
