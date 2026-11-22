import { describe, expect, it } from 'vitest';

import { isWebsiteConfigDirty } from '@/lib/website/dirty-state.core';

/** ARGUS #502: a reverted edit must clear the dirty state. */
describe('website config dirty tracking', () => {
  const initial = {
    siteName: 'Dilani Ayurveda',
    tagline: 'Healing, naturally',
    socialLinks: { facebook: 'https://facebook.com/dilani', youtube: '' },
    navItems: [{ label: 'Shop', href: '/shop' }],
  };

  it('is clean when the config is unchanged', () => {
    expect(isWebsiteConfigDirty(initial, structuredClone(initial))).toBe(false);
  });

  it('is clean after changing a field and changing it back', () => {
    const edited = { ...initial, tagline: 'Changed' };
    expect(isWebsiteConfigDirty(initial, edited)).toBe(true);

    const reverted = { ...edited, tagline: initial.tagline };
    expect(isWebsiteConfigDirty(initial, reverted)).toBe(false);
  });

  it('detects nested edits', () => {
    const edited = {
      ...initial,
      socialLinks: { ...initial.socialLinks, youtube: 'https://youtube.com/@dilani' },
    };
    expect(isWebsiteConfigDirty(initial, edited)).toBe(true);
  });

  it('ignores object key order but respects array order', () => {
    const reordered = {
      tagline: initial.tagline,
      siteName: initial.siteName,
      navItems: initial.navItems,
      socialLinks: { youtube: '', facebook: initial.socialLinks.facebook },
    };
    expect(isWebsiteConfigDirty(initial, reordered)).toBe(false);

    const reversed = { ...initial, navItems: [{ label: 'Shop', href: '/shop' }, { label: 'About', href: '/about' }] };
    expect(isWebsiteConfigDirty(initial, reversed)).toBe(true);
  });

  it('treats an undefined key as absent', () => {
    expect(isWebsiteConfigDirty({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(isWebsiteConfigDirty({ a: 1 }, { a: 2 })).toBe(true);
  });
});
