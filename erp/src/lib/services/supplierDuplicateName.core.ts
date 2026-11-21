/**
 * Duplicate supplier-name detection (ARGUS #235).
 *
 * Supplier names are intentionally not unique (M06-01 / D5): a live same-name
 * row only raises a warning. The create path computed the flag but the UI
 * ignored it, and the update path never computed it at all. This pure helper is
 * shared by both service paths and normalises case and whitespace, so
 * "Lanka  Textile" and "lanka textile" are treated as the same trading name.
 */

export interface SupplierNameRow {
  id: string;
  name: string;
}

export interface SupplierDuplicateNameResult {
  duplicateName: boolean;
  matchedSupplierId: string | null;
  matchedName: string | null;
}

export function normalizeSupplierName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Find another LIVE supplier whose normalised name equals `candidateName`.
 * `excludeSupplierId` keeps an update from matching itself.
 */
export function findDuplicateSupplierName(
  candidateName: string,
  liveSuppliers: ReadonlyArray<SupplierNameRow>,
  excludeSupplierId?: string | null,
): SupplierDuplicateNameResult {
  const candidate = normalizeSupplierName(candidateName);
  if (candidate.length === 0) {
    return { duplicateName: false, matchedSupplierId: null, matchedName: null };
  }

  for (const supplier of liveSuppliers) {
    if (excludeSupplierId && supplier.id === excludeSupplierId) continue;
    if (normalizeSupplierName(supplier.name) === candidate) {
      return {
        duplicateName: true,
        matchedSupplierId: supplier.id,
        matchedName: supplier.name,
      };
    }
  }

  return { duplicateName: false, matchedSupplierId: null, matchedName: null };
}
