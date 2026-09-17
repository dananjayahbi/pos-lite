/**
 * Website Service Layer — sole entry point for all website config CRUD.
 *
 * Each tenant has exactly ONE WebsiteConfig. Hero slides and ads are
 * managed as sub-collections under the config.
 */

import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
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

/**
 * OBS-44 — normalize an ad scheduling value for Prisma.
 *
 * `WebsiteDateSchema` (`z.coerce.date()`) hands the service a real `Date` (or
 * `null`/`undefined`), so no string re-parsing happens here. Re-parsing was the
 * bug: a path that skipped the schema could pass a non-date string and Prisma
 * received `Invalid Date`. Anything that is not a valid `Date` fails closed as
 * `null` rather than being guessed at.
 */
function toNullableDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * M29-01/BUG-68 — tenant ownership gate for hero-slide / ad **row mutations**.
 *
 * Hero slides and ads are mutated through row-level routes
 * (`/hero-slides/[id]`, `/ads/[id]`) whose id comes straight from the URL, so a
 * bare-id `update`/`delete` lets any authenticated user rewrite or destroy
 * another tenant's storefront content (cross-tenant IDOR). Every row mutation
 * resolves the row through this gate first.
 *
 * Fails closed with 404 — never 403 — so a foreign id is indistinguishable
 * from a missing one (no existence disclosure), matching the convention used
 * by `staff.service.ts` / `assertCustomerBelongsToTenant`.
 */
export async function assertWebsiteChildBelongsToTenant(
  tenantId: string,
  entity: 'heroSlide' | 'ad',
  id: string,
): Promise<{ id: string }> {
  const row =
    entity === 'heroSlide'
      ? await prisma.websiteHeroSlide.findFirst({ where: { id, tenantId }, select: { id: true } })
      : await prisma.websiteAd.findFirst({ where: { id, tenantId }, select: { id: true } });

  if (!row) {
    throw new ApiError(
      404,
      'NOT_FOUND',
      entity === 'heroSlide' ? 'Hero slide not found' : 'Ad not found',
    );
  }
  return row;
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
  tenantId: string,
  slideId: string,
  data: Record<string, unknown>,
) {
  // M29-01/BUG-68: slideId is a client-controlled route param — resolve it
  // inside the caller's tenant before writing (404 on a foreign/missing id).
  await assertWebsiteChildBelongsToTenant(tenantId, 'heroSlide', slideId);
  return prisma.websiteHeroSlide.update({
    where: { id: slideId },
    data: pruneEmptyStrings(data) as unknown as Prisma.WebsiteHeroSlideUpdateInput,
  });
}

export async function deleteHeroSlide(tenantId: string, slideId: string) {
  await assertWebsiteChildBelongsToTenant(tenantId, 'heroSlide', slideId);
  return prisma.websiteHeroSlide.delete({ where: { id: slideId } });
}

export async function reorderHeroSlides(
  tenantId: string,
  slides: { id: string; sortOrder: number }[],
) {
  // M29-01/BUG-68: the ids in this batch also arrive from the client, so the
  // whole set must be proven to belong to the tenant before reordering.
  const ids = slides.map(({ id }) => id);
  const owned = await prisma.websiteHeroSlide.findMany({
    where: { id: { in: ids }, tenantId },
    select: { id: true },
  });
  if (owned.length !== new Set(ids).size) {
    throw new ApiError(404, 'NOT_FOUND', 'Hero slide not found');
  }

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
      startsAt: toNullableDate(data.startsAt),
      endsAt: toNullableDate(data.endsAt),
    } as unknown as Prisma.WebsiteAdCreateInput,
  });
}

export async function updateAd(
  tenantId: string,
  adId: string,
  data: Record<string, unknown>,
) {
  // M29-01/BUG-68: same row-level gate as updateHeroSlide.
  await assertWebsiteChildBelongsToTenant(tenantId, 'ad', adId);
  const cleanData = pruneEmptyStrings({ ...data } as Record<string, unknown>);
  const updateData: Record<string, unknown> = { ...cleanData };
  if ('startsAt' in data) {
    updateData.startsAt = toNullableDate(data.startsAt);
  }
  if ('endsAt' in data) {
    updateData.endsAt = toNullableDate(data.endsAt);
  }
  return prisma.websiteAd.update({
    where: { id: adId },
    data: updateData as Prisma.WebsiteAdUpdateInput,
  });
}

export async function deleteAd(tenantId: string, adId: string) {
  await assertWebsiteChildBelongsToTenant(tenantId, 'ad', adId);
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
    // M29-01/BUG-68: configId already comes from the caller's own config, but
    // tenantId is kept in the predicate so the wipe can never cross tenants.
    prisma.websiteHeroSlide.deleteMany({ where: { configId, tenantId } }),
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
    // M29-01/BUG-68: tenantId in the predicate — see replaceHeroSlides.
    prisma.websiteAd.deleteMany({ where: { configId, tenantId } }),
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
          startsAt: toNullableDate(ad.startsAt),
          endsAt: toNullableDate(ad.endsAt),
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
        aboutPhoneLabel: null,
        aboutPhoneNumber: null,
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
