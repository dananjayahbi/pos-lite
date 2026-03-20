/**
 * Merges partial URL search param updates into the existing params.
 * Setting a value to null or empty string removes that param.
 */
export function mergeSearchParams(
  current: URLSearchParams,
  updates: Record<string, string | null>,
): string {
  const params = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
  return params.toString();
}
