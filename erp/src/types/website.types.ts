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
  /** Category IDs to display (max 5, empty = auto-select from store categories) */
  categoryIds: string[];
  /** Optional override images per category: { [categoryId]: imageUrl } */
  categoryImages?: Record<string, string>;
}

/** Image slider section config (Section 02) — up to 7 configurable images */
export interface ImageSliderSection {
  isActive: boolean;
  sortOrder: number;
  /** Up to 7 image URLs for the slider */
  images: ImageSliderItem[];
}

export interface ImageSliderItem {
  imageUrl: string;
  alt?: string;
  linkUrl?: string;
  sortOrder: number;
  isActive: boolean;
}

/** Info/advertisement section config (Section 04) — 2-column info block */
export interface InfoAdSection {
  isActive: boolean;
  sortOrder: number;
  desktopImageUrl: string;
  mobileImageUrl?: string;
  title: string;
  subtitle: string;
  buttonText?: string;
  buttonLink?: string;
}

/** Store reference section config (Section 08) — store image + details */
export interface StoreReferenceSection {
  isActive: boolean;
  sortOrder: number;
  desktopImageUrl: string;
  mobileImageUrl?: string;
  title: string;
  subtitle: string;
  addressLine1?: string;
  addressLine2?: string;
  mapEmbedUrl?: string;
}

/** Latest products section config */
export interface LatestProductsSection {
  isActive: boolean;
  sortOrder: number;
  title: string;
  /** Number of products to show (max 7, default 7) */
  productCount: number;
  /** Specific product IDs (max 7, empty = auto-select latest) */
  productIds: string[];
}

/** Best selling products section config */
export interface BestSellingSection {
  isActive: boolean;
  sortOrder: number;
  title: string;
  /** Number of products to show (max 7, default 7) */
  productCount: number;
  /** Specific product IDs (max 7, empty = auto-select best selling) */
  productIds: string[];
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

// ── Appointments (Channelling) ───────────────────────────────────────────────

/** Config for the customer-facing "Appointments" booking page. */
export interface WebsiteAppointmentsConfig {
  /** Whether the Appointments booking page appears in the website nav + is public. */
  enabled: boolean;
  /** Nav label shown in the header menu (e.g. "Book a Channeling"). */
  navLabel: string;
  /** Hero/heading title shown on the booking page. */
  title: string;
  /** Subtitle shown under the title. */
  subtitle: string;
  /** Optional hero image URL for the booking page. */
  heroImageUrl?: string;
  /** Appointment service IDs offered to customers. Empty = show all active services. */
  serviceIds: string[];
  /** Short helper blurb shown above the booking form. */
  intro?: string;
}

/** Footer column */
export interface FooterColumn {
  title: string;
  links: FooterColumnLink[];
}

// ── Deprecated sections (kept for ERP WebsiteShell preview compat) ──────────

/** @deprecated Use ImageSliderSection or InfoAdSection */
export interface SolutionsByConcernSection {
  isActive: boolean;
  sortOrder: number;
  desktopImageUrl: string;
  mobileImageUrl?: string;
  link?: string;
}

/** @deprecated Use CategoriesSection */
export interface ShopByConcernSection {
  isActive: boolean;
  sortOrder: number;
  title?: string;
  items: ShopByConcernItem[];
}

/** @deprecated Use CategoriesSection */
export interface ShopByConcernItem {
  name: string;
  imageUrl: string;
  link?: string;
  sortOrder: number;
}

/** @deprecated */
export interface GiftBoxSection {
  isActive: boolean;
  sortOrder: number;
  leftImageUrl: string;
  rightImageUrl: string;
  title?: string;
  subtitle?: string;
  link?: string;
}

/** @deprecated Use InfoAdSection */
export interface PromoBannerSection {
  isActive: boolean;
  sortOrder: number;
  desktopImageUrl: string;
  mobileImageUrl: string;
  link?: string;
}

// ── Combined sections map ────────────────────────────────────────────────────

export type SectionKey =
  | 'hero'
  | 'imageSlider'
  | 'bestSelling'
  | 'infoAd'
  | 'categories'
  | 'latestProducts'
  | 'testimonials'
  | 'storeReference'
  | 'footer'
  // Deprecated — kept for backward compat with ERP preview shell
  | 'solutionsByConcern'
  | 'shopByConcern'
  | 'giftBox'
  | 'promoBanner'
  | 'storesBanner';

export const DEFAULT_SECTION_ORDER: Record<SectionKey, number> = {
  hero: 1,
  imageSlider: 2,
  bestSelling: 3,
  infoAd: 4,
  categories: 5,
  latestProducts: 6,
  testimonials: 7,
  storeReference: 8,
  footer: 9,
  // Deprecated defaults
  solutionsByConcern: 99,
  shopByConcern: 99,
  giftBox: 99,
  promoBanner: 99,
  storesBanner: 99,
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

  // Typography
  headingFontFamily?: string;
  bodyFontFamily?: string;
  headingColor?: string;
  bodyColor?: string;

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

  // Appointments (customer-facing booking page)
  appointments?: WebsiteAppointmentsConfig;

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

  // Shop page
  shopPageTitle?: string;
  shopPageSubtitle?: string;
  shopHeroImageUrl?: string;
  shopPageDescription?: string;
  shopProductsPerPage?: number;

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
