import { describe, expect, it } from 'vitest';

import { validateCategoryForm } from '@/lib/categories/categoryForm.core';

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
});
