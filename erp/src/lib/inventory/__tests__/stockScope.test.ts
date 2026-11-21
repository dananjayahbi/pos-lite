import { describe, expect, it } from 'vitest';

import {
  isStockScopeVariant,
  STOCK_SCOPE_PRISMA_WHERE,
  STOCK_SCOPE_SQL,
} from '@/lib/inventory/stockScope';

describe('stock scope (ARGUS #219)', () => {
  it('includes a live variant of an active product', () => {
    expect(
      isStockScopeVariant({
        variantDeletedAt: null,
        productDeletedAt: null,
        productIsArchived: false,
      }),
    ).toBe(true);
  });

  it('excludes archived products so the headline totals agree', () => {
    expect(
      isStockScopeVariant({
        variantDeletedAt: null,
        productDeletedAt: null,
        productIsArchived: true,
      }),
    ).toBe(false);
  });

  it('excludes soft-deleted products and variants', () => {
    expect(
      isStockScopeVariant({
        variantDeletedAt: null,
        productDeletedAt: new Date('2026-01-01'),
        productIsArchived: false,
      }),
    ).toBe(false);
    expect(
      isStockScopeVariant({
        variantDeletedAt: new Date('2026-01-01'),
        productDeletedAt: null,
        productIsArchived: false,
      }),
    ).toBe(false);
  });

  it('treats missing flags as live, matching the SQL IS NULL checks', () => {
    expect(isStockScopeVariant({})).toBe(true);
  });

  it('quotes the same predicates in SQL and Prisma form', () => {
    expect(STOCK_SCOPE_SQL).toContain('pv."deletedAt" IS NULL');
    expect(STOCK_SCOPE_SQL).toContain('p."deletedAt" IS NULL');
    expect(STOCK_SCOPE_SQL).toContain('p."isArchived" = false');
    expect(STOCK_SCOPE_PRISMA_WHERE).toEqual({
      deletedAt: null,
      product: { deletedAt: null, isArchived: false },
    });
  });
});
