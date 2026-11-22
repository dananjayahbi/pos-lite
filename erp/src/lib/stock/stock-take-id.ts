/**
 * ARGUS #191 - stock-take session identifiers.
 *
 * The list and review screens cut the cuid down to 8 / 12 characters with no
 * copy action, which made an audit reference ambiguous. The full id is now the
 * canonical label; a short reference keeps both ends so two sessions with the
 * same prefix can still be told apart in dense tables.
 */

/** The value that must be shown (and copied) for support/audit. */
export function stockTakeIdValue(id: string): string {
  return id.trim();
}

/**
 * Compact reference for narrow cells: first 8 and last 4 characters, e.g.
 * `cmvtdxsw…a1b2`. Returns the whole id when it is already short enough.
 */
export function stockTakeIdReference(id: string, head = 8, tail = 4): string {
  const value = stockTakeIdValue(id);
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
