/**
 * Category form rules shared by the create and edit dialog (ARGUS #169).
 *
 * The inline "New Category" form only collected a name, so description, image
 * and sort order were only reachable by creating a category and reopening it.
 * New Category now opens the same dialog in create mode; these pure helpers keep
 * the payload and the Save gating identical for both modes.
 */

export const CATEGORY_NAME_MIN = 2;
export const CATEGORY_NAME_MAX = 60;
/** Matches the API/protocol cap: the category description column stores 500. */
export const CATEGORY_DESCRIPTION_MAX = 500;
/** `Category.sortOrder` is a 32-bit integer in the database. */
export const CATEGORY_SORT_ORDER_MAX = 2_147_483_647;

export interface CategoryFormInput {
  name: string;
  description?: string | null;
  sortOrder?: string | number | null;
  imageUrl?: string | null;
}

export interface CategoryFormErrors {
  name?: string;
  description?: string;
  sortOrder?: string;
}

export interface CategoryFormPayload {
  name: string;
  description: string | null;
  sortOrder: number;
  imageUrl: string | null;
}

export interface ValidatedCategoryForm {
  valid: boolean;
  errors: CategoryFormErrors;
  payload: CategoryFormPayload;
}

function parseSortOrder(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  return parsed;
}

/**
 * Validate the dialog fields and build the exact API payload. Sorting is
 * optional (blank means 0), and an empty description is sent as `null` so it
 * clears the stored text instead of leaving it untouched (ARGUS #166).
 */
export function validateCategoryForm(input: CategoryFormInput): ValidatedCategoryForm {
  const name = input.name.trim();
  const description = (input.description ?? '').trim();
  const sortOrder = parseSortOrder(input.sortOrder);
  const imageUrl = (input.imageUrl ?? '').trim();

  const errors: CategoryFormErrors = {};

  if (name.length < CATEGORY_NAME_MIN || name.length > CATEGORY_NAME_MAX) {
    errors.name = `Name must be ${CATEGORY_NAME_MIN}-${CATEGORY_NAME_MAX} characters.`;
  }

  if (description.length > CATEGORY_DESCRIPTION_MAX) {
    errors.description = `Description must be ${CATEGORY_DESCRIPTION_MAX} characters or fewer.`;
  }

  if (
    sortOrder === null ||
    sortOrder < 0 ||
    sortOrder > CATEGORY_SORT_ORDER_MAX
  ) {
    errors.sortOrder = `Sort order must be a whole number between 0 and ${CATEGORY_SORT_ORDER_MAX}.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    payload: {
      name,
      description: description === '' ? null : description,
      sortOrder: sortOrder ?? 0,
      imageUrl: imageUrl === '' ? null : imageUrl,
    },
  };
}
