/**
 * Saved-report artifact metadata (ARGUS #449).
 *
 * The PDF includes "AyurPOS - <title>" and the date range, but CSV and XLSX
 * artifacts started straight at the column header, so a downloaded file lost
 * its report identity. These lines are shared by both generators.
 */
export function reportArtifactMetaLines(title: string, dateRange: string): string[] {
  const lines: string[] = [];
  const trimmedTitle = title.trim();
  const trimmedRange = dateRange.trim();
  if (trimmedTitle !== '') lines.push(`AyurPOS - ${trimmedTitle}`);
  if (trimmedRange !== '') lines.push(trimmedRange);
  return lines;
}
