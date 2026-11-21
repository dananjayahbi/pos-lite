import type { TaxRule } from '@/generated/prisma/client';

/**
 * Product CSV import validation (ARGUS #146).
 *
 * The old importer accepted a missing Cost Price as 0 (100% margin), accepted
 * retail below cost, forced every product to STANDARD_VAT and zeroed stock,
 * without telling the operator. This module is the single per-row validator
 * used by both the API and the preview: blank values that still have a sensible
 * default are applied AND counted, while missing/invalid values reject the row
 * with a reason instead of degrading silently.
 */

export const IMPORT_TAX_RULES = [
  'STANDARD_VAT',
  'SSCL',
  'EXEMPT',
] as const satisfies readonly TaxRule[];

export type ImportTaxRule = (typeof IMPORT_TAX_RULES)[number];

export const DEFAULT_IMPORT_TAX_RULE: ImportTaxRule = 'STANDARD_VAT';
export const DEFAULT_IMPORT_LOW_STOCK_THRESHOLD = 5;

export interface ProductImportRowData {
  productName: string;
  category: string;
  retailPrice: number;
  costPrice: number;
  taxRule: ImportTaxRule;
  initialStock: number;
  lowStockThreshold: number;
  sku?: string | undefined;
  barcode?: string | undefined;
  brand?: string | undefined;
  description?: string | undefined;
  tags?: string | undefined;
  form?: string | undefined;
  packSize?: string | undefined;
  wholesalePrice?: number | undefined;
}

export interface ProductImportDefaults {
  /** Blank Tax Rule → STANDARD_VAT. */
  taxRule: boolean;
  /** Blank Initial Stock → 0. */
  initialStock: boolean;
  /**
   * Blank Cost Price. Historically defaulted to 0; now the row is rejected so
   * the decision is still counted in the summary instead of hidden.
   */
  costPrice: boolean;
}

export interface ProductImportRowResult {
  rowNumber: number;
  ok: boolean;
  data?: ProductImportRowData | undefined;
  errors: string[];
  defaults: ProductImportDefaults;
}

export interface ProductImportRejectedRow {
  rowNumber: number;
  reasons: string[];
}

export interface ProductImportValidationSummary {
  rowsReceived: number;
  rowsValid: number;
  rowsRejected: number;
  rejected: ProductImportRejectedRow[];
  defaults: {
    taxRule: number;
    initialStock: number;
    costPrice: number;
  };
  taxRuleCounts: Record<ImportTaxRule, number>;
}

type RawRow = Record<string, unknown>;

function readText(row: RawRow, key: string): string {
  const value = row[key];
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parsePositive(text: string): number | null {
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseNonNegativeInteger(text: string): number | null {
  if (text === '') return null;
  const value = Number(text);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function parseOptionalPositive(text: string): number | null | undefined {
  if (text === '') return undefined;
  return parsePositive(text);
}

/**
 * Validate one CSV row. `rowNumber` is the 1-based CSV data row (the preview
 * and API both send it) so summaries can point at the operator's file.
 */
export function validateProductImportRow(
  row: RawRow,
  rowNumber: number,
): ProductImportRowResult {
  const errors: string[] = [];
  const defaults: ProductImportDefaults = {
    taxRule: false,
    initialStock: false,
    costPrice: false,
  };

  const productName = readText(row, 'productName');
  const category = readText(row, 'category');
  if (!productName) errors.push('Product Name is required');
  if (!category) errors.push('Category is required');

  const retailText = readText(row, 'retailPrice');
  const retailPrice = parsePositive(retailText);
  if (retailPrice === null) {
    errors.push('Retail Price is required and must be a positive number');
  }

  const costText = readText(row, 'costPrice');
  const costPrice = parsePositive(costText);
  defaults.costPrice = costText === '';
  if (costPrice === null) {
    errors.push('Cost Price is required and must be a positive number');
  }

  if (retailPrice !== null && costPrice !== null && retailPrice < costPrice) {
    errors.push('Retail Price cannot be lower than Cost Price');
  }

  const taxText = readText(row, 'taxRule').toUpperCase();
  defaults.taxRule = taxText === '';
  let taxRule: ImportTaxRule = DEFAULT_IMPORT_TAX_RULE;
  if (taxText !== '') {
    if ((IMPORT_TAX_RULES as readonly string[]).includes(taxText)) {
      taxRule = taxText as ImportTaxRule;
    } else {
      errors.push(`Tax Rule must be one of ${IMPORT_TAX_RULES.join(', ')}`);
    }
  }

  const stockText = readText(row, 'initialStock');
  defaults.initialStock = stockText === '';
  const initialStock =
    stockText === '' ? 0 : parseNonNegativeInteger(stockText);
  if (initialStock === null) {
    errors.push('Initial Stock must be a non-negative integer');
  }

  const lowStockText = readText(row, 'lowStockThreshold');
  const lowStockThreshold =
    lowStockText === ''
      ? DEFAULT_IMPORT_LOW_STOCK_THRESHOLD
      : parseNonNegativeInteger(lowStockText);
  if (lowStockThreshold === null) {
    errors.push('Low Stock Threshold must be a non-negative integer');
  }

  const wholesaleText = readText(row, 'wholesalePrice');
  const wholesalePrice = parseOptionalPositive(wholesaleText);
  if (wholesalePrice === null) {
    errors.push('Wholesale Price must be a positive number');
  }

  const sku = readText(row, 'sku');
  const barcode = readText(row, 'barcode');
  const brand = readText(row, 'brand');
  const description = readText(row, 'description');
  const tags = readText(row, 'tags');
  const form = readText(row, 'form');
  const packSize = readText(row, 'packSize');

  if (
    errors.length > 0 ||
    retailPrice === null ||
    costPrice === null ||
    initialStock === null ||
    lowStockThreshold === null
  ) {
    return { rowNumber, ok: false, errors, defaults };
  }

  return {
    rowNumber,
    ok: true,
    errors: [],
    defaults,
    data: {
      productName,
      category,
      retailPrice,
      costPrice,
      taxRule,
      initialStock,
      lowStockThreshold,
      sku: sku || undefined,
      barcode: barcode || undefined,
      brand: brand || undefined,
      description: description || undefined,
      tags: tags || undefined,
      form: form || undefined,
      packSize: packSize || undefined,
      wholesalePrice: wholesalePrice ?? undefined,
    },
  };
}

/** Aggregate the per-row decisions for the import summary. */
export function summarizeProductImportRows(
  results: ProductImportRowResult[],
): ProductImportValidationSummary {
  const rejected: ProductImportRejectedRow[] = [];
  const taxRuleCounts: Record<ImportTaxRule, number> = {
    STANDARD_VAT: 0,
    SSCL: 0,
    EXEMPT: 0,
  };
  const defaults = { taxRule: 0, initialStock: 0, costPrice: 0 };
  let rowsValid = 0;

  for (const result of results) {
    // Missing cost is a rejected row now, but the decision is still reported.
    if (result.defaults.costPrice) defaults.costPrice++;

    if (!result.ok || !result.data) {
      rejected.push({
        rowNumber: result.rowNumber,
        reasons: result.errors.length > 0 ? result.errors : ['Row could not be read'],
      });
      continue;
    }

    rowsValid++;
    if (result.defaults.taxRule) defaults.taxRule++;
    if (result.defaults.initialStock) defaults.initialStock++;
    taxRuleCounts[result.data.taxRule]++;
  }

  return {
    rowsReceived: results.length,
    rowsValid,
    rowsRejected: rejected.length,
    rejected,
    defaults,
    taxRuleCounts,
  };
}
