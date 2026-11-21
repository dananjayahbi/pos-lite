import { describe, expect, it } from 'vitest';

import {
  CategorySchema,
  UpdateCategorySchema,
} from '@/lib/validators/category.validators';

/** ARGUS #166: clearing a category description must persist as null. */
describe('category validators', () => {
  it('turns an empty description into null', () => {
    const parsed = UpdateCategorySchema.parse({ description: '' });
    expect(parsed.description).toBeNull();
  });

  it('turns a whitespace-only description into null', () => {
    const parsed = UpdateCategorySchema.parse({ description: '   ' });
    expect(parsed.description).toBeNull();
  });

  it('accepts null and trims real text', () => {
    expect(UpdateCategorySchema.parse({ description: null }).description).toBeNull();
    expect(
      UpdateCategorySchema.parse({ description: '  Oils and balms  ' }).description,
    ).toBe('Oils and balms');
  });

  it('keeps an omitted description undefined so PATCH leaves it untouched', () => {
    expect(UpdateCategorySchema.parse({}).description).toBeUndefined();
  });

  it('still caps the description length', () => {
    expect(CategorySchema.safeParse({ name: 'Oils', description: 'x'.repeat(501) }).success).toBe(
      false,
    );
  });

  /** ARGUS #170: the sort order must fit the 32-bit integer column. */
  it('rejects a sort order above the 32-bit integer maximum', () => {
    expect(
      CategorySchema.safeParse({ name: 'Oils', sortOrder: 2_147_483_647 }).success,
    ).toBe(true);
    expect(
      CategorySchema.safeParse({ name: 'Oils', sortOrder: 2_147_483_648 }).success,
    ).toBe(false);
  });
});
