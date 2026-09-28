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

/**
 * Site-wide announcement top-bar (req 3.4) — `WebsiteConfig.announcementBar`.
 * Serialized from the ERP; absent on configs stored before the field existed.
 */
export interface WebsiteAnnouncementBarData {
  text?: string;
  link?: string;
  isActive?: boolean;
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

/** Social links for the hero right vertical dock (common to all slides). */
export interface WebsiteHeroSocialLinks {
  twitter?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  whatsapp?: string;
}

/**
 * Hero section config — shared across ALL slides (as opposed to `heroSlides`,
 * which are per-slide). Holds the editorial controls for the hero layout:
 * the "Consult Doctor" outline button, the "Crafted by ..." line, and the
 * social links in the right vertical dock.
 */
export interface WebsiteHeroSection {
  isActive: boolean;
  sortOrder: number;
  /** Show/hide the "Consult Doctor" outline button. */
  showConsultDoctor?: boolean;
  /** Button label, e.g. "Consult Doctor". Empty -> hidden. */
  consultDoctorLabel?: string;
  /** Target link for the button. Defaults to the appointments page. */
  consultDoctorLink?: string;
  /** Show/hide the "Crafted by ..." line. */
  showCraftedBy?: boolean;
  /** The crafted-by text, e.g. "Crafted by Wedagedara Herbal Sanctuary". */
  craftedByText?: string;
  /** Show/hide the vertical social dock. */
  showSocialLinks?: boolean;
  /** Vertical-dock social links (only entries with a URL render). */
  socialLinks?: WebsiteHeroSocialLinks;
}

/** Category grid section config */
export interface CategoriesSection {
  isActive: boolean;
  sortOrder: number;
  /** Eyebrow label above the heading (e.g. "CURATED AYURVEDIC LINEUP"). */
  label?: string;
  title?: string;
  /** Category IDs to display (max 5, empty = auto-select from store categories) */
  categoryIds: string[];
  /** Optional override images per category: { [categoryId]: imageUrl } */
  categoryImages?: Record<string, string>;
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
  /** Eyebrow label above the heading (e.g. "NEW HERBAL ARRIVALS"). */
  label?: string;
  title: string;
  /** Number of products to show (max 7, default 7) */
  productCount: number;
  /** Specific product IDs to display (max 7; empty = auto-select latest) */
  productIds: string[];
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
  /** Eyebrow label above the heading (e.g. "MOST LOVED BOTANICAL REMEDIES"). */
  label?: string;
  title: string;
  /** Number of products to show (max 7, default 7) */
  productCount: number;
  /** Specific product IDs to display (max 7; empty = auto-select best selling) */
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
  /** Eyebrow label above the heading (e.g. "VOICES OF HEALING"). */
  label?: string;
  title: string;
  subtitle?: string;
  items: TestimonialItem[];
}

/**
 * Image slider section config (Section 02) — "AUTHENTIC AYURVEDIC CARE".
 *
 * Rendered as a curated "Featured products" carousel of up to 7 products.
 * The eyebrow / heading / subtitle texts are configurable, and the cards are
 * selected from real products (like the Top Selling section) rather than
 * raw images.
 */
export interface ImageSliderSection {
  isActive: boolean;
  sortOrder: number;
  /** Eyebrow label above the heading (e.g. "AUTHENTIC AYURVEDIC CARE"). */
  label?: string;
  /** Section heading (e.g. "CURATED BOTANICAL COLLECTIONS"). */
  title?: string;
  /** Muted description under the heading. */
  subtitle?: string;
  /** Number of featured products to show (max 7, default 7). */
  productCount?: number;
  /** Specific featured product IDs (max 7; empty = auto-select latest). */
  productIds?: string[];
  /** @deprecated Image URLs — superseded by product selection. */
  images?: ImageSliderItem[];
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

/** Stores banner section config (deprecated, replaced by storeReference) */
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
  | 'footer';

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

  // Site-wide announcement top-bar (req 3.4)
  announcementBar?: WebsiteAnnouncementBarData;

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
  /** Label for the phone CTA button in the "Connect With Us" section. */
  aboutPhoneLabel?: string;
  /** Phone number for the CTA button in the "Connect With Us" section. */
  aboutPhoneNumber?: string;

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

// ── Public-facing product/category DTOs (returned by ERP API) ───────────────

/** Minimal product representation for the storefront. */
export interface PublicProductVariant {
  id: string;
  sku: string;
  /** Product type / form, e.g. Powder, Capsule, Tablet, Oil. */
  form?: string;
  retailPrice: number;
  imageUrls: string[];
  stockQuantity: number;
  productId: string;
}

export interface PublicProduct {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  categoryId?: string;
  brandId?: string;
  tags: string[];
  /** Curated wellness concerns (HealthConcern enum values). */
  healthConcerns: string[];
  mainImageUrl?: string;
  activeIngredients?: string;
  usageInstructions?: string;
  healthBenefits?: string;
  safetyPrecautions?: string;
  primaryVariant?: PublicProductVariant;
  variants: PublicProductVariant[];
}

/** A health-concern filter option (value + display label). */
export interface PublicConcern {
  value: string;
  label: string;
}

/** Filter options returned by the shop-filters endpoint. */
export interface PublicShopFilters {
  concerns: PublicConcern[];
  forms: string[];
}

// ── Public order tracking (returned by /track) ─────────────────────────────

export interface PublicTrackingStage {
  key: string;
  label: string;
  stage: number;
}

export interface PublicTrackingStatus {
  label: string;
  isTerminal: boolean;
  isFailure: boolean;
  stage: PublicTrackingStage;
}

export interface PublicTrackingEvent {
  id: string;
  stage: string;
  label: string;
  remarks?: string | null;
  isCurrent: boolean;
  timestamp: string;
}

export interface PublicTrackingOrder {
  orderRef: string;
  status: PublicTrackingStatus;
  payment: string;
  placedAt?: string | null;
  deliveredAt?: string | null;
  events: PublicTrackingEvent[];
}

export interface PublicTrackingResponse {
  orders: PublicTrackingOrder[];
}

export interface PublicCategory {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  productCount?: number;
  sortOrder: number;
}

export interface PublicBrand {
  id: string;
  name: string;
  logoUrl?: string;
}

export interface PublicTenantInfo {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string;
}