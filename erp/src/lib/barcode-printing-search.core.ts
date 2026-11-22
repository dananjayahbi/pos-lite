/**
 * Variant-level search for the Barcode Printing picker (ARGUS #159).
 *
 * The products endpoint searches at product level, so an exact barcode search
 * returned the matching product with every sibling pack. A scan-and-reprint
 * then showed three rows with different barcodes and prices, and clicking the
 * wrong one printed the wrong label.
 *
 * This helper narrows the already-fetched rows: an exact SKU/barcode match wins
 * alone; otherwise product-name hits keep all their variants while partial
 * SKU/barcode hits keep only the matching cells.
 */

export interface BarcodeSearchRow {
  productName: string;
  sku: string;
  /** Null when the variant has no saved barcode (ARGUS #163). */
  barcode: string | null;
}

export type BarcodeSearchMatch = 'exact' | 'product' | 'variant' | 'none';

export interface BarcodeSearchResult<T> {
  row: T;
  match: BarcodeSearchMatch;
}

export function selectBarcodeSearchRows<T extends BarcodeSearchRow>(
  rows: readonly T[],
  term: string,
): Array<BarcodeSearchResult<T>> {
  const needle = term.trim().toLowerCase();
  if (needle.length === 0) {
    return rows.map((row) => ({ row, match: 'none' }));
  }

  const exact = rows.filter(
    (row) =>
      (row.barcode ?? '').toLowerCase() === needle || row.sku.toLowerCase() === needle,
  );
  // A scan or a typed barcode must not offer sibling packs as equal choices.
  if (exact.length > 0) {
    return exact.map((row) => ({ row, match: 'exact' }));
  }

  const matches: Array<BarcodeSearchResult<T>> = [];
  const seen = new Set<T>();
  for (const row of rows) {
    if (seen.has(row)) continue;

    if (row.productName.toLowerCase().includes(needle)) {
      matches.push({ row, match: 'product' });
      seen.add(row);
      continue;
    }

    if (
      row.sku.toLowerCase().includes(needle) ||
      (row.barcode ?? '').toLowerCase().includes(needle)
    ) {
      matches.push({ row, match: 'variant' });
      seen.add(row);
    }
  }

  return matches;
}
