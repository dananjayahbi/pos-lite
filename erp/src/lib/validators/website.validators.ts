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

  // SEO
  metaTitle: z.string().max(120).nullable().optional().or(z.literal('')),
  metaDescription: z.string().max(300).nullable().optional().or(z.literal('')),

  // Social Links
  socialLinks: WebsiteSocialLinksSchema.default({}),

  // Navigation
  navItems: z.array(WebsiteNavItemSchema).default([]),

  // Sections
  sections: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),

  // Footer
  footerAbout: z.string().max(1000).nullable().optional().or(z.literal('')),
  footerColumns: z.array(FooterColumnSchema).default([]),
});

// ── Zod inferred types ──────────────────────────────────────────────────────

export type WebsiteConfigInput = z.infer<typeof WebsiteConfigSchema>;
export type WebsiteHeroSlideInput = z.infer<typeof WebsiteHeroSlideSchema>;
export type WebsiteAdInput = z.infer<typeof WebsiteAdSchema>;
