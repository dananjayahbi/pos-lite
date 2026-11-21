/**
 * Shared variant label formatting for product & stock surfaces (ARGUS #150).
 *
 * Variants carry `form` (OIL) and `packSize` (100ml) separately. Several
 * surfaces rendered them next to the SKU/product name with only a CSS margin,
 * so the accessible/text content ran together: `BAI-08-OIL-100MLOIL / 100ml`
 * and `Mahanarayan OilOIL / 500ml`. Always use an explicit separator.
 */

export const VARIANT_PART_SEPARATOR = ' / ';

/** Separates a product name/SKU from its variant descriptor. */
export const VARIANT_LABEL_SEPARATOR = ' · ';

export interface VariantLabelParts {
  form?: string | null;
  packSize?: string | null;
}

function clean(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

/** `OIL / 100ml`, or an empty string when the variant has neither part. */
export function formatVariantLabel(variant: VariantLabelParts): string {
  return [clean(variant.form), clean(variant.packSize)]
    .filter(Boolean)
    .join(VARIANT_PART_SEPARATOR);
}

/**
 * `Mahanarayan Oil · OIL / 500ml`. Returns the base unchanged when the variant
 * has no form or pack size, so callers never emit a dangling separator.
 */
export function appendVariantLabel(base: string, variant: VariantLabelParts): string {
  const label = formatVariantLabel(variant);
  return label ? `${base}${VARIANT_LABEL_SEPARATOR}${label}` : base;
}
