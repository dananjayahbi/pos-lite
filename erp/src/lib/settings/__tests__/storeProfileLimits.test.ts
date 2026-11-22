import { describe, expect, it } from 'vitest';

import {
  STORE_PROFILE_LIMITS,
  firstStoreProfileFieldError,
  isSafeLogoUrl,
  storeProfileFieldErrors,
} from '@/lib/settings/storeProfileLimits';
import {
  cloudinaryPublicIdFromUrl,
  r2ObjectKeyFromUrl,
  supabaseObjectKeyFromUrl,
} from '@/lib/storage-keys.core';

/**
 * ARGUS #476: limits must be visible before the API rejects a save, and a logo
 * must not accept an arbitrary scheme or leave an orphaned object behind.
 */
describe('store profile field limits', () => {
  const ok = {
    storeName: 'Ruhunu Weda Gedara',
    address: '12 Galle Road\nMatara',
    phoneNumber: '041 222 3344',
    receiptFooter: 'Thank you for shopping with us!',
  };

  it('accepts a complete profile', () => {
    expect(storeProfileFieldErrors(ok)).toEqual({});
  });

  it('reports the name rule inline', () => {
    expect(storeProfileFieldErrors({ ...ok, storeName: ' A ' })).toEqual({
      storeName: 'Store name must be at least 2 characters.',
    });
  });

  it('reports each capped field at the API limit', () => {
    const errors = storeProfileFieldErrors({
      storeName: 'X'.repeat(STORE_PROFILE_LIMITS.storeName + 1),
      address: 'a'.repeat(STORE_PROFILE_LIMITS.address + 1),
      phoneNumber: '1'.repeat(STORE_PROFILE_LIMITS.phoneNumber + 1),
      receiptFooter: 'f'.repeat(STORE_PROFILE_LIMITS.receiptFooter + 1),
    });
    expect(Object.keys(errors).sort()).toEqual([
      'address',
      'phoneNumber',
      'receiptFooter',
      'storeName',
    ]);
  });

  it('returns the first error in form order', () => {
    expect(
      firstStoreProfileFieldError({
        receiptFooter: 'footer',
        address: 'address',
      }),
    ).toBe('address');
    expect(firstStoreProfileFieldError({})).toBeNull();
  });
});

describe('logo URL safety', () => {
  it('accepts http(s) and uploaded root-relative paths', () => {
    expect(isSafeLogoUrl('https://cdn.example.com/logo.png')).toBe(true);
    expect(isSafeLogoUrl('/uploads/lankaqr.png')).toBe(true);
    expect(isSafeLogoUrl('')).toBe(true);
  });

  it('rejects arbitrary schemes and over-long URLs', () => {
    expect(isSafeLogoUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeLogoUrl('data:image/svg+xml;base64,AAAA')).toBe(false);
    expect(isSafeLogoUrl(`https://cdn.example.com/${'a'.repeat(3000)}`)).toBe(false);
  });
});

describe('stored asset key extraction', () => {
  it('derives an R2 key only for the configured public base', () => {
    expect(
      r2ObjectKeyFromUrl('https://cdn.example.com/t1/logo/store-logo-1.png', 'https://cdn.example.com/'),
    ).toBe('t1/logo/store-logo-1.png');
    expect(r2ObjectKeyFromUrl('https://other.example.com/t1/logo.png', 'https://cdn.example.com')).toBeNull();
  });

  it('strips the Cloudinary upload prefix and extension', () => {
    expect(
      cloudinaryPublicIdFromUrl('https://res.cloudinary.com/demo/image/upload/v123/store-logos/t1/logo-1.webp'),
    ).toBe('store-logos/t1/logo-1');
    expect(cloudinaryPublicIdFromUrl('https://cdn.example.com/logo.png')).toBeNull();
  });

  it('derives a Supabase object key from the public URL', () => {
    expect(
      supabaseObjectKeyFromUrl(
        'https://proj.supabase.co/storage/v1/object/public/product-images/t1/logo-1.png',
      ),
    ).toBe('t1/logo-1.png');
    expect(supabaseObjectKeyFromUrl('https://cdn.example.com/logo.png')).toBeNull();
  });
});
