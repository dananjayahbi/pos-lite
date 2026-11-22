/**
 * Tax registration and invoice identity readiness (ARGUS #471).
 *
 * The store currently stores only two percentages (`vatRate`, `ssclRate`) in
 * `Tenant.settings`. There is no place in the schema for a VAT/SSCL
 * registration number, an invoice prefix/sequence, or a declared
 * inclusive/exclusive price basis, so the Tax settings page can only report
 * what is missing. These readers do not invent a persistence contract: they
 * surface values only if an operator has already placed them in the settings
 * blob, and otherwise return null.
 *
 * The receipt gap is related: `SaleLine` stores `lineTax` but not the rule or a
 * VAT/SSCL split, so receipts cannot show separate VAT and SSCL lines without a
 * schema change.
 */

export const TAX_IDENTITY_FIELDS = [
  { key: 'vatRegistrationNumber', label: 'VAT registration number' },
  { key: 'ssclRegistrationNumber', label: 'SSCL registration number' },
  { key: 'invoicePrefix', label: 'Invoice prefix' },
  { key: 'invoiceNextNumber', label: 'Next invoice number' },
] as const;

export type TaxIdentityKey = (typeof TAX_IDENTITY_FIELDS)[number]['key'];

export type TaxIdentitySnapshot = Record<TaxIdentityKey, string | null>;

export interface TaxIdentityFieldStatus {
  key: TaxIdentityKey;
  label: string;
  value: string | null;
  configured: boolean;
}

function getSettings(settings: unknown): Record<string, unknown> {
  return typeof settings === 'object' && settings !== null
    ? (settings as Record<string, unknown>)
    : {};
}

function readText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Invoice numbers may legitimately be stored as a JSON number. */
function readNumberText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return readText(value);
}

/** Read the optional identity values, if they are already present. */
export function readTaxIdentitySnapshot(settings: unknown): TaxIdentitySnapshot {
  const source = getSettings(settings);
  return {
    vatRegistrationNumber: readText(source.vatRegistrationNumber),
    ssclRegistrationNumber: readText(source.ssclRegistrationNumber),
    invoicePrefix: readText(source.invoicePrefix),
    invoiceNextNumber: readNumberText(source.invoiceNextNumber),
  };
}

/** One row per expected field, with its configured state for the settings UI. */
export function taxIdentityFieldStatus(settings: unknown): TaxIdentityFieldStatus[] {
  const snapshot = readTaxIdentitySnapshot(settings);
  return TAX_IDENTITY_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    value: snapshot[field.key],
    configured: snapshot[field.key] !== null,
  }));
}

/** Labels of the expected fields that are not present in the settings blob. */
export function missingTaxIdentityFields(settings: unknown): string[] {
  return taxIdentityFieldStatus(settings)
    .filter((field) => !field.configured)
    .map((field) => field.label);
}

export function hasCompleteTaxIdentity(settings: unknown): boolean {
  return missingTaxIdentityFields(settings).length === 0;
}
