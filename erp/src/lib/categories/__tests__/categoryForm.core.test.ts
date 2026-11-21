import { describe, expect, it } from 'vitest';

import {
  CATEGORY_DESCRIPTION_MAX,
  CATEGORY_SORT_ORDER_MAX,
  validateCategoryForm,
} from '@/lib/categories/categoryForm.core';

/** ARGUS #169: creating a category must offer the full field set. */
describe('validateCategoryForm', () => {
  it('accepts a complete create payload with description, sort order and image', () => {
    const result = validateCategoryForm({
      name: '  Ayurvedic Oils  ',
      description: '  Cold-pressed oils  ',
      sortOrder: '3',
      imageUrl: 'https://cdn.example.com/oils.webp',
    });

    expect(result.valid).toBe(true);
    expect(result.payload).toEqual({
      name: 'Ayurvedic Oils',
      description: 'Cold-pressed oils',
      sortOrder: 3,
      imageUrl: 'https://cdn.example.com/oils.webp',
    });
  });

  it('treats a blank description and image as clear (null)', () => {
    const result = validateCategoryForm({
      name: 'Oils',
      description: '   ',
      imageUrl: '',
    });

    expect(result.valid).toBe(true);
    expect(result.payload.description).toBeNull();
    expect(result.payload.imageUrl).toBeNull();
    expect(result.payload.sortOrder).toBe(0);
  });

  it('requires a name between 2 and 60 characters', () => {
    expect(validateCategoryForm({ name: 'A' }).valid).toBe(false);
    expect(validateCategoryForm({ name: 'x'.repeat(61) }).valid).toBe(false);
    expect(validateCategoryForm({ name: 'A' }).errors.name).toMatch(/2-60/);
  });

  it('rejects a negative sort order', () => {
    const result = validateCategoryForm({ name: 'Oils', sortOrder: '-1' });
    expect(result.valid).toBe(false);
    expect(result.errors.sortOrder).toBeDefined();
  });

  /** ARGUS #170: the API caps at 500 and the sort order is a 32-bit int. */
  it('blocks a description over the 500-character API cap', () => {
    const atLimit = validateCategoryForm({
      name: 'Oils',
      description: 'x'.repeat(CATEGORY_DESCRIPTION_MAX),
    });
    const overLimit = validateCategoryForm({
      name: 'Oils',
      description: 'x'.repeat(CATEGORY_DESCRIPTION_MAX + 20),
    });

    expect(atLimit.valid).toBe(true);
    expect(overLimit.valid).toBe(false);
    expect(overLimit.errors.description).toMatch(/500/);
  });

  it('accepts the 32-bit sort-order maximum and rejects anything larger', () => {
    expect(
      validateCategoryForm({ name: 'Oils', sortOrder: String(CATEGORY_SORT_ORDER_MAX) })
        .valid,
    ).toBe(true);

    const tooLarge = validateCategoryForm({
      name: 'Oils',
      sortOrder: String(CATEGORY_SORT_ORDER_MAX + 1),
    });
    expect(tooLarge.valid).toBe(false);
    expect(tooLarge.errors.sortOrder).toMatch(/2147483647/);
  });
});
