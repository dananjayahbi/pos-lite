import {
  Pill,
  Droplets,
  FlaskConical,
  Leaf,
  Coffee,
  SprayCan,
  Beaker,
  Sparkles,
  CircleDot,
  type LucideIcon,
} from 'lucide-react';

/**
 * Ayurveda product dosage forms. Each variant of a product is one of these forms.
 *
 * Replaces the clothing "colour" attribute (red/blue/black/etc.) with the
 * Ayurveda dosage form (powder/tablet/oil/etc.).
 */
export const PRODUCT_FORMS = [
  'POWDER',
  'TABLET',
  'CAPSULE',
  'OIL',
  'SYRUP',
  'BALM',
  'CREAM',
  'SOAP',
  'TEA',
  'DROPS',
  'GRANULES',
  'PASTE',
  'DECOCTION',
] as const;

export type ProductFormValue = (typeof PRODUCT_FORMS)[number];

export const PRODUCT_FORM: Record<ProductFormValue, ProductFormValue> = {
  POWDER: 'POWDER',
  TABLET: 'TABLET',
  CAPSULE: 'CAPSULE',
  OIL: 'OIL',
  SYRUP: 'SYRUP',
  BALM: 'BALM',
  CREAM: 'CREAM',
  SOAP: 'SOAP',
  TEA: 'TEA',
  DROPS: 'DROPS',
  GRANULES: 'GRANULES',
  PASTE: 'PASTE',
  DECOCTION: 'DECOCTION',
};

/** Human-readable labels for the product form selector. */
export const PRODUCT_FORM_LABELS: Record<ProductFormValue, string> = {
  POWDER: 'Powder (Choorna)',
  TABLET: 'Tablet (Gulika)',
  CAPSULE: 'Capsule',
  OIL: 'Oil (Thaila)',
  SYRUP: 'Syrup (Arishtam)',
  BALM: 'Balm',
  CREAM: 'Cream',
  SOAP: 'Soap',
  TEA: 'Tea (Decoction)',
  DROPS: 'Drops',
  GRANULES: 'Granules',
  PASTE: 'Paste (Lepam)',
  DECOCTION: 'Decoction (Kashaya)',
};

/** Lucide icon for each form (used in chip badges & pickers). */
export const PRODUCT_FORM_ICONS: Record<ProductFormValue, LucideIcon> = {
  POWDER: Sparkles,
  TABLET: Pill,
  CAPSULE: Pill,
  OIL: Droplets,
  SYRUP: FlaskConical,
  BALM: CircleDot,
  CREAM: Beaker,
  SOAP: SprayCan,
  TEA: Coffee,
  DROPS: Droplets,
  GRANULES: CircleDot,
  PASTE: CircleDot,
  DECOCTION: Leaf,
};

/** Used by the variant matrix / chip-input UIs. */
export const PRODUCT_FORM_OPTIONS: Array<{ value: ProductFormValue; label: string }> =
  PRODUCT_FORMS.map((value) => ({ value, label: PRODUCT_FORM_LABELS[value] }));

/**
 * Common pack-size presets for the chip-input. Free-text "packSize" field
 * on ProductVariant accepts any string (e.g. "75g", "30 sachets"), but
 * these presets speed up the wizard.
 */
export const PACK_SIZE_PRESETS = [
  '25g',
  '50g',
  '100g',
  '250g',
  '500g',
  '1kg',
  '30 caps',
  '60 caps',
  '100 caps',
  '50ml',
  '100ml',
  '200ml',
  '500ml',
  '1L',
  '10 sachets',
  '20 sachets',
] as const;

export type PackSizePreset = (typeof PACK_SIZE_PRESETS)[number];

// ── Tax rules (unchanged — generic to all retail in Sri Lanka) ──────────────

export const TAX_RULES = ['STANDARD_VAT', 'SSCL', 'EXEMPT'] as const;

export type TaxRuleValue = (typeof TAX_RULES)[number];

export const TAX_RULE: Record<TaxRuleValue, TaxRuleValue> = {
  STANDARD_VAT: 'STANDARD_VAT',
  SSCL: 'SSCL',
  EXEMPT: 'EXEMPT',
};

export const TAX_RULE_OPTIONS: Array<{ value: TaxRuleValue; label: string }> = [
  { value: TAX_RULE.STANDARD_VAT, label: 'Standard VAT (15%)' },
  { value: TAX_RULE.SSCL, label: 'SSCL' },
  { value: TAX_RULE.EXEMPT, label: 'VAT Exempt' },
];