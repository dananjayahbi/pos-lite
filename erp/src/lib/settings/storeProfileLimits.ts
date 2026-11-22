/**
 * Store profile field limits (ARGUS #476).
 *
 * The API has always capped store name/address/phone/footer, but the form had
 * no `maxLength` and no counters, so a long value failed only as a generic
 * toast. One shared limit map is used by the zod schema, the form and the
 * tests so they cannot drift.
 */

export const STORE_PROFILE_LIMITS = {
  storeName: 80,
  address: 160,
  phoneNumber: 40,
  receiptFooter: 240,
  email: 120,
  logoUrl: 2048,
} as const;

export type StoreProfileField = keyof typeof STORE_PROFILE_LIMITS;

export type StoreProfileValues = {
  storeName: string;
  address: string;
  phoneNumber: string;
  receiptFooter: string;
  email?: string;
};

export type StoreProfileFieldErrors = Partial<Record<StoreProfileField, string>>;

function limitMessage(field: StoreProfileField): string {
  return `${field === 'storeName' ? 'Store name' : field === 'phoneNumber' ? 'Phone number' : field === 'receiptFooter' ? 'Receipt footer' : field === 'email' ? 'Email' : 'Address'} must be ${STORE_PROFILE_LIMITS[field]} characters or less.`;
}

/** Inline field errors. `requireName` mirrors the API's min(2) rule. */
export function storeProfileFieldErrors(
  values: StoreProfileValues,
  options: { requireName?: boolean } = {},
): StoreProfileFieldErrors {
  const errors: StoreProfileFieldErrors = {};
  const requireName = options.requireName ?? true;

  if (requireName && values.storeName.trim().length < 2) {
    errors.storeName = 'Store name must be at least 2 characters.';
  }
  if (values.storeName.length > STORE_PROFILE_LIMITS.storeName) {
    errors.storeName = limitMessage('storeName');
  }
  if (values.address.length > STORE_PROFILE_LIMITS.address) {
    errors.address = limitMessage('address');
  }
  if (values.phoneNumber.length > STORE_PROFILE_LIMITS.phoneNumber) {
    errors.phoneNumber = limitMessage('phoneNumber');
  }
  if (values.receiptFooter.length > STORE_PROFILE_LIMITS.receiptFooter) {
    errors.receiptFooter = limitMessage('receiptFooter');
  }
  if ((values.email ?? '').length > STORE_PROFILE_LIMITS.email) {
    errors.email = limitMessage('email');
  }

  const email = (values.email ?? '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  return errors;
}

export function firstStoreProfileFieldError(errors: StoreProfileFieldErrors): string | null {
  const order: StoreProfileField[] = [
    'storeName',
    'address',
    'phoneNumber',
    'email',
    'receiptFooter',
  ];
  for (const field of order) {
    const message = errors[field];
    if (message) return message;
  }
  return null;
}

/**
 * A logo URL may only point at an uploaded/absolute http(s) asset. Arbitrary
 * schemes (`javascript:`, `data:`) and relative paths other than the app's
 * `/uploads`-style root paths are rejected, matching the receipt renderer's
 * escaping policy.
 */
export function isSafeLogoUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.length > STORE_PROFILE_LIMITS.logoUrl) return false;
  if (trimmed.startsWith('/')) return true;
  return /^https?:\/\/[^\s]+$/i.test(trimmed);
}
