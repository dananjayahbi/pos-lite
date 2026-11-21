/**
 * Unit rename is display-only (ARGUS #480).
 *
 * A unit's `key` is the stable reference stored on every raw material and BOM
 * line. Renaming a unit only changes `name`/`shortLabel`; the stored quantity is
 * never converted. Renaming "Kilograms" to "Grams" therefore leaves an existing
 * 12 reading as 12 grams, not 12,000 grams. The UI must warn and require an
 * explicit acknowledgement before saving a display change.
 */

export interface UnitDisplayValues {
  name: string;
  shortLabel: string;
}

/** True when a name or short-label edit changes what users see. */
export function unitDisplayChanged(
  original: UnitDisplayValues,
  next: UnitDisplayValues,
): boolean {
  return (
    original.name.trim() !== next.name.trim() ||
    original.shortLabel.trim() !== next.shortLabel.trim()
  );
}

/**
 * Warning shown before a rename is saved. The key is included so the operator
 * can see that the underlying reference does not change.
 */
export function unitRenameWarning(key: string): string {
  return `Changing the display name or short label does not convert existing quantities. They keep their current number under the stable unit key "${key}" - for example, 12 stays 12.`;
}
