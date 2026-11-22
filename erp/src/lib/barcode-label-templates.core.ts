/**
 * The single source of truth for barcode label templates (ARGUS #157).
 *
 * The sidebar Barcode Printing page and the inventory "Print Labels" dialog
 * used to be two undocumented, drifting formats: A4 24-up carried no brand and
 * no low-stock dot, while thermal 4 x 6 cm carried both. Both surfaces now read
 * the same template definitions, offer the same two templates, and render the
 * same field set per template. Adding a field or changing a dimension here
 * changes every label at once.
 */

export type BarcodeLabelTemplateId = 'a4-24up' | 'thermal-4x6';

export type BarcodeLabelField =
  | 'brand'
  | 'productName'
  | 'variant'
  | 'sku'
  | 'barcode'
  | 'price'
  | 'lowStockDot';

export interface BarcodeLabelTemplate {
  id: BarcodeLabelTemplateId;
  /** Operator-facing name shown in the template switch. */
  name: string;
  /** One-line explanation of size, layout and field set. */
  description: string;
  widthMm: number;
  heightMm: number;
  columns: number;
  rows: number;
  /**
   * Labels on one printed page, or `null` for a continuous thermal roll where
   * the printer feeds one label per page.
   */
  labelsPerPage: number | null;
  continuousRoll: boolean;
  /** A4 sheet geometry; `null` for a roll. */
  sheet: { widthMm: number; heightMm: number; marginMm: number } | null;
  fields: readonly BarcodeLabelField[];
}

export const BARCODE_LABEL_FIELD_LABELS: Record<BarcodeLabelField, string> = {
  brand: 'Brand',
  productName: 'Product name',
  variant: 'Form / pack',
  sku: 'SKU',
  barcode: 'Barcode',
  price: 'Price',
  lowStockDot: 'Low-stock dot',
};

export const BARCODE_LABEL_TEMPLATES: readonly BarcodeLabelTemplate[] = [
  {
    id: 'a4-24up',
    name: 'A4 24-up',
    description:
      '24 labels on one A4 sheet (3 columns x 8 rows), 63.5 x 33.9 mm each: product name, form/pack, barcode, SKU and price.',
    widthMm: 63.5,
    heightMm: 33.9,
    columns: 3,
    rows: 8,
    labelsPerPage: 24,
    continuousRoll: false,
    sheet: { widthMm: 210, heightMm: 297, marginMm: 5 },
    fields: ['productName', 'variant', 'barcode', 'sku', 'price'],
  },
  {
    id: 'thermal-4x6',
    name: 'Thermal 4 x 6 cm',
    description:
      'One 40 x 60 mm label per feed on a continuous thermal roll: brand, product name, form/pack, SKU, barcode, price and a low-stock dot.',
    widthMm: 40,
    heightMm: 60,
    columns: 1,
    rows: 1,
    labelsPerPage: null,
    continuousRoll: true,
    sheet: null,
    fields: ['brand', 'productName', 'variant', 'sku', 'barcode', 'price', 'lowStockDot'],
  },
];

const TEMPLATE_BY_ID = new Map<BarcodeLabelTemplateId, BarcodeLabelTemplate>(
  BARCODE_LABEL_TEMPLATES.map((template) => [template.id, template]),
);

/** Throws for an unknown id so a typo cannot silently print the wrong size. */
export function getBarcodeLabelTemplate(id: BarcodeLabelTemplateId): BarcodeLabelTemplate {
  const template = TEMPLATE_BY_ID.get(id);
  if (!template) throw new Error(`Unknown barcode label template: ${id}`);
  return template;
}

/** "63.5 x 33.9 mm" */
export function barcodeLabelSize(template: BarcodeLabelTemplate): string {
  return `${template.widthMm} x ${template.heightMm} mm`;
}

/** Human-readable field list, e.g. "Product name, Barcode, SKU, Price". */
export function barcodeLabelFields(template: BarcodeLabelTemplate): string {
  return template.fields.map((field) => BARCODE_LABEL_FIELD_LABELS[field]).join(', ');
}

/** Short summary used under the template switch and in docs. */
export function barcodeLabelTemplateSummary(template: BarcodeLabelTemplate): string {
  const layout = template.continuousRoll
    ? 'continuous roll, one label per feed'
    : `${template.labelsPerPage} labels per A4 sheet (${template.columns} x ${template.rows})`;
  return `${barcodeLabelSize(template)} - ${layout}. Fields: ${barcodeLabelFields(template)}.`;
}

export function barcodeLabelHasField(
  template: BarcodeLabelTemplate,
  field: BarcodeLabelField,
): boolean {
  return template.fields.includes(field);
}
