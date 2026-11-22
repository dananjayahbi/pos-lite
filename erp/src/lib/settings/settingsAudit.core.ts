/**
 * ARGUS #468 — settings permission + audit payloads.
 *
 * Tax rates are owner-only (no approval primitive exists, so the simplest safe
 * rule wins). The store profile stays manager-editable, but every write must be
 * audited with actor + before/after. Pure so the routes and tests share exactly
 * the same snapshots (and never widen them to unrelated settings/secrets).
 */

export interface TaxRateSnapshot {
  vatRate: number;
  ssclRate: number;
}

export interface StoreProfileSnapshot {
  storeName: string;
  logoUrl: string | null;
  address: string;
  phoneNumber: string;
  email: string;
  receiptFooter: string;
}

/** OWNER is the tenant owner; SUPER_ADMIN acts as full store access. */
export function canManageTaxSettings(role: string | null | undefined): boolean {
  return role === 'OWNER' || role === 'SUPER_ADMIN';
}

/** Read only the two tax numbers from the tenant settings blob. */
export function readTaxRates(settings: unknown): TaxRateSnapshot {
  const values =
    typeof settings === 'object' && settings !== null
      ? (settings as Record<string, unknown>)
      : {};
  return {
    vatRate: typeof values.vatRate === 'number' ? values.vatRate : 0,
    ssclRate: typeof values.ssclRate === 'number' ? values.ssclRate : 0,
  };
}

/**
 * Audit payload for tax changes. Deliberately explicit: unrelated settings
 * (API keys, hardware credentials, etc.) never enter the audit row.
 */
export function taxSettingsAuditPayload(
  before: TaxRateSnapshot,
  after: TaxRateSnapshot,
): { before: TaxRateSnapshot; after: TaxRateSnapshot } {
  return {
    before: { vatRate: before.vatRate, ssclRate: before.ssclRate },
    after: { vatRate: after.vatRate, ssclRate: after.ssclRate },
  };
}

/** Read the profile fields written by PATCH /api/settings/store. */
export function readStoreProfileSnapshot(input: {
  name: string | null | undefined;
  logoUrl: string | null | undefined;
  settings: unknown;
}): StoreProfileSnapshot {
  const values =
    typeof input.settings === 'object' && input.settings !== null
      ? (input.settings as Record<string, unknown>)
      : {};
  return {
    storeName: input.name ?? '',
    logoUrl: input.logoUrl ?? null,
    address: typeof values.address === 'string' ? values.address : '',
    phoneNumber: typeof values.phoneNumber === 'string' ? values.phoneNumber : '',
    email: typeof values.email === 'string' ? values.email : '',
    receiptFooter: typeof values.receiptFooter === 'string' ? values.receiptFooter : '',
  };
}

/** Explicit profile snapshot for the audit row; no unrelated settings leak. */
export function storeProfileAuditPayload(
  before: StoreProfileSnapshot,
  after: StoreProfileSnapshot,
): { before: StoreProfileSnapshot; after: StoreProfileSnapshot } {
  return {
    before: { ...before },
    after: { ...after },
  };
}
