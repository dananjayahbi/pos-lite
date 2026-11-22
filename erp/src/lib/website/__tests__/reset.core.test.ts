import { describe, expect, it } from 'vitest';

import {
  collectWebsiteAssetCandidates,
  WEBSITE_RESET_CONFIG_DATA,
  websiteResetSummary,
} from '@/lib/website/reset.core';

/**
 * ARGUS #497: "Delete all content" must clear colours, typography,
 * announcement/appointments config and uploaded media, not just copy/slides.
 */
describe('website reset contract', () => {
  it('resets every field the form can configure', () => {
    expect(WEBSITE_RESET_CONFIG_DATA.primaryColor).toBe('#0a0a0a');
    expect(WEBSITE_RESET_CONFIG_DATA.accentColor).toBe('#b4946e');
    expect(WEBSITE_RESET_CONFIG_DATA.bgColor).toBe('#ece2d6');
    expect(WEBSITE_RESET_CONFIG_DATA.headingFontFamily).toBeNull();
    expect(WEBSITE_RESET_CONFIG_DATA.bodyFontFamily).toBeNull();
    expect(WEBSITE_RESET_CONFIG_DATA.headingColor).toBe('#0a0a0a');
    expect(WEBSITE_RESET_CONFIG_DATA.bodyColor).toBe('#555555');
    expect(WEBSITE_RESET_CONFIG_DATA.announcementBar).toEqual({});
    expect(WEBSITE_RESET_CONFIG_DATA.appointments).toEqual({});
  });

  it('clears copy, navigation, footer and shop/about/contact content', () => {
    expect(WEBSITE_RESET_CONFIG_DATA.siteName).toBeNull();
    expect(WEBSITE_RESET_CONFIG_DATA.navItems).toEqual([]);
    expect(WEBSITE_RESET_CONFIG_DATA.footerColumns).toEqual([]);
    expect(WEBSITE_RESET_CONFIG_DATA.sections).toEqual({});
    expect(WEBSITE_RESET_CONFIG_DATA.aboutStoryContent).toBeNull();
    expect(WEBSITE_RESET_CONFIG_DATA.contactAddress).toBeNull();
    expect(WEBSITE_RESET_CONFIG_DATA.shopProductsPerPage).toBe(24);
  });

  it('collects nested config, slide and ad asset URLs without duplicates', () => {
    const urls = collectWebsiteAssetCandidates({
      logoUrl: 'https://cdn.example.com/t1/website/images/logo.png',
      faviconUrl: 'https://cdn.example.com/t1/website/images/favicon.png',
      navItems: [{ label: 'Shop', href: '/shop' }],
      sections: {
        infoAd: {
          desktopImageUrl: 'https://cdn.example.com/t1/website/images/info.png',
          mobileImageUrl: 'https://cdn.example.com/t1/website/images/info.png',
        },
        categories: {
          categoryImages: {
            cat1: 'https://cdn.example.com/t1/website/images/cat1.png',
          },
        },
      },
      heroSlides: [{ mediaUrl: 'https://cdn.example.com/t1/website/videos/hero.mp4' }],
      ads: [{ mediaUrl: 'https://cdn.example.com/t1/website/images/ad.png' }],
      appointments: { heroImageUrl: 'https://cdn.example.com/t1/website/images/appt.png' },
    });

    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain('https://cdn.example.com/t1/website/images/info.png');
    expect(urls).toContain('https://cdn.example.com/t1/website/images/cat1.png');
    expect(urls).toContain('https://cdn.example.com/t1/website/videos/hero.mp4');
    expect(urls).toContain('https://cdn.example.com/t1/website/images/ad.png');
    expect(urls).toContain('https://cdn.example.com/t1/website/images/appt.png');
    expect(urls).not.toContain('/shop');
  });

  it('ignores non-URL copy', () => {
    expect(
      collectWebsiteAssetCandidates({
        tagline: 'Herbal care since 1990',
        aboutStoryContent: 'We started with one shop.',
      }),
    ).toEqual([]);
  });

  it('reports a clear cleanup summary', () => {
    expect(
      websiteResetSummary({
        reset: true,
        deletedAssets: 4,
        failedAssets: 1,
        skippedAssets: 2,
      }),
    ).toEqual({
      reset: true,
      deletedAssets: 4,
      failedAssets: 1,
      skippedAssets: 2,
    });
  });
});
