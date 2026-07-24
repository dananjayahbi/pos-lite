// ── Customer-facing website type definitions ─────────────────────────────────

/** Social media links stored in WebsiteConfig.socialLinks */
export interface WebsiteSocialLinks {
  facebook?: string;
  instagram?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  tiktok?: string;
  youtube?: string;
}

/** Navigation menu item */
export interface WebsiteNavItem {
  label: string;
  href: string;
  children?: WebsiteNavItem[];
}

/** Hero slide configuration */
export interface WebsiteHeroSlideData {
  id?: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  mobileMediaUrl?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  ctaText?: string;
  ctaLink?: string;
  isActive: boolean;
  sortOrder: number;
}

// ── Section-specific configurations ──────────────────────────────────────────

/** Category grid section config */
export interface CategoriesSection {
  isActive: boolean;
  sortOrder: number;
  title?: string;
  /** Category IDs to display (empty = auto-select from store categories) */
  categoryIds: string[];
}

/** Solutions by concern section config */
export interface SolutionsByConcernSection {
  isActive: boolean;
  sortOrder: number;
  desktopImageUrl: string;
  mobileImageUrl?: string;
  link?: string;
}

/** Shop by concern carousel section config */
export interface ShopByConcernSection {
  isActive: boolean;
  sortOrder: number;
  title?: string;
  items: ShopByConcernItem[];
}

export interface ShopByConcernItem {
  name: string;
  imageUrl: string;
  link?: string;
  sortOrder: number;
}

/** Gift box split section config */
export interface GiftBoxSection {
  isActive: boolean;
  sortOrder: number;
  leftImageUrl: string;
  rightImageUrl: string;
  title?: string;
  subtitle?: string;
  link?: string;
}

/** Latest products section config */
export interface LatestProductsSection {
  isActive: boolean;
  sortOrder: number;
  title: string;
  /** Number of products to show (default 10) */
  productCount: number;
  /** Specific product variant IDs (empty = auto-select latest) */
  productVariantIds: string[];
}

/** Promotional banner section config */
export interface PromoBannerSection {
  isActive: boolean;
  sortOrder: number;
  desktopImageUrl: string;
  mobileImageUrl: string;
  link?: string;
}

/** Best selling products section config */
export interface BestSellingSection {
  isActive: boolean;
  sortOrder: number;
  title: string;
  /** Number of products to show (default 10) */
  productCount: number;
  /** Specific product variant IDs (empty = auto-select best selling) */
  productVariantIds: string[];
}

/** Testimonial */
export interface TestimonialItem {
  id?: string;
  customerName: string;
  customerTitle?: string;
  quote: string;
  rating: number;
  sortOrder: number;
  isActive: boolean;
}

/** Testimonials section config */
export interface TestimonialsSection {
  isActive: boolean;
  sortOrder: number;
  title: string;
  subtitle?: string;
  items: TestimonialItem[];
}

/** Stores banner section config */
export interface StoresBannerSection {
  isActive: boolean;
  sortOrder: number;
  desktopImageUrl: string;
  mobileImageUrl: string;
  link?: string;
}

/** Footer column menu link */
export interface FooterColumnLink {
  label: string;
  href: string;
}

/** Footer column */
export interface FooterColumn {
  title: string;
  links: FooterColumnLink[];
}

// ── Combined sections map ────────────────────────────────────────────────────

export type SectionKey =
  | 'hero'
  | 'categories'
  | 'solutionsByConcern'
  | 'shopByConcern'
  | 'giftBox'
  | 'latestProducts'
  | 'promoBanner'
  | 'bestSelling'
  | 'testimonials'
  | 'storesBanner'
  | 'footer';

export const DEFAULT_SECTION_ORDER: Record<SectionKey, number> = {
  hero: 1,
  categories: 2,
  solutionsByConcern: 3,
  shopByConcern: 4,
  giftBox: 5,
  latestProducts: 6,
  promoBanner: 7,
  bestSelling: 8,
  testimonials: 9,
  storesBanner: 10,
  footer: 11,
};

/** Full website configuration */
export interface WebsiteConfigData {
  id?: string;
  tenantId?: string;

  // Branding
  siteName?: string;
  tagline?: string;
  logoUrl?: string;
  faviconUrl?: string;

  // Colors
  primaryColor?: string;
  accentColor?: string;
  bgColor?: string;

  // SEO
  metaTitle?: string;
  metaDescription?: string;

  // Social
  socialLinks: WebsiteSocialLinks;

  // Navigation
  navItems: WebsiteNavItem[];

  // Sections
  sections: Partial<Record<SectionKey, Record<string, unknown>>>;

  // Footer
  footerAbout?: string;
  footerColumns: FooterColumn[];

  // About page
  aboutPageTitle?: string;
  aboutPageSubtitle?: string;
  aboutHeroImageUrl?: string;
  aboutStoryTitle?: string;
  aboutStoryContent?: string;
  aboutStoryImageUrl?: string;
  aboutMissionTitle?: string;
  aboutMissionContent?: string;
  aboutValuesSectionTitle?: string;
  aboutValues?: { title: string; description: string }[];

  // Contact page
  contactPageTitle?: string;
  contactPageSubtitle?: string;
  contactHeroImageUrl?: string;
  contactInfoTitle?: string;
  contactAddress?: string;
  contactPhoneDisplay?: string;
  contactEmailDisplay?: string;
  contactBusinessHours?: string;
  contactMapEmbedUrl?: string;

  // Related data
  heroSlides?: WebsiteHeroSlideData[];
  ads?: WebsiteAdData[];
}

/** Advertisement */
export interface WebsiteAdData {
  id?: string;
  name: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  mobileMediaUrl?: string;
  targetUrl?: string;
  position: 'header' | 'between_sections' | 'sidebar' | 'popup';
  displayAfterSection?: string;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
}
