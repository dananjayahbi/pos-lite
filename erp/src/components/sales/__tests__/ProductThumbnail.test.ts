import { describe, it, expect } from 'vitest';
import { resolveProductImage } from '@/components/sales/ProductThumbnail';

// NewSaleSheet renders resolveProductImage(product.mainImageUrl, variant.imageUrls)
// next to every search result. The precedence rules are what the requirement
// (an image next to each product in the Record Sale search results) depends on.
describe('resolveProductImage', () => {
  it('prefers the product image over variant images', () => {
    expect(
      resolveProductImage('https://cdn/product.jpg', ['https://cdn/variant.jpg']),
    ).toBe('https://cdn/product.jpg');
  });

  it('falls back to the first variant image when the product has none', () => {
    expect(resolveProductImage(null, ['https://cdn/v1.jpg', 'https://cdn/v2.jpg'])).toBe(
      'https://cdn/v1.jpg',
    );
  });

  it('skips falsy entries inside the variant image list', () => {
    expect(resolveProductImage(undefined, ['', 'https://cdn/ok.jpg'])).toBe('https://cdn/ok.jpg');
  });

  it('returns null when neither product nor variant has an image', () => {
    expect(resolveProductImage(null, [])).toBeNull();
    expect(resolveProductImage(undefined, undefined)).toBeNull();
  });
});
