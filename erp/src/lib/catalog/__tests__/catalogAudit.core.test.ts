import { describe, expect, it } from 'vitest';

import {
  brandAuditSnapshot,
  categoryAuditSnapshot,
  changedAuditFields,
} from '@/lib/catalog/catalogAudit.core';

/** ARGUS #167: category create/update audit rows carry bounded before/after. */
describe('categoryAuditSnapshot', () => {
  it('keeps only the editable category fields', () => {
    expect(
      categoryAuditSnapshot({
        name: 'Hair Care',
        description: 'Oils and balms',
        sortOrder: 3,
        imageUrl: 'https://cdn.example/hair.png',
      }),
    ).toEqual({
      name: 'Hair Care',
      description: 'Oils and balms',
      sortOrder: 3,
      imageUrl: 'https://cdn.example/hair.png',
    });
  });

  it('normalizes missing description and image to null', () => {
    expect(
      categoryAuditSnapshot({
        name: 'Oils',
        description: null,
        sortOrder: 0,
        imageUrl: null,
      }),
    ).toEqual({
      name: 'Oils',
      description: null,
      sortOrder: 0,
      imageUrl: null,
    });
  });
});

describe('brandAuditSnapshot', () => {
  it('keeps only the editable brand fields', () => {
    expect(
      brandAuditSnapshot({
        name: 'Ayur',
        description: 'Herbal essentials',
        logoUrl: 'https://cdn.example/logo.png',
      }),
    ).toEqual({
      name: 'Ayur',
      description: 'Herbal essentials',
      logoUrl: 'https://cdn.example/logo.png',
    });
  });

  it('normalizes a cleared description and logo to null', () => {
    expect(brandAuditSnapshot({ name: 'Ayur', description: null, logoUrl: null })).toEqual({
      name: 'Ayur',
      description: null,
      logoUrl: null,
    });
  });

  it('reports a cleared description as a changed field', () => {
    const before = brandAuditSnapshot({
      name: 'Ayur',
      description: 'Old text',
      logoUrl: null,
    });
    const after = brandAuditSnapshot({ name: 'Ayur', description: null, logoUrl: null });
    expect(changedAuditFields(before, after)).toEqual(['description']);
  });
});

describe('changedAuditFields', () => {
  const before = {
    name: 'Hair Care',
    description: 'Old text',
    sortOrder: 1,
    imageUrl: null,
  };

  it('lists only the fields whose value changed', () => {
    expect(
      changedAuditFields(before, {
        name: 'Hair Care',
        description: null,
        sortOrder: 1,
        imageUrl: 'https://cdn.example/new.png',
      }).sort(),
    ).toEqual(['description', 'imageUrl']);
  });

  it('returns nothing when a PATCH repeats the stored values', () => {
    expect(changedAuditFields(before, { ...before })).toEqual([]);
  });

  it('treats null and an empty string as different values', () => {
    expect(
      changedAuditFields({ description: null }, { description: '' }),
    ).toEqual(['description']);
  });
});
