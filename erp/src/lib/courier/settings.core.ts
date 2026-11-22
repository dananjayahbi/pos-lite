/**
 * ARGUS #513 — courier settings payload + activation rules.
 *
 * Two defects drove this module:
 *  1. "Test connection" and "Sync locations" PUT the whole form first, so a
 *     failed test left invalid/active credentials saved.
 *  2. Empty email / pickup / origin fields were omitted from the payload, so
 *     clearing one silently kept the old stored value.
 *
 * The builders below always send the clearable fields (using null for an empty
 * origin), and activation is validated server-side against the merged effective
 * account, not just the form.
 */

export type CourierEnvironment = 'STAGING' | 'PRODUCTION';

export interface CourierSettingsDraft {
  env: CourierEnvironment;
  email: string;
  password: string;
  apiKey: string;
  originDistrictId: string;
  originCityId: string;
  pickupAddress: string;
  isActive: boolean;
}

export interface CourierActivationInput {
  isActive: boolean;
  email: string | null | undefined;
  password: string | null | undefined;
  apiKey: string | null | undefined;
  originDistrictId: number | null | undefined;
  originCityId: number | null | undefined;
  pickupAddress: string | null | undefined;
}

export interface CourierValidationIssue {
  field: string;
  message: string;
}

function nullableInteger(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const numeric = Number(trimmed);
  return Number.isInteger(numeric) ? numeric : null;
}

/**
 * Build the JSON body for PUT (save), POST /settings (dry-run test) and
 * POST /locations (dry-run sync). Email, pickup address and origin ids are
 * ALWAYS present so an explicit empty value clears the stored field; secrets
 * are only sent when the operator typed a new one.
 */
export function buildCourierSettingsPayload(
  draft: CourierSettingsDraft,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    env: draft.env,
    isActive: draft.isActive,
    email: draft.email.trim(),
    originDistrictId: nullableInteger(draft.originDistrictId),
    originCityId: nullableInteger(draft.originCityId),
    pickupAddress: draft.pickupAddress.trim(),
  };
  if (draft.password) payload.password = draft.password;
  if (draft.apiKey) payload.apiKey = draft.apiKey;
  return payload;
}

export interface CourierSettingsRecord {
  email?: string | null;
  password?: string | null;
  apiKey?: string | null;
  originDistrictId?: number | null;
  originCityId?: number | null;
  pickupAddress?: string | null;
}

/**
 * Merge a parsed request into the stored fields with explicit clear semantics.
 * Secrets are never cleared by an empty value (only by typing a replacement).
 */
export function resolveCourierSettingsUpdate(
  input: {
    env?: CourierEnvironment | undefined;
    email?: string | null | undefined;
    password?: string | null | undefined;
    apiKey?: string | null | undefined;
    originDistrictId?: number | null | undefined;
    originCityId?: number | null | undefined;
    pickupAddress?: string | null | undefined;
    isActive?: boolean | undefined;
  },
  existing?: CourierSettingsRecord | null,
): { data: Record<string, unknown>; effective: CourierActivationInput } {
  const isActive = input.isActive ?? false;
  const email =
    input.email !== undefined ? input.email?.trim() || null : existing?.email ?? null;
  const pickupAddress =
    input.pickupAddress !== undefined
      ? input.pickupAddress?.trim() || null
      : existing?.pickupAddress ?? null;
  const originDistrictId =
    input.originDistrictId !== undefined
      ? input.originDistrictId
      : existing?.originDistrictId ?? null;
  const originCityId =
    input.originCityId !== undefined
      ? input.originCityId
      : existing?.originCityId ?? null;

  const data: Record<string, unknown> = {
    isActive,
    email,
    originDistrictId,
    originCityId,
    pickupAddress,
  };
  if (input.env !== undefined) data.env = input.env;
  if (input.password) data.password = input.password;
  if (input.apiKey) data.apiKey = input.apiKey;

  return {
    data,
    effective: {
      isActive,
      email,
      password: input.password || existing?.password || null,
      apiKey: input.apiKey || existing?.apiKey || null,
      originDistrictId,
      originCityId,
      pickupAddress,
    },
  };
}

/**
 * A courier account may only be activated with credentials AND an origin
 * (district, city, pickup address). Saving an inactive draft stays permissive.
 */
export function validateCourierActivation(
  input: CourierActivationInput,
): CourierValidationIssue[] {
  if (!input.isActive) return [];

  const issues: CourierValidationIssue[] = [];
  const hasCredentials = Boolean(input.apiKey) || Boolean(input.email && input.password);
  if (!hasCredentials) {
    issues.push({
      field: 'password',
      message: 'An API key or an email + password is required to activate the account',
    });
  }
  if (!input.originDistrictId) {
    issues.push({ field: 'originDistrictId', message: 'Origin district is required' });
  }
  if (!input.originCityId) {
    issues.push({ field: 'originCityId', message: 'Origin city is required' });
  }
  if (!input.pickupAddress || input.pickupAddress.trim() === '') {
    issues.push({ field: 'pickupAddress', message: 'Pickup address is required' });
  }
  return issues;
}

/** Effective credentials sent to a dry-run test/sync, falling back to stored. */
export function resolveCourierTestCredentials(
  draft: {
    env?: CourierEnvironment | undefined;
    email?: string | null | undefined;
    password?: string | null | undefined;
    apiKey?: string | null | undefined;
  },
  existing?: CourierSettingsRecord & { env?: CourierEnvironment | null } | null,
): { env: CourierEnvironment; email?: string; password?: string; apiKey?: string } {
  const email = draft.email !== undefined ? draft.email?.trim() || '' : existing?.email ?? '';
  const password = draft.password || existing?.password || '';
  const apiKey = draft.apiKey || existing?.apiKey || '';
  return {
    env: draft.env ?? existing?.env ?? 'STAGING',
    ...(email ? { email } : {}),
    ...(password ? { password } : {}),
    ...(apiKey ? { apiKey } : {}),
  };
}

export function hasCourierTestCredentials(credentials: {
  email?: string;
  password?: string;
  apiKey?: string;
}): boolean {
  return Boolean(credentials.apiKey) || Boolean(credentials.email && credentials.password);
}
