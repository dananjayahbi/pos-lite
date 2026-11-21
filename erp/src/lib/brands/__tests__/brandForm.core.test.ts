import { describe, expect, it } from 'vitest';

import {
  BRAND_DESCRIPTION_MAX,
  validateBrandForm,
} from '@/lib/brands/brandForm.core';

/** ARGUS #177: the brand description must be capped in the UI, like the API. */
describe('validateBrandForm', () => {
  it('accepts a description at the 500-character limit', () => {
    const result = validateBrandForm({
      name: 'Baidyanath',
      description: 'x'.repeat(BRAND_DESCRIPTION_MAX),
    });

    expect(result.valid).toBe(true);
    expect(result.payload.description).toHaveLength(BRAND_DESCRIPTION_MAX);
  });

  it('blocks Save for a description over the API cap', () => {
    const result = validateBrandForm({
      name: 'Baidyanath',
      description: 'x'.repeat(BRAND_DESCRIPTION_MAX + 20),
    });

    expect(result.valid).toBe(false);
    expect(result.errors.description).toMatch(/500/);
  });

  it('clears a blank description and always sends the logo field', () => {
    const result = validateBrandForm({ name: 'Baidyanath', description: '   ' });

    expect(result.valid).toBe(true);
    expect(result.payload.description).toBeNull();
    expect(result.payload.logoUrl).toBeNull();
  });

  it('trims the name and keeps a real logo URL', () => {
    const result = validateBrandForm({
      name: '  Baidyanath  ',
      logoUrl: 'https://cdn.example.com/logo.webp',
    });

    expect(result.valid).toBe(true);
    expect(result.payload.name).toBe('Baidyanath');
    expect(result.payload.logoUrl).toBe('https://cdn.example.com/logo.webp');
  });
});
