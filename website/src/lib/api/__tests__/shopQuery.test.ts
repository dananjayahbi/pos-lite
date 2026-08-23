import { describe, it, expect, vi } from 'vitest';
import { buildShopUrl, priceBounds } from '@/lib/api/shopQuery';
import type { PublicProduct } from '@/types/website.types';

// tenantHomePath reads process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG.
vi.stubEnv('NEXT_PUBLIC_DEFAULT_TENANT_SLUG', 'ruhunuwedagedara');

describe('buildShopUrl', () => {
  it('builds a plain shop URL for a non-default tenant', () => {
    expect(buildShopUrl('acme', {})).toBe('/acme/shop');
  });

  it('omits latest sort', () => {
    expect(buildShopUrl('acme', { sort: 'latest' })).toBe('/acme/shop');
  });

  it('includes active filters as query params', () => {
    const url = buildShopUrl('acme', {
      category: 'cat1',
      sort: 'price-asc',
      priceMin: 100,
      priceMax: 500,
      concern: 'IMMUNITY',
      form: 'Capsule',
      q: 'ashwagandha',
    });
    expect(url).toContain('category=cat1');
    expect(url).toContain('sort=price-asc');
    expect(url).toContain('priceMin=100');
    expect(url).toContain('priceMax=500');
    expect(url).toContain('concern=IMMUNITY');
    expect(url).toContain('form=Capsule');
    expect(url).toContain('q=ashwagandha');
  });

  it('drops undefined optional values', () => {
    const url = buildShopUrl('acme', { category: undefined, priceMin: undefined });
    expect(url).toBe('/acme/shop');
  });
});

describe('priceBounds', () => {
  const product = (variants: number[]): PublicProduct =>
    ({
      id: 'p',
      name: 'p',
      tags: [],
      healthConcerns: [],
      variants: variants.map((retailPrice) => ({
        id: `v${retailPrice}`,
        sku: `sku${retailPrice}`,
        retailPrice,
        imageUrls: [],
        stockQuantity: 1,
        productId: 'p',
      })),
    }) as PublicProduct;

  it('computes min/max across variants', () => {
    const products = [product([100, 50]), product([300])];
    expect(priceBounds(products)).toEqual({ min: 50, max: 300 });
  });

  it('falls back to 0 for an empty catalog', () => {
    expect(priceBounds([])).toEqual({ min: 0, max: 0 });
  });
});
