/**
 * Detection rules for QA brand fixtures (ARGUS #179).
 *
 * Two of the seven live brands were test artefacts:
 *  - "Master Aqua" with description "Test Brand" and a logo,
 *  - "Test BR" with description "AA".
 * Both had 0 products and appeared in the brand list (and storefront filters).
 *
 * This module is deliberately read-only and conservative: it never mutates the
 * database. Detection is limited to the documented fixture names and the
 * `Test …` naming convention so a real brand is not treated as a fixture.
 */

export const QA_FIXTURE_BRAND_NAMES: readonly string[] = ['master aqua', 'test br'];

export function isQaFixtureBrandName(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  return (
    QA_FIXTURE_BRAND_NAMES.includes(normalized) || normalized.startsWith('test ')
  );
}

export interface BrandFixtureCandidate {
  id: string;
  name: string;
  deletedAt: Date | string | null;
}

export interface BrandFixtureSummary {
  total: number;
  live: number;
  deleted: number;
  liveIds: string[];
  deletedIds: string[];
}

/** Splits fixture brands into live and already-soft-deleted sets. */
export function summarizeBrandFixtures(
  rows: readonly BrandFixtureCandidate[],
): BrandFixtureSummary {
  const fixtures = rows.filter((row) => isQaFixtureBrandName(row.name));
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
