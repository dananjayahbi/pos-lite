import { describe, expect, it } from 'vitest';

import { BrandSchema, UpdateBrandSchema } from '@/lib/validators/brand.validators';

/** ARGUS #174: clearing a brand description must persist as null. */
describe('brand validators', () => {
  it('turns an empty description into null', () => {
    const parsed = UpdateBrandSchema.parse({ description: '' });
    expect(parsed.description).toBeNull();
  });

  it('turns a whitespace-only description into null', () => {
    const parsed = UpdateBrandSchema.parse({ description: '   ' });
    expect(parsed.description).toBeNull();
  });

  it('accepts null and trims real text', () => {
    expect(UpdateBrandSchema.parse({ description: null }).description).toBeNull();
    expect(
      UpdateBrandSchema.parse({ description: '  Herbal essentials  ' }).description,
    ).toBe('Herbal essentials');
  });

  it('keeps an omitted description undefined so PATCH leaves it untouched', () => {
    expect(UpdateBrandSchema.parse({}).description).toBeUndefined();
  });

  it('still caps the description length', () => {
    expect(BrandSchema.safeParse({ name: 'Ayur', description: 'x'.repeat(501) }).success).toBe(
      false,
    );
  });
});
