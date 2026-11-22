import { describe, expect, it } from 'vitest';

import {
  buildStorefrontPreviewUrl,
  normalizeStorefrontHost,
} from '@/lib/website/storefront-url.core';

/** ARGUS #500: the Appointments preview must include the tenant slug. */
describe('storefront preview URLs', () => {
  it('includes the tenant slug on the local storefront port', () => {
    expect(
      buildStorefrontPreviewUrl({
        protocol: 'http:',
        host: 'localhost:3003',
        tenantSlug: 'dilani',
        path: '/appointments',
      }),
    ).toBe('http://localhost:3002/dilani/appointments');
  });

  it('strips the admin prefix and keeps the bare host in production', () => {
    expect(
      buildStorefrontPreviewUrl({
        protocol: 'https:',
        host: 'admin.example.com',
        tenantSlug: 'dilani',
        path: '/appointments',
      }),
    ).toBe('https://example.com/dilani/appointments');
  });

  it('normalises a slash-wrapped slug and a path without a leading slash', () => {
    expect(
      buildStorefrontPreviewUrl({
        protocol: 'https:',
        host: 'example.com',
        tenantSlug: '/dilani/',
        path: 'appointments',
      }),
    ).toBe('https://example.com/dilani/appointments');
  });

  it('returns no link when the tenant slug is unknown', () => {
    expect(
      buildStorefrontPreviewUrl({
        protocol: 'http:',
        host: 'localhost:3003',
        tenantSlug: '  ',
        path: '/appointments',
      }),
    ).toBe('');
    expect(normalizeStorefrontHost('localhost:3003')).toBe('localhost:3002');
  });
});
