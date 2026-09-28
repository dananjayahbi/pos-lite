'use client';

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DeferredMediaUploader } from '@/components/shared/DeferredMediaUploader';
import { CategoryPicker } from '@/components/settings/website-tabs/CategoryPicker';
import { ProductPicker } from '@/components/settings/website-tabs/ProductPicker';
import { toast } from 'sonner';
import type {
  WebsiteConfigData,
  WebsiteHeroSlideData,
  WebsiteHeroSection,
  ImageSliderSection,
  BestSellingSection,
  InfoAdSection,
  CategoriesSection,
  LatestProductsSection,
  TestimonialsSection,
  TestimonialItem,
  StoreReferenceSection,
  SectionKey,
} from '@/types/website.types';
import { DEFAULT_SECTION_ORDER } from '@/types/website.types';

interface LandingPageTabProps {
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

function updateSection(
  config: WebsiteConfigData,
  key: string,
  updates: Record<string, unknown>,
): Partial<WebsiteConfigData> {
  const sections = { ...(config.sections ?? {}) } as Record<string, Record<string, unknown>>;
  const existing = (sections[key] as Record<string, unknown> | undefined) ?? {
    isActive: true,
    sortOrder: DEFAULT_SECTION_ORDER[key as SectionKey] ?? 99,
  };
  sections[key] = { ...existing, ...updates };
  return { sections: sections as Partial<Record<SectionKey, Record<string, unknown>>> };
}

// ── Module-level section chrome (extracted to prevent focus loss) ────────────

interface SectionHeaderProps {
  sectionKey: string;
  title: string;
  description: string;
  expandedSections: Record<string, boolean>;
  onToggle: (key: string) => void;
}

function SectionHeader({
  sectionKey,
  title,
  description,
  expandedSections,
  onToggle,
}: SectionHeaderProps) {
  const isExpanded = expandedSections[sectionKey] ?? true;
  return (
    <div
      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-cream/30"
      onClick={() => onToggle(sectionKey)}
    >
      <div>
        <h3 className="text-sm font-semibold text-espresso">{title}</h3>
        <p className="mt-0.5 text-xs text-sand">{description}</p>
      </div>
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 shrink-0 text-sand" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-sand" />
      )}
    </div>
  );
}

interface SectionBodyProps {
  sectionKey: string;
  children: React.ReactNode;
  expandedSections: Record<string, boolean>;
}

function SectionBody({
  sectionKey,
  children,
  expandedSections,
}: SectionBodyProps) {
  const isExpanded = expandedSections[sectionKey] ?? true;
  if (!isExpanded) return null;
  return <div className="px-4 pb-4 pt-0 space-y-3">{children}</div>;
}

export function LandingPageTab({ config, onChange }: LandingPageTabProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    hero: true,
    imageSlider: true,
    bestSelling: true,
    infoAd: true,
    categories: true,
    latestProducts: true,
    testimonials: true,
    storeReference: true,
  });

  const [removedSlideIds, setRemovedSlideIds] = useState<string[]>([]);

  function toggleSection(key: string) {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // ---------------------------------------------------------------------------
  // 1. Hero Banner
  // ---------------------------------------------------------------------------
  const heroSlides: WebsiteHeroSlideData[] = config.heroSlides ?? [];

  // Common hero editorial settings (shared across all slides).
  const heroSection = (config.sections?.hero ?? {}) as Partial<WebsiteHeroSection>;

  function handleHeroSectionChange(
    field: keyof WebsiteHeroSection,
    value: unknown,
  ) {
    onChange(updateSection(config, 'hero', { [field]: value }));
  }

  function handleHeroSectionSocialChange(
    field: string,
    value: string,
  ) {
    const currentSocial = heroSection.socialLinks ?? {};
    onChange(
      updateSection(config, 'hero', {
        socialLinks: { ...currentSocial, [field]: value },
      }),
    );
  }

  function handleHeroSlideChange(
    index: number,
    field: keyof WebsiteHeroSlideData,
    value: unknown,
  ) {
    const updated = heroSlides.map((slide, i) =>
      i === index ? { ...slide, [field]: value } : slide,
    );
    const payload: Partial<WebsiteConfigData> = { heroSlides: updated };
    if (removedSlideIds.length > 0) {
      (payload as Record<string, unknown>).removedSlideIds = removedSlideIds;
    }
    onChange(payload);
  }

  function handleDeleteHeroSlide(index: number) {
    const slide = heroSlides[index]!;
    const updated = heroSlides.filter((_, i) => i !== index);
    const payload: Partial<WebsiteConfigData> = { heroSlides: updated };
    if (slide.id) {
      const newRemovedIds = [...removedSlideIds, slide.id];
      setRemovedSlideIds(newRemovedIds);
      (payload as Record<string, unknown>).removedSlideIds = newRemovedIds;
    } else if (removedSlideIds.length > 0) {
      (payload as Record<string, unknown>).removedSlideIds = removedSlideIds;
    }
    onChange(payload);
  }

  function handleAddHeroSlide() {
    const newSlide: WebsiteHeroSlideData = {
      mediaType: 'image',
      mediaUrl: '',
      mobileMediaUrl: '',
      title: '',
      subtitle: '',
      description: '',
      ctaText: '',
      ctaLink: '',
      isActive: true,
      sortOrder: heroSlides.length,
    };
    const payload: Partial<WebsiteConfigData> = {
      heroSlides: [...heroSlides, newSlide],
    };
    if (removedSlideIds.length > 0) {
      (payload as Record<string, unknown>).removedSlideIds = removedSlideIds;
    }
    onChange(payload);
  }

  // ---------------------------------------------------------------------------
  // 2. Image Slider — "Featured products" (AUTHENTIC AYURVEDIC CARE)
  // ---------------------------------------------------------------------------
  const imageSliderSection = config.sections?.imageSlider as ImageSliderSection | undefined;
  const MAX_IMAGE_SLIDER_ITEMS = 7;

  function handleImageSliderChange(field: keyof ImageSliderSection, value: unknown) {
    onChange(updateSection(config, 'imageSlider', { [field]: value }));
  }

  function handleImageSliderProductCount(value: string) {
    const val = Math.min(7, Math.max(1, Number(value) || 1));
    handleImageSliderChange('productCount', val);
  }

  // ---------------------------------------------------------------------------
  // 3. Top Selling
  // ---------------------------------------------------------------------------
  const bestSellingSection = config.sections?.bestSelling as BestSellingSection | undefined;

  function handleBestSellingChange(field: keyof BestSellingSection, value: unknown) {
    onChange(updateSection(config, 'bestSelling', { [field]: value }));
  }

  // ---------------------------------------------------------------------------
  // 4. Info Ad
  // ---------------------------------------------------------------------------
  const infoAdSection = config.sections?.infoAd as InfoAdSection | undefined;

  function handleInfoAdChange(field: keyof InfoAdSection, value: unknown) {
    onChange(updateSection(config, 'infoAd', { [field]: value }));
  }

  // ---------------------------------------------------------------------------
  // 5. Categories
  // ---------------------------------------------------------------------------
  const categoriesSection = config.sections?.categories as CategoriesSection | undefined;

  function handleCategoriesChange(field: keyof CategoriesSection, value: unknown) {
    onChange(updateSection(config, 'categories', { [field]: value }));
  }

  // ---------------------------------------------------------------------------
  // 6. Latest Products
  // ---------------------------------------------------------------------------
  const latestProductsSection = config.sections?.latestProducts as LatestProductsSection | undefined;

  function handleLatestProductsChange(field: keyof LatestProductsSection, value: unknown) {
    onChange(updateSection(config, 'latestProducts', { [field]: value }));
  }

  // ---------------------------------------------------------------------------
  // 7. Testimonials
  // ---------------------------------------------------------------------------
  const testimonialsSection = config.sections?.testimonials as TestimonialsSection | undefined;
  const testimonialItems: TestimonialItem[] = testimonialsSection?.items ?? [];
  const MAX_TESTIMONIALS = 3;

  function handleTestimonialChange(
    index: number,
    field: keyof TestimonialItem,
    value: unknown,
  ) {
    const updated = testimonialItems.map((item, i) =>
      i === index ? { ...item, [field]: value } : item,
    );
    onChange(updateSection(config, 'testimonials', { items: updated }));
  }

  function handleDeleteTestimonial(index: number) {
    const updated = testimonialItems.filter((_, i) => i !== index);
    onChange(updateSection(config, 'testimonials', { items: updated }));
  }

  function handleAddTestimonial() {
    if (testimonialItems.length >= MAX_TESTIMONIALS) {
      toast.info(`Maximum of ${MAX_TESTIMONIALS} testimonials allowed.`);
      return;
    }
    const newItem: TestimonialItem = {
      customerName: '',
      customerTitle: '',
      quote: '',
      rating: 5,
      sortOrder: testimonialItems.length,
      isActive: true,
    };
    onChange(
      updateSection(config, 'testimonials', { items: [...testimonialItems, newItem] }),
    );
  }

  // ---------------------------------------------------------------------------
  // 8. Store Reference
  // ---------------------------------------------------------------------------
  const storeRefSection = config.sections?.storeReference as StoreReferenceSection | undefined;

  function handleStoreRefChange(field: keyof StoreReferenceSection, value: unknown) {
    onChange(updateSection(config, 'storeReference', { [field]: value }));
  }

  // ===========================================================================
  // RENDER
  // ===========================================================================
  // NOTE: SectionHeader and SectionBody are defined at module level below

  return (
    <div className="space-y-3">
      {/* ================================================================ */}
      {/* 1. Hero Banner                                                    */}
      {/* ================================================================ */}
      <div className="border border-mist rounded-lg bg-white overflow-hidden mb-3">
        <SectionHeader
          sectionKey="hero"
          title="Hero Banner"
          description="Full-width hero section with image or video. First active slide is displayed."
          expandedSections={expandedSections}
          onToggle={toggleSection}
        />

        <SectionBody sectionKey="hero" expandedSections={expandedSections}>
          {heroSlides.length === 0 ? (
            <p className="text-xs text-sand italic">No hero slides configured.</p>
          ) : (
            <div className="space-y-4">
              {heroSlides.map((slide, index) => (
                <div
                  key={index}
                  className="border border-mist rounded-lg bg-white p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-espresso">
                      Slide {index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-sand hover:text-red-500"
                      onClick={() => handleDeleteHeroSlide(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Media Type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-sand">Media Type</Label>
                    <Select
                      value={slide.mediaType ?? 'image'}
                      onValueChange={(val) =>
                        handleHeroSlideChange(index, 'mediaType', val)
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Desktop Media */}
                  <div>
                    <DeferredMediaUploader
                      uploadKey={`hero_media_${index}`}
                      accept={slide.mediaType === 'video' ? 'video/*' : 'image/*'}
                      maxSizeMB={slide.mediaType === 'video' ? 20 : 5}
                      label="Media"
                      placeholder={
                        slide.mediaType === 'video'
                          ? 'Upload video (MP4 recommended)'
                          : 'Upload image (PNG/WebP recommended)'
                      }
                      previewHeight="h-32"
                      value={slide.mediaUrl ?? ''}
                      currentRealUrl={slide.mediaUrl || undefined}
                      onChange={(url: string) =>
                        handleHeroSlideChange(index, 'mediaUrl', url)
                      }
                    />
                  </div>

                  {/* Mobile Media */}
                  <div>
                    <DeferredMediaUploader
                      uploadKey={`hero_mobile_media_${index}`}
                      accept="image/*"
                      maxSizeMB={5}
                      label="Mobile Media (optional)"
                      placeholder="Upload mobile-specific image"
                      previewHeight="h-20"
                      value={slide.mobileMediaUrl ?? ''}
                      currentRealUrl={slide.mobileMediaUrl || undefined}
                      onChange={(url: string) =>
                        handleHeroSlideChange(index, 'mobileMediaUrl', url)
                      }
                    />
                  </div>

                  {/* Title */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-sand">Title</Label>
                    <Input
                      value={slide.title ?? ''}
                      onChange={(e) =>
                        handleHeroSlideChange(index, 'title', e.target.value)
                      }
                      placeholder="Hero title"
                      className="h-9 text-sm"
                    />
                  </div>

                  {/* Subtitle */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-sand">Subtitle</Label>
                    <Input
                      value={slide.subtitle ?? ''}
                      onChange={(e) =>
                        handleHeroSlideChange(index, 'subtitle', e.target.value)
                      }
                      placeholder="Hero subtitle"
                      className="h-9 text-sm"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-sand">Description</Label>
                    <Textarea
                      value={slide.description ?? ''}
                      onChange={(e) =>
                        handleHeroSlideChange(index, 'description', e.target.value)
                      }
                      placeholder="Hero description text"
                      className="text-sm"
                      rows={2}
                    />
                  </div>

                  {/* CTA */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-sand">CTA Text</Label>
                      <Input
                        value={slide.ctaText ?? ''}
                        onChange={(e) =>
                          handleHeroSlideChange(index, 'ctaText', e.target.value)
                        }
                        placeholder="e.g. Shop Now"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-sand">CTA Link</Label>
                      <Input
                        value={slide.ctaLink ?? ''}
                        onChange={(e) =>
                          handleHeroSlideChange(index, 'ctaLink', e.target.value)
                        }
                        placeholder="e.g. /shop"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={slide.isActive ?? true}
                      onCheckedChange={(checked) =>
                        handleHeroSlideChange(index, 'isActive', checked)
                      }
                    />
                    <Label className="text-xs text-sand cursor-pointer">Active</Label>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="border-dashed border-mist text-sand hover:text-espresso"
            onClick={handleAddHeroSlide}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Slide
          </Button>

          {/* ── Hero common settings (shared across all slides) ─────────────── */}
          <div className="border border-mist/70 rounded-lg bg-cream/20 p-4 mt-2 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-sand">
              Hero Settings
            </p>

            {/* Consult Doctor button */}
            <div className="space-y-1.5">
              <Label className="text-xs text-sand">Consult Doctor Button</Label>
              <div className="flex items-center gap-3">
                <Switch
                  checked={heroSection.showConsultDoctor ?? true}
                  onCheckedChange={(checked) =>
                    handleHeroSectionChange('showConsultDoctor', checked)
                  }
                />
                <span className="text-xs text-sand">Show button</span>
              </div>
              <Input
                value={heroSection.consultDoctorLabel ?? ''}
                onChange={(e) =>
                  handleHeroSectionChange('consultDoctorLabel', e.target.value)
                }
                placeholder="Button label, e.g. Consult Doctor"
                className="h-9 text-sm"
              />
              <Input
                value={heroSection.consultDoctorLink ?? ''}
                onChange={(e) =>
                  handleHeroSectionChange('consultDoctorLink', e.target.value)
                }
                placeholder="Button link (leave empty for appointments page)"
                className="h-9 text-sm"
              />
            </div>

            {/* Crafted By line */}
            <div className="space-y-1.5">
              <Label className="text-xs text-sand">Crafted By Text</Label>
              <div className="flex items-center gap-3">
                <Switch
                  checked={heroSection.showCraftedBy ?? true}
                  onCheckedChange={(checked) =>
                    handleHeroSectionChange('showCraftedBy', checked)
                  }
                />
                <span className="text-xs text-sand">Show text</span>
              </div>
              <Input
                value={heroSection.craftedByText ?? ''}
                onChange={(e) =>
                  handleHeroSectionChange('craftedByText', e.target.value)
                }
                placeholder="e.g. Crafted by Wedagedara Herbal Sanctuary"
                className="h-9 text-sm"
              />
            </div>

            {/* Social links (right vertical dock) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-sand">Social Links (Hero Sidebar)</Label>
              <div className="flex items-center gap-3">
                <Switch
                  checked={heroSection.showSocialLinks ?? true}
                  onCheckedChange={(checked) =>
                    handleHeroSectionChange('showSocialLinks', checked)
                  }
                />
                <span className="text-xs text-sand">Show sidebar icons</span>
              </div>
              <p className="text-[11px] text-sand/80">
                Only the links below appear in the hero sidebar. Leave empty to hide an icon.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  value={heroSection.socialLinks?.twitter ?? ''}
                  onChange={(e) =>
                    handleHeroSectionSocialChange('twitter', e.target.value)
                  }
                  placeholder="Twitter URL"
                  className="h-9 text-sm"
                />
                <Input
                  value={heroSection.socialLinks?.facebook ?? ''}
                  onChange={(e) =>
                    handleHeroSectionSocialChange('facebook', e.target.value)
                  }
                  placeholder="Facebook URL"
                  className="h-9 text-sm"
                />
                <Input
                  value={heroSection.socialLinks?.instagram ?? ''}
                  onChange={(e) =>
                    handleHeroSectionSocialChange('instagram', e.target.value)
                  }
                  placeholder="Instagram URL"
                  className="h-9 text-sm"
                />
                <Input
                  value={heroSection.socialLinks?.youtube ?? ''}
                  onChange={(e) =>
                    handleHeroSectionSocialChange('youtube', e.target.value)
                  }
                  placeholder="YouTube URL"
                  className="h-9 text-sm"
                />
                <Input
                  value={heroSection.socialLinks?.whatsapp ?? ''}
                  onChange={(e) =>
                    handleHeroSectionSocialChange('whatsapp', e.target.value)
                  }
                  placeholder="WhatsApp number"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>
        </SectionBody>
      </div>

      {/* ================================================================ */}
      {/* 2. Image Slider                                                   */}
      {/* ================================================================ */}
      <div className="border border-mist rounded-lg bg-white overflow-hidden mb-3">
        <SectionHeader
          sectionKey="imageSlider"
          title="Image Slider (Featured Products)"
          description="Curated featured-products carousel. Up to 7 products. Section label: 'AUTHENTIC AYURVEDIC CARE'."
          expandedSections={expandedSections}
          onToggle={toggleSection}
        />

        <SectionBody sectionKey="imageSlider" expandedSections={expandedSections}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sand">Eyebrow Label</Label>
              <Input
                value={imageSliderSection?.label ?? 'AUTHENTIC AYURVEDIC CARE'}
                onChange={(e) => handleImageSliderChange('label', e.target.value)}
                placeholder="AUTHENTIC AYURVEDIC CARE"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-sand">Section Title</Label>
              <Input
                value={imageSliderSection?.title ?? 'CURATED BOTANICAL COLLECTIONS'}
                onChange={(e) => handleImageSliderChange('title', e.target.value)}
                placeholder="CURATED BOTANICAL COLLECTIONS"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-sand">Subtitle</Label>
              <Textarea
                value={imageSliderSection?.subtitle ?? ''}
                onChange={(e) => handleImageSliderChange('subtitle', e.target.value)}
                placeholder="Handcrafted formulas extracted from Ceylon medicinal herbs…"
                className="text-sm"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-sand">Product Count (max 7)</Label>
              <Input
                type="number"
                min={1}
                max={7}
                value={imageSliderSection?.productCount ?? 7}
                onChange={(e) => handleImageSliderProductCount(e.target.value)}
                className="h-9 text-sm w-24"
              />
            </div>

            <div className="pt-1">
              <ProductPicker
                selectedIds={imageSliderSection?.productIds ?? []}
                onChange={(ids) => handleImageSliderChange('productIds', ids)}
                max={7}
              />
            </div>
          </div>
        </SectionBody>
      </div>

      {/* ================================================================ */}
      {/* 3. Top Selling                                                    */}
      {/* ================================================================ */}
      <div className="border border-mist rounded-lg bg-white overflow-hidden mb-3">
        <SectionHeader
          sectionKey="bestSelling"
          title="Top Selling Items"
          description="Horizontal product slider. Displays up to 7 products. Eyebrow label: 'MOST LOVED BOTANICAL REMEDIES'."
          expandedSections={expandedSections}
          onToggle={toggleSection}
        />

        <SectionBody sectionKey="bestSelling" expandedSections={expandedSections}>
          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Eyebrow Label</Label>
            <Input
              value={bestSellingSection?.label ?? 'MOST LOVED BOTANICAL REMEDIES'}
              onChange={(e) => handleBestSellingChange('label', e.target.value)}
              placeholder="MOST LOVED BOTANICAL REMEDIES"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Section Title</Label>
            <Input
              value={bestSellingSection?.title ?? 'Top Selling Items This Week'}
              onChange={(e) => handleBestSellingChange('title', e.target.value)}
              placeholder="Top Selling Items This Week"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Product Count (max 7)</Label>
            <Input
              type="number"
              min={1}
              max={7}
              value={bestSellingSection?.productCount ?? 7}
              onChange={(e) => {
                const val = Math.min(7, Math.max(1, Number(e.target.value) || 1));
                handleBestSellingChange('productCount', val);
              }}
              className="h-9 text-sm w-24"
            />
          </div>

          <div className="pt-1">
            <ProductPicker
              selectedIds={bestSellingSection?.productIds ?? []}
              onChange={(ids) =>
                onChange(
                  updateSection(config, 'bestSelling', { productIds: ids }),
                )
              }
              max={7}
            />
          </div>
        </SectionBody>
      </div>

      {/* ================================================================ */}
      {/* 4. Info Ad                                                        */}
      {/* ================================================================ */}
      <div className="border border-mist rounded-lg bg-white overflow-hidden mb-3">
        <SectionHeader
          sectionKey="infoAd"
          title="Info Ad (Section 04)"
          description="Two-column info/ad block. Left: image. Right: title + subtitle + button. Mobile: stacks vertically. Max height 950px."
          expandedSections={expandedSections}
          onToggle={toggleSection}
        />

        <SectionBody sectionKey="infoAd" expandedSections={expandedSections}>
          <div>
            <DeferredMediaUploader
              uploadKey="infoAd_desktop"
              accept="image/*"
              maxSizeMB={5}
              label="Desktop Image"
              placeholder="Upload desktop image"
              previewHeight="h-40"
              value={infoAdSection?.desktopImageUrl ?? ''}
              currentRealUrl={infoAdSection?.desktopImageUrl || undefined}
              onChange={(url: string) => handleInfoAdChange('desktopImageUrl', url)}
            />
          </div>

          <div>
            <DeferredMediaUploader
              uploadKey="infoAd_mobile"
              accept="image/*"
              maxSizeMB={5}
              label="Mobile Image (optional)"
              placeholder="Upload mobile-specific image"
              previewHeight="h-20"
              value={infoAdSection?.mobileImageUrl ?? ''}
              currentRealUrl={infoAdSection?.mobileImageUrl || undefined}
              onChange={(url: string) => handleInfoAdChange('mobileImageUrl', url)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Title</Label>
            <Input
              value={infoAdSection?.title ?? ''}
              onChange={(e) => handleInfoAdChange('title', e.target.value)}
              placeholder="Info ad title"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Subtitle</Label>
            <Textarea
              value={infoAdSection?.subtitle ?? ''}
              onChange={(e) => handleInfoAdChange('subtitle', e.target.value)}
              placeholder="Info ad subtitle"
              className="text-sm"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sand">Button Text</Label>
              <Input
                value={infoAdSection?.buttonText ?? ''}
                onChange={(e) => handleInfoAdChange('buttonText', e.target.value)}
                placeholder="e.g. Learn More"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sand">Button Link</Label>
              <Input
                value={infoAdSection?.buttonLink ?? ''}
                onChange={(e) => handleInfoAdChange('buttonLink', e.target.value)}
                placeholder="e.g. /about"
                className="h-9 text-sm"
              />
            </div>
          </div>
        </SectionBody>
      </div>

      {/* ================================================================ */}
      {/* 5. Categories                                                     */}
      {/* ================================================================ */}
      <div className="border border-mist rounded-lg bg-white overflow-hidden mb-3">
        <SectionHeader
          sectionKey="categories"
          title="Top Categories"
          description="Kinetic category accordion deck. Up to 7 categories. Eyebrow label: 'CURATED AYURVEDIC LINEUP'."
          expandedSections={expandedSections}
          onToggle={toggleSection}
        />

        <SectionBody sectionKey="categories" expandedSections={expandedSections}>
          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Eyebrow Label</Label>
            <Input
              value={categoriesSection?.label ?? 'CURATED AYURVEDIC LINEUP'}
              onChange={(e) => handleCategoriesChange('label', e.target.value)}
              placeholder="CURATED AYURVEDIC LINEUP"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Section Title</Label>
            <Input
              value={categoriesSection?.title ?? 'Top Categories'}
              onChange={(e) => handleCategoriesChange('title', e.target.value)}
              placeholder="Top Categories"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Select Categories</Label>
            <CategoryPicker
              selectedIds={categoriesSection?.categoryIds ?? []}
              onChange={(ids) =>
                onChange(updateSection(config, 'categories', { categoryIds: ids }))
              }
              max={5}
            />
          </div>
        </SectionBody>
      </div>

      {/* ================================================================ */}
      {/* 6. Latest Products                                                */}
      {/* ================================================================ */}
      <div className="border border-mist rounded-lg bg-white overflow-hidden mb-3">
        <SectionHeader
          sectionKey="latestProducts"
          title="Latest Products"
          description="Asymmetric editorial product grid. Displays up to 7 products. Eyebrow label: 'NEW HERBAL ARRIVALS'."
          expandedSections={expandedSections}
          onToggle={toggleSection}
        />

        <SectionBody sectionKey="latestProducts" expandedSections={expandedSections}>
          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Eyebrow Label</Label>
            <Input
              value={latestProductsSection?.label ?? 'NEW HERBAL ARRIVALS'}
              onChange={(e) => handleLatestProductsChange('label', e.target.value)}
              placeholder="NEW HERBAL ARRIVALS"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Section Title</Label>
            <Input
              value={latestProductsSection?.title ?? 'Latest Products'}
              onChange={(e) =>
                handleLatestProductsChange('title', e.target.value)
              }
              placeholder="Latest Products"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Product Count (max 7)</Label>
            <Input
              type="number"
              min={1}
              max={7}
              value={latestProductsSection?.productCount ?? 7}
              onChange={(e) => {
                const val = Math.min(7, Math.max(1, Number(e.target.value) || 1));
                handleLatestProductsChange('productCount', val);
              }}
              className="h-9 text-sm w-24"
            />
          </div>

          <div className="pt-1">
            <ProductPicker
              selectedIds={latestProductsSection?.productIds ?? []}
              onChange={(ids) =>
                onChange(
                  updateSection(config, 'latestProducts', { productIds: ids }),
                )
              }
              max={7}
            />
          </div>
        </SectionBody>
      </div>

      {/* ================================================================ */}
      {/* 7. Testimonials                                                   */}
      {/* ================================================================ */}
      <div className="border border-mist rounded-lg bg-white overflow-hidden mb-3">
        <SectionHeader
          sectionKey="testimonials"
          title="Testimonials"
          description="Dual-stream kinetic testimonial marquee. Up to 3 testimonials. Eyebrow label: 'VOICES OF HEALING'."
          expandedSections={expandedSections}
          onToggle={toggleSection}
        />

        <SectionBody sectionKey="testimonials" expandedSections={expandedSections}>
          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Eyebrow Label</Label>
            <Input
              value={testimonialsSection?.label ?? 'VOICES OF HEALING'}
              onChange={(e) =>
                onChange(
                  updateSection(config, 'testimonials', {
                    label: e.target.value,
                    items: testimonialItems,
                  }),
                )
              }
              placeholder="VOICES OF HEALING"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Section Title</Label>
            <Input
              value={testimonialsSection?.title ?? ''}
              onChange={(e) =>
                onChange(
                  updateSection(config, 'testimonials', {
                    title: e.target.value,
                    items: testimonialItems,
                  }),
                )
              }
              placeholder="e.g. What Our Customers Say"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Section Subtitle</Label>
            <Input
              value={testimonialsSection?.subtitle ?? ''}
              onChange={(e) =>
                onChange(
                  updateSection(config, 'testimonials', {
                    subtitle: e.target.value,
                    items: testimonialItems,
                  }),
                )
              }
              placeholder="Optional subtitle"
              className="h-9 text-sm"
            />
          </div>

          {testimonialItems.length === 0 ? (
            <p className="text-xs text-sand italic">No testimonials configured.</p>
          ) : (
            <div className="space-y-4">
              {testimonialItems.map((item, index) => (
                <div
                  key={index}
                  className="border border-mist rounded-lg bg-white p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-espresso">
                      Testimonial {index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-sand hover:text-red-500"
                      onClick={() => handleDeleteTestimonial(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-sand">Customer Name</Label>
                      <Input
                        value={item.customerName ?? ''}
                        onChange={(e) =>
                          handleTestimonialChange(index, 'customerName', e.target.value)
                        }
                        placeholder="Customer name"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-sand">Customer Title</Label>
                      <Input
                        value={item.customerTitle ?? ''}
                        onChange={(e) =>
                          handleTestimonialChange(
                            index,
                            'customerTitle',
                            e.target.value,
                          )
                        }
                        placeholder="e.g. CEO at Company"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-sand">Quote</Label>
                    <Textarea
                      value={item.quote ?? ''}
                      onChange={(e) =>
                        handleTestimonialChange(index, 'quote', e.target.value)
                      }
                      placeholder="Customer testimonial quote"
                      className="text-sm"
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-sand">Rating (1-5)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={item.rating ?? 5}
                        onChange={(e) => {
                          const val = Math.min(
                            5,
                            Math.max(1, Number(e.target.value) || 1),
                          );
                          handleTestimonialChange(index, 'rating', val);
                        }}
                        className="h-9 text-sm w-20"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-5">
                      <Switch
                        checked={item.isActive ?? true}
                        onCheckedChange={(checked) =>
                          handleTestimonialChange(index, 'isActive', checked)
                        }
                      />
                      <Label className="text-xs text-sand cursor-pointer">Active</Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="border-dashed border-mist text-sand hover:text-espresso"
            onClick={handleAddTestimonial}
            disabled={testimonialItems.length >= MAX_TESTIMONIALS}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Testimonial
          </Button>
        </SectionBody>
      </div>

      {/* ================================================================ */}
      {/* 8. Store Reference                                                */}
      {/* ================================================================ */}
      <div className="border border-mist rounded-lg bg-white overflow-hidden mb-3">
        <SectionHeader
          sectionKey="storeReference"
          title="Store Reference"
          description="Full-width background image section with store info + Google Map. Max height 800px."
          expandedSections={expandedSections}
          onToggle={toggleSection}
        />

        <SectionBody sectionKey="storeReference" expandedSections={expandedSections}>
          <div>
            <DeferredMediaUploader
              uploadKey="storeRef_desktop"
              accept="image/*"
              maxSizeMB={5}
              label="Desktop Image"
              placeholder="Upload desktop background image"
              previewHeight="h-40"
              value={storeRefSection?.desktopImageUrl ?? ''}
              currentRealUrl={storeRefSection?.desktopImageUrl || undefined}
              onChange={(url: string) => handleStoreRefChange('desktopImageUrl', url)}
            />
          </div>

          <div>
            <DeferredMediaUploader
              uploadKey="storeRef_mobile"
              accept="image/*"
              maxSizeMB={5}
              label="Mobile Image (optional)"
              placeholder="Upload mobile-specific background image"
              previewHeight="h-20"
              value={storeRefSection?.mobileImageUrl ?? ''}
              currentRealUrl={storeRefSection?.mobileImageUrl || undefined}
              onChange={(url: string) => handleStoreRefChange('mobileImageUrl', url)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Title</Label>
            <Input
              value={storeRefSection?.title ?? ''}
              onChange={(e) => handleStoreRefChange('title', e.target.value)}
              placeholder="e.g. Visit Our Store"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Subtitle</Label>
            <Input
              value={storeRefSection?.subtitle ?? ''}
              onChange={(e) => handleStoreRefChange('subtitle', e.target.value)}
              placeholder="Optional subtitle"
              className="h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sand">Address Line 1</Label>
              <Input
                value={storeRefSection?.addressLine1 ?? ''}
                onChange={(e) => handleStoreRefChange('addressLine1', e.target.value)}
                placeholder="Street address"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sand">Address Line 2</Label>
              <Input
                value={storeRefSection?.addressLine2 ?? ''}
                onChange={(e) => handleStoreRefChange('addressLine2', e.target.value)}
                placeholder="City, State, ZIP"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-sand">Map Embed URL</Label>
            <Input
              value={storeRefSection?.mapEmbedUrl ?? ''}
              onChange={(e) => handleStoreRefChange('mapEmbedUrl', e.target.value)}
              placeholder="Google Maps iframe src URL"
              className="h-9 text-sm"
            />
          </div>
        </SectionBody>
      </div>
    </div>
  );
}
