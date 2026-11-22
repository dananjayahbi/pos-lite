/**
 * Brand form rules shared by the New Brand and Edit Brand dialog (ARGUS #177).
 *
 * The description textarea had no client cap while the API rejects anything
 * over 500, so Save stayed enabled and the failure surfaced as a server
 * validation error. Keeping the limit and payload here makes both modes agree.
 */

export const BRAND_NAME_MIN = 2;
export const BRAND_NAME_MAX = 60;
/** Matches the `BrandSchema`/API cap for the description. */
export const BRAND_DESCRIPTION_MAX = 500;

export interface BrandFormInput {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
}

export interface BrandFormErrors {
  name?: string;
  description?: string;
}

export interface BrandFormPayload {
  name: string;
  description: string | null;
  logoUrl: string | null;
}

export interface ValidatedBrandForm {
  valid: boolean;
  errors: BrandFormErrors;
  payload: BrandFormPayload;
}

export function validateBrandForm(input: BrandFormInput): ValidatedBrandForm {
  const name = input.name.trim();
  const description = (input.description ?? '').trim();
  const errors: BrandFormErrors = {};

  if (name.length < BRAND_NAME_MIN || name.length > BRAND_NAME_MAX) {
    errors.name = `Name must be ${BRAND_NAME_MIN}-${BRAND_NAME_MAX} characters.`;
  }

  if (description.length > BRAND_DESCRIPTION_MAX) {
    errors.description = `Description must be ${BRAND_DESCRIPTION_MAX} characters or fewer.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    payload: {
      name,
      // An empty description clears the stored text (ARGUS #174).
      description: description === '' ? null : description,
      // Always send logoUrl so explicit removals (null) persist.
      logoUrl: input.logoUrl ?? null,
    },
  };
}
