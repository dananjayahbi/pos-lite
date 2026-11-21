/**
 * Unit catalog validation (ARGUS #482).
 *
 * Only the hidden derived `key` was unique, so a tenant could add a second
 * "Kilograms" (accepted with a `KILOGRAMS_2` key) and two units could both show
 * the short label "kg". A name with no letters or digits also collapsed to the
 * placeholder key "CATEGORY". These pure rules are shared by create/update and
 * tests so the server guards cannot drift from the UI copy.
 */

/** Comparison form for duplicate detection (case/whitespace-insensitive). */
export function normalizeUnitLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** True when the label has at least one letter or digit. */
export function hasAlphanumeric(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value);
}

export interface UnitLabelRow {
  id: string;
  name: string;
  shortLabel: string;
}

export interface UnitLabelInput {
  name?: string | undefined;
  shortLabel?: string | undefined;
}

export interface UnitLabelConflict {
  field: 'name' | 'shortLabel';
  /** The live unit that already owns the label. */
  existingName: string;
}

/**
 * Find a live unit whose name or short label matches the input after
 * normalisation. `excludeId` skips the unit being edited. Name is checked
 * first so the clearest message wins.
 */
export function findDuplicateUnitLabel(
  input: UnitLabelInput,
  rows: readonly UnitLabelRow[],
  excludeId?: string,
): UnitLabelConflict | null {
  const candidates = rows.filter((row) => row.id !== excludeId);

  if (input.name !== undefined) {
    const target = normalizeUnitLabel(input.name);
    if (target) {
      const match = candidates.find(
        (row) => normalizeUnitLabel(row.name) === target,
      );
      if (match) return { field: 'name', existingName: match.name };
    }
  }

  if (input.shortLabel !== undefined) {
    const target = normalizeUnitLabel(input.shortLabel);
    if (target) {
      const match = candidates.find(
        (row) => normalizeUnitLabel(row.shortLabel) === target,
      );
      if (match) return { field: 'shortLabel', existingName: match.name };
    }
  }

  return null;
}
