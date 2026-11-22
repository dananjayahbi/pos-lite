/**
 * Website reset contract (ARGUS #497).
 *
 * "Delete all content" must match its promise. The old reset cleared copy,
 * media URLs, nav/footer and deleted slides/ads, but left colours, typography,
 * the announcement bar and the appointments config behind, and never removed
 * the uploaded objects from storage. These are the defaults the reset writes
 * and the candidate URLs it hands to the storage cleanup.
 */

/**
 * Every field the reset writes. Mirrors the `WebsiteConfig` model so a new
 * nullable field cannot be forgotten silently: add it here and the reset clears
 * it. JSON columns reset to their schema defaults.
 */
export const WEBSITE_RESET_CONFIG_DATA = {
  siteName: null,
  tagline: null,
  logoUrl: null,
  faviconUrl: null,

  // Colors - same defaults as the schema
  primaryColor: '#0a0a0a',
  accentColor: '#b4946e',
  bgColor: '#ece2d6',

  // Typography
  headingFontFamily: null,
  bodyFontFamily: null,
  headingColor: '#0a0a0a',
  bodyColor: '#555555',

  // SEO
  metaTitle: null,
  metaDescription: null,

  socialLinks: {},
  announcementBar: {},
  navItems: [],
  sections: {},
  footerAbout: null,
  footerColumns: [],
  appointments: {},

  // About
  aboutPageTitle: null,
  aboutPageSubtitle: null,
  aboutHeroImageUrl: null,
  aboutStoryTitle: null,
  aboutStoryContent: null,
  aboutStoryImageUrl: null,
  aboutMissionTitle: null,
  aboutMissionContent: null,
  aboutValuesSectionTitle: null,
  aboutValues: [],
  aboutPhoneLabel: null,
  aboutPhoneNumber: null,

  // Contact
  contactPageTitle: null,
  contactPageSubtitle: null,
  contactHeroImageUrl: null,
  contactInfoTitle: null,
  contactAddress: null,
  contactPhoneDisplay: null,
  contactEmailDisplay: null,
  contactBusinessHours: null,
  contactMapEmbedUrl: null,

  // Shop
  shopPageTitle: null,
  shopPageSubtitle: null,
  shopHeroImageUrl: null,
  shopPageDescription: null,
  shopProductsPerPage: 24,
} as const;

/**
 * Collect every string that could be a stored website asset. The caller filters
 * these through `extractTenantAssetPath`, so external links and page copy are
 * rejected there; this helper only narrows the traversal to URL-like strings
 * and deduplicates them.
 */
export function collectWebsiteAssetCandidates(config: unknown): string[] {
  const found = new Set<string>();

  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      if (/^https?:\/\//i.test(value) || value.includes('/website/')) {
        found.add(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value === 'object' && value !== null) {
      for (const item of Object.values(value)) visit(item);
    }
  };

  visit(config);
  return [...found];
}

export interface WebsiteResetSummary {
  /** False when the tenant had no website config row to reset. */
  reset: boolean;
  deletedAssets: number;
  failedAssets: number;
  /** URLs that were not tenant-owned website objects (external/unsupported). */
  skippedAssets: number;
}

export function websiteResetSummary(input: {
  reset: boolean;
  deletedAssets: number;
  failedAssets: number;
  skippedAssets: number;
}): WebsiteResetSummary {
  return {
    reset: input.reset,
    deletedAssets: input.deletedAssets,
    failedAssets: input.failedAssets,
    skippedAssets: input.skippedAssets,
  };
}
