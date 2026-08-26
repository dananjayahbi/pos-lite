/**
 * Website Service Layer — sole entry point for all website config CRUD.
 *
 * Each tenant has exactly ONE WebsiteConfig. Hero slides and ads are
 * managed as sub-collections under the config.
 */

import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/services/audit.service';
import type { Prisma } from '@/generated/prisma/client';

// ── Helpers ──────────────────────────────────────────────────────────────────

function pruneEmptyStrings<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (result[key] === '') result[key] = null;
  }
  return result as T;
}

// ── Website Config ───────────────────────────────────────────────────────────

export async function getWebsiteConfig(tenantId: string) {
  const config = await prisma.websiteConfig.findUnique({
    where: { tenantId },
    include: {
      heroSlides: { orderBy: { sortOrder: 'asc' } },
      ads: { orderBy: { createdAt: 'desc' } },
    },
  });

  return config;
}

export async function upsertWebsiteConfig(
  tenantId: string,
  data: Record<string, unknown>,
  actorId?: string,
) {
  const config = await prisma.websiteConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      ...(data as Record<string, unknown>),
    } as unknown as Prisma.WebsiteConfigCreateInput,
    update: data as unknown as Prisma.WebsiteConfigUpdateInput,
  });

  if (actorId) {
    await createAuditLog({
      tenantId,
      actorId,
      actorRole: 'OWNER',
      entityType: 'WebsiteConfig',
      entityId: config.id,
      action: 'UPSERT',
      after: JSON.parse(JSON.stringify(data)),
    });
  }

  return config;
}

// ── Hero Slides ──────────────────────────────────────────────────────────────

export async function getHeroSlides(configId: string) {
  return prisma.websiteHeroSlide.findMany({
    where: { configId },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function createHeroSlide(
  tenantId: string,
  configId: string,
  data: Record<string, unknown>,
) {
  return prisma.websiteHeroSlide.create({
    data: {
      tenantId,
      configId,
      ...pruneEmptyStrings(data as Record<string, unknown>),
    } as unknown as Prisma.WebsiteHeroSlideCreateInput,
  });
}

export async function updateHeroSlide(
  slideId: string,
  data: Record<string, unknown>,
) {
  return prisma.websiteHeroSlide.update({
    where: { id: slideId },
    data: pruneEmptyStrings(data) as unknown as Prisma.WebsiteHeroSlideUpdateInput,
  });
}

export async function deleteHeroSlide(slideId: string) {
  return prisma.websiteHeroSlide.delete({ where: { id: slideId } });
}

export async function reorderHeroSlides(
  slides: { id: string; sortOrder: number }[],
) {
  const operations = slides.map(({ id, sortOrder }) =>
    prisma.websiteHeroSlide.update({
      where: { id },
      data: { sortOrder },
    }),
  );
  await prisma.$transaction(operations);
}

// ── Ads ──────────────────────────────────────────────────────────────────────

export async function getAds(tenantId: string) {
  return prisma.websiteAd.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getActiveAds(tenantId: string) {
  const now = new Date();
  return prisma.websiteAd.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { startsAt: null, endsAt: null },
        { startsAt: { lte: now }, endsAt: null },
        { startsAt: null, endsAt: { gte: now } },
        { startsAt: { lte: now }, endsAt: { gte: now } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createAd(
  tenantId: string,
  configId: string,
  data: Record<string, unknown>,
) {
  const cleanData = pruneEmptyStrings({ ...data } as Record<string, unknown>);
  return prisma.websiteAd.create({
    data: {
      tenantId,
      configId,
      ...cleanData,
      startsAt: data.startsAt ? new Date(data.startsAt as string) : null,
      endsAt: data.endsAt ? new Date(data.endsAt as string) : null,
    } as unknown as Prisma.WebsiteAdCreateInput,
  });
}

export async function updateAd(
  adId: string,
  data: Record<string, unknown>,
) {
  const cleanData = pruneEmptyStrings({ ...data } as Record<string, unknown>);
  const updateData: Record<string, unknown> = { ...cleanData };
  if ('startsAt' in data) {
    updateData.startsAt = data.startsAt ? new Date(data.startsAt as string) : null;
  }
  if ('endsAt' in data) {
    updateData.endsAt = data.endsAt ? new Date(data.endsAt as string) : null;
  }
  return prisma.websiteAd.update({
    where: { id: adId },
    data: updateData as Prisma.WebsiteAdUpdateInput,
  });
}

export async function deleteAd(adId: string) {
  return prisma.websiteAd.delete({ where: { id: adId } });
}

// ── Full reconciliation (single source of truth) ─────────────────────────────
// The storefront reads hero slides & ads from their dedicated relation rows.
// When the settings form saves the whole config, it submits the full current
// hero-slide / ad arrays, so we reconcile the relation rows to match exactly.
// A full replace (delete-all + recreate) within a transaction guarantees the
// DB rows always mirror the editor — no drift, no orphaned rows.

export async function replaceHeroSlides(
  configId: string,
  tenantId: string,
  slides: {
    mediaType: string;
    mediaUrl: string;
    mobileMediaUrl?: string | null | undefined;
    title?: string | null | undefined;
    subtitle?: string | null | undefined;
    description?: string | null | undefined;
    ctaText?: string | null | undefined;
    ctaLink?: string | null | undefined;
    isActive?: boolean;
    sortOrder?: number;
  }[],
) {
  await prisma.$transaction([
    prisma.websiteHeroSlide.deleteMany({ where: { configId } }),
    ...slides.map((slide) =>
      prisma.websiteHeroSlide.create({
        data: {
          configId,
          tenantId,
          mediaType: slide.mediaType ?? 'image',
          mediaUrl: slide.mediaUrl,
          mobileMediaUrl: slide.mobileMediaUrl ?? null,
          title: slide.title ?? null,
          subtitle: slide.subtitle ?? null,
          description: slide.description ?? null,
          ctaText: slide.ctaText ?? null,
          ctaLink: slide.ctaLink ?? null,
          isActive: slide.isActive ?? true,
          sortOrder: slide.sortOrder ?? 0,
        },
      }),
    ),
  ]);
}

export async function replaceAds(
  configId: string,
  tenantId: string,
  ads: {
    name: string;
    mediaType: string;
    mediaUrl: string;
    mobileMediaUrl?: string | null | undefined;
    targetUrl?: string | null | undefined;
    position?: string;
    displayAfterSection?: string | null | undefined;
    startsAt?: string | Date | null | undefined;
    endsAt?: string | Date | null | undefined;
    isActive?: boolean;
  }[],
) {
  await prisma.$transaction([
    prisma.websiteAd.deleteMany({ where: { configId } }),
    ...ads.map((ad) =>
      prisma.websiteAd.create({
        data: {
          configId,
          tenantId,
          name: ad.name,
          mediaType: ad.mediaType ?? 'image',
          mediaUrl: ad.mediaUrl,
          mobileMediaUrl: ad.mobileMediaUrl ?? null,
          targetUrl: ad.targetUrl ?? null,
          position: ad.position ?? 'between_sections',
          displayAfterSection: ad.displayAfterSection ?? null,
          startsAt: ad.startsAt ? new Date(ad.startsAt as string | Date) : null,
          endsAt: ad.endsAt ? new Date(ad.endsAt as string | Date) : null,
          isActive: ad.isActive ?? true,
        },
      }),
    ),
  ]);
}

/**
 * Reset a tenant's website configuration to defaults: clears the config JSON
 * (sections, social links, nav, footer, about values) and removes all related
 * hero slides and ads. Returns true if a config row existed and was reset.
 */
export async function resetWebsiteConfig(tenantId: string): Promise<boolean> {
  const existing = await prisma.websiteConfig.findUnique({
    where: { tenantId },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma.$transaction([
    prisma.websiteHeroSlide.deleteMany({ where: { tenantId } }),
    prisma.websiteAd.deleteMany({ where: { tenantId } }),
    prisma.websiteConfig.update({
      where: { id: existing.id },
      data: {
        siteName: null,
        tagline: null,
        logoUrl: null,
        faviconUrl: null,
        metaTitle: null,
        metaDescription: null,
        socialLinks: {},
        navItems: [],
        sections: {},
        footerAbout: null,
        footerColumns: [],
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
        contactPageTitle: null,
        contactPageSubtitle: null,
        contactHeroImageUrl: null,
        contactInfoTitle: null,
        contactAddress: null,
        contactPhoneDisplay: null,
        contactEmailDisplay: null,
        contactBusinessHours: null,
        contactMapEmbedUrl: null,
        shopPageTitle: null,
        shopPageSubtitle: null,
        shopHeroImageUrl: null,
        shopPageDescription: null,
        shopProductsPerPage: 24,
      },
    }),
  ]);

  return true;
}

// ── Public helpers (for customer-facing website) ─────────────────────────────

export async function getPublicWebsiteConfig(tenantId: string) {
  const config = await prisma.websiteConfig.findUnique({
    where: { tenantId },
    include: {
      heroSlides: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
      ads: {
        where: {
          isActive: true,
          OR: [
            { startsAt: null, endsAt: null },
            { startsAt: { lte: new Date() }, endsAt: null },
            { startsAt: null, endsAt: { gte: new Date() } },
            { startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return config;
}
