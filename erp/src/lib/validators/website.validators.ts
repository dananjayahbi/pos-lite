import { z } from 'zod';

// ── Social Links ─────────────────────────────────────────────────────────────

export const WebsiteSocialLinksSchema = z.object({
  facebook: z.string().url().nullable().optional().or(z.literal('')),
  instagram: z.string().url().nullable().optional().or(z.literal('')),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional().or(z.literal('')),
  whatsapp: z.string().nullable().optional().or(z.literal('')),
  tiktok: z.string().url().nullable().optional().or(z.literal('')),
  youtube: z.string().url().nullable().optional().or(z.literal('')),
});

// ── Navigation ───────────────────────────────────────────────────────────────

export const WebsiteNavItemSchema: z.ZodType<{
  label: string;
  href: string;
  children?: { label: string; href: string }[] | undefined;
}> = z.object({
  label: z.string().min(1).max(50),
  href: z.string().min(1).max(200),
  children: z
    .array(
      z.object({
        label: z.string().min(1).max(50),
        href: z.string().min(1).max(200),
      })
    )
    .optional(),
});

// ── Hero Slides ──────────────────────────────────────────────────────────────

export const WebsiteHeroSlideSchema = z.object({
  mediaType: z.enum(['image', 'video']),
  mediaUrl: z.string().min(1, 'Media URL is required'),
  mobileMediaUrl: z.string().nullable().optional().or(z.literal('')),
  title: z.string().max(200).nullable().optional().or(z.literal('')),
  subtitle: z.string().max(300).nullable().optional().or(z.literal('')),
  description: z.string().max(500).nullable().optional().or(z.literal('')),
  ctaText: z.string().max(50).nullable().optional().or(z.literal('')),
  ctaLink: z.string().max(200).nullable().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const UpdateWebsiteHeroSlideSchema = WebsiteHeroSlideSchema.partial();

// ── Ads ──────────────────────────────────────────────────────────────────────

export const WebsiteAdSchema = z.object({
  name: z.string().min(1, 'Ad name is required').max(100),
  mediaType: z.enum(['image', 'video']),
  mediaUrl: z.string().min(1, 'Media URL is required'),
  mobileMediaUrl: z.string().nullable().optional().or(z.literal('')),
  targetUrl: z.string().max(500).nullable().optional().or(z.literal('')),
  position: z.enum(['header', 'between_sections', 'sidebar', 'popup']),
  displayAfterSection: z.string().nullable().optional().or(z.literal('')),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const UpdateWebsiteAdSchema = WebsiteAdSchema.partial();

// ── Section Configs ──────────────────────────────────────────────────────────

export const ShopByConcernItemSchema = z.object({
  name: z.string().min(1).max(100),
  imageUrl: z.string().min(1),
  link: z.string().max(200).optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const TestimonialItemSchema = z.object({
  id: z.string().optional(),
  customerName: z.string().min(1).max(100),
  customerTitle: z.string().max(100).optional().or(z.literal('')),
  quote: z.string().min(1).max(500),
  rating: z.number().int().min(1).max(5),
  sortOrder: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

export const FooterColumnLinkSchema = z.object({
  label: z.string().min(1).max(50),
  href: z.string().min(1).max(200),
});

export const FooterColumnSchema = z.object({
  title: z.string().min(1).max(50),
  links: z.array(FooterColumnLinkSchema).default([]),
});

// ── Section Configs (validated) ─────────────────────────────────────────────
// Each section schema uses `.partial().passthrough()` so optional/unknown
// fields are preserved, while the shape of known fields is validated at save
// time — preventing malformed or misspelled section values from being stored.

export const HeroSectionSchema = z.object({
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
}).partial().passthrough();

export const ImageSliderItemSchema = z.object({
  imageUrl: z.string().min(1).optional(),
  alt: z.string().optional(),
  linkUrl: z.string().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
}).partial().passthrough();

export const ImageSliderSectionSchema = z.object({
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  images: z.array(ImageSliderItemSchema).default([]),
}).partial().passthrough();

export const BestSellingSectionSchema = z.object({
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  title: z.string().optional(),
  productCount: z.number().int().min(1).max(7).optional(),
  productIds: z.array(z.string()).default([]),
}).partial().passthrough();

export const InfoAdSectionSchema = z.object({
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  desktopImageUrl: z.string().optional(),
  mobileImageUrl: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  buttonText: z.string().optional(),
  buttonLink: z.string().optional(),
}).partial().passthrough();

export const CategoriesSectionSchema = z.object({
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  title: z.string().optional(),
  categoryIds: z.array(z.string()).default([]),
  categoryImages: z.record(z.string(), z.string()).optional(),
}).partial().passthrough();

export const LatestProductsSectionSchema = z.object({
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  title: z.string().optional(),
  productCount: z.number().int().min(1).max(7).optional(),
  productIds: z.array(z.string()).default([]),
}).partial().passthrough();

export const TestimonialsSectionSchema = z.object({
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  items: z.array(TestimonialItemSchema).default([]),
}).partial().passthrough();

export const StoreReferenceSectionSchema = z.object({
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  desktopImageUrl: z.string().optional(),
  mobileImageUrl: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  mapEmbedUrl: z.string().optional(),
}).partial().passthrough();

export const FooterSectionSchema = z.object({
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
}).partial().passthrough();

export const WebsiteSectionsSchema = z
  .object({
    hero: HeroSectionSchema,
    imageSlider: ImageSliderSectionSchema,
    bestSelling: BestSellingSectionSchema,
    infoAd: InfoAdSectionSchema,
    categories: CategoriesSectionSchema,
    latestProducts: LatestProductsSectionSchema,
    testimonials: TestimonialsSectionSchema,
    storeReference: StoreReferenceSectionSchema,
    footer: FooterSectionSchema,
  })
  .partial()
  .passthrough();

// ── Full Website Config ──────────────────────────────────────────────────────

export const WebsiteConfigSchema = z.object({
  // Branding
  siteName: z.string().max(100).nullable().optional().or(z.literal('')),
  tagline: z.string().max(200).nullable().optional().or(z.literal('')),
  logoUrl: z.string().max(500).nullable().optional().or(z.literal('')),
  faviconUrl: z.string().max(500).nullable().optional().or(z.literal('')),

  // Colors
  primaryColor: z.string().max(7).nullable().optional(),
  accentColor: z.string().max(7).nullable().optional(),
  bgColor: z.string().max(7).nullable().optional(),

  // Typography
  headingFontFamily: z.string().max(200).nullable().optional().or(z.literal('')),
  bodyFontFamily: z.string().max(200).nullable().optional().or(z.literal('')),
  headingColor: z.string().max(7).nullable().optional(),
  bodyColor: z.string().max(7).nullable().optional(),

  // SEO
  metaTitle: z.string().max(120).nullable().optional().or(z.literal('')),
  metaDescription: z.string().max(300).nullable().optional().or(z.literal('')),

  // Social Links
  socialLinks: WebsiteSocialLinksSchema.default({}),

  // Navigation
  navItems: z.array(WebsiteNavItemSchema).default([]),

  // Sections
  sections: WebsiteSectionsSchema.default({}),

  // Footer
  footerAbout: z.string().max(1000).nullable().optional().or(z.literal('')),
  footerColumns: z.array(FooterColumnSchema).default([]),

  // About Page
  aboutPageTitle: z.string().max(200).nullable().optional().or(z.literal('')),
  aboutPageSubtitle: z.string().max(500).nullable().optional().or(z.literal('')),
  aboutHeroImageUrl: z.string().max(500).nullable().optional().or(z.literal('')),
  aboutStoryTitle: z.string().max(200).nullable().optional().or(z.literal('')),
  aboutStoryContent: z.string().max(5000).nullable().optional().or(z.literal('')),
  aboutStoryImageUrl: z.string().max(500).nullable().optional().or(z.literal('')),
  aboutMissionTitle: z.string().max(200).nullable().optional().or(z.literal('')),
  aboutMissionContent: z.string().max(5000).nullable().optional().or(z.literal('')),
  aboutValuesSectionTitle: z.string().max(200).nullable().optional().or(z.literal('')),
  aboutValues: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(500),
      })
    )
    .nullable()
    .optional()
    .default([]),

  // Contact Page
  contactPageTitle: z.string().max(200).nullable().optional().or(z.literal('')),
  contactPageSubtitle: z.string().max(500).nullable().optional().or(z.literal('')),
  contactHeroImageUrl: z.string().max(500).nullable().optional().or(z.literal('')),
  contactInfoTitle: z.string().max(200).nullable().optional().or(z.literal('')),
  contactAddress: z.string().max(500).nullable().optional().or(z.literal('')),
  contactPhoneDisplay: z.string().max(200).nullable().optional().or(z.literal('')),
  contactEmailDisplay: z.string().max(200).nullable().optional().or(z.literal('')),
  contactBusinessHours: z.string().max(1000).nullable().optional().or(z.literal('')),
  contactMapEmbedUrl: z.string().max(1000).nullable().optional().or(z.literal('')),

  // Shop Page
  shopPageTitle: z.string().max(200).nullable().optional().or(z.literal('')),
  shopPageSubtitle: z.string().max(500).nullable().optional().or(z.literal('')),
  shopHeroImageUrl: z.string().max(500).nullable().optional().or(z.literal('')),
  shopPageDescription: z.string().max(1000).nullable().optional().or(z.literal('')),
  shopProductsPerPage: z.number().int().min(1).max(100).nullable().optional(),
});

export type WebsiteConfigInput = z.infer<typeof WebsiteConfigSchema>;
export type WebsiteHeroSlideInput = z.infer<typeof WebsiteHeroSlideSchema>;
export type WebsiteAdInput = z.infer<typeof WebsiteAdSchema>;
