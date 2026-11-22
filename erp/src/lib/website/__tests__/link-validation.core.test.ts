import { describe, expect, it } from 'vitest';

import {
  isHexColor,
  isHexColorOrEmpty,
  isSafeWebsiteHref,
  isSafeWebsiteHrefOrEmpty,
} from '@/lib/website/link-validation.core';

/** ARGUS #503: storefront fields render links/colours directly. */
describe('website link validation', () => {
  it('accepts internal paths, named fragments, contact links and http(s)', () => {
    for (const value of [
      '/shop',
      '/about?from=home',
      '#contact',
      'mailto:hello@example.com',
      'tel:+94771234567',
      'https://example.com/shop',
      'http://localhost:3002/dilani',
    ]) {
      expect(isSafeWebsiteHref(value), value).toBe(true);
    }
  });

  it('rejects executable, protocol-relative and placeholder links', () => {
    for (const value of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      '//evil.example.com',
      '#',
      'shop',
      '/shop with space',
    ]) {
      expect(isSafeWebsiteHref(value), value).toBe(false);
    }
  });

  it('lets optional fields clear with an empty value', () => {
    expect(isSafeWebsiteHrefOrEmpty('')).toBe(true);
    expect(isSafeWebsiteHrefOrEmpty('   ')).toBe(true);
    expect(isSafeWebsiteHrefOrEmpty('javascript:void(0)')).toBe(false);
  });
});

describe('hex colour validation', () => {
  it('accepts 3- and 6-digit hex colours', () => {
    expect(isHexColor('#fff')).toBe(true);
    expect(isHexColor('#0a0a0a')).toBe(true);
    expect(isHexColor(' #B4946E ')).toBe(true);
  });

  it('rejects names, shorthand garbage and over-long values', () => {
    for (const value of ['red', '#12', '#12345', '#1234567', '0a0a0a', '#gggggg']) {
      expect(isHexColor(value), value).toBe(false);
    }
  });

  it('treats null/empty as "use the default"', () => {
    expect(isHexColorOrEmpty(null)).toBe(true);
    expect(isHexColorOrEmpty('')).toBe(true);
    expect(isHexColorOrEmpty('#12345')).toBe(false);
  });
});
