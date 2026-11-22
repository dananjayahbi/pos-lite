/**
 * Real dirty tracking for the website CMS (ARGUS #502).
 *
 * The form used to increment a counter on every keystroke, so changing a field
 * and changing it back still showed "Unsaved changes" and kept Save enabled.
 * This comparison is order-insensitive for object keys (the tabs rebuild nested
 * objects in different orders) and order-sensitive for arrays (slide/footer
 * order is meaningful). `undefined` keys are treated as absent so a partial
 * update that clears a value back to missing is not falsely dirty.
 */
export function isWebsiteConfigDirty(initial: unknown, current: unknown): boolean {
  return !deepEqual(initial, current);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) {
      if (!deepEqual(a[index], b[index])) return false;
    }
    return true;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const aValue = a[key];
      const bValue = b[key];
      if (aValue === undefined && bValue === undefined) continue;
      if (aValue === undefined || bValue === undefined) return false;
      if (!deepEqual(aValue, bValue)) return false;
    }
    return true;
  }

  // Date instances (if any leak into config) compare by instant.
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  return false;
}
