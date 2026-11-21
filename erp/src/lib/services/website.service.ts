/**
 * Website Service Layer — sole entry point for all website config CRUD.
 *
 * Each tenant has exactly ONE WebsiteConfig. Hero slides and ads are
 * managed as sub-collections under the config.
 */

import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { AUDIT_ACTIONS, writeAuditLog } from '@/lib/services/audit.service';
import { deleteFile } from '@/lib/storage';
import { extractTenantAssetPath } from '@/lib/storage/asset-paths';
import {
  collectWebsiteAssetCandidates,
  WEBSITE_RESET_CONFIG_DATA,
  websiteResetSummary,
  type WebsiteResetSummary,
} from '@/lib/website/reset.core';
import {
  websiteAuditRecord,
  type WebsiteAuditActor,
} from '@/lib/website/websiteAudit.core';
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
  actor: WebsiteAuditActor,
) {
  const before = await prisma.websiteConfig.findUnique({ where: { tenantId } });

  const config = await prisma.websiteConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      ...(data as Record<string, unknown>),
    } as unknown as Prisma.WebsiteConfigCreateInput,
    update: data as unknown as Prisma.WebsiteConfigUpdateInput,
  });

  await writeAuditLog(
    websiteAuditRecord({
      tenantId,
      actor,
      entityType: 'WebsiteConfig',
      entityId: config.id,
      action: AUDIT_ACTIONS.WEBSITE_CONFIG_UPDATED,
      before,
      after: config,
    }),
  );

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
  actor: WebsiteAuditActor,
) {
  const slide = await prisma.websiteHeroSlide.create({
    data: {
      tenantId,
      configId,
      ...pruneEmptyStrings(data as Record<string, unknown>),
    } as unknown as Prisma.WebsiteHeroSlideCreateInput,
  });

  await writeAuditLog(
    websiteAuditRecord({
      tenantId,
      actor,
      entityType: 'WebsiteHeroSlide',
      entityId: slide.id,
      action: AUDIT_ACTIONS.WEBSITE_HERO_SLIDE_CREATED,
      before: null,
      after: slide,
    }),
  );

  return slide;
}

export async function updateHeroSlide(
  tenantId: string,
  slideId: string,
  data: Record<string, unknown>,
  actor: WebsiteAuditActor,
) {
  // M29-01/BUG-68: slideId is a client-controlled route param — resolve it
  // inside the caller's tenant before writing (404 on a foreign/missing id).
  await assertWebsiteChildBelongsToTenant(tenantId, 'heroSlide', slideId);
  const before = await prisma.websiteHeroSlide.findUniqueOrThrow({
    where: { id: slideId },
  });
  const slide = await prisma.websiteHeroSlide.update({
    where: { id: slideId },
    data: pruneEmptyStrings(data) as unknown as Prisma.WebsiteHeroSlideUpdateInput,
  });

  await writeAuditLog(
    websiteAuditRecord({
      tenantId,
      actor,
      entityType: 'WebsiteHeroSlide',
      entityId: slideId,
      action: AUDIT_ACTIONS.WEBSITE_HERO_SLIDE_UPDATED,
      before,
      after: slide,
    }),
  );

  return slide;
}

export async function deleteHeroSlide(
  tenantId: string,
  slideId: string,
  actor: WebsiteAuditActor,
) {
  await assertWebsiteChildBelongsToTenant(tenantId, 'heroSlide', slideId);
  const before = await prisma.websiteHeroSlide.findUniqueOrThrow({
    where: { id: slideId },
  });
  const deleted = await prisma.websiteHeroSlide.delete({ where: { id: slideId } });

  await writeAuditLog(
    websiteAuditRecord({
      tenantId,
      actor,
      entityType: 'WebsiteHeroSlide',
      entityId: slideId,
      action: AUDIT_ACTIONS.WEBSITE_HERO_SLIDE_DELETED,
      before,
      after: null,
    }),
  );

  return deleted;
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
  actor: WebsiteAuditActor,
) {
  const cleanData = pruneEmptyStrings({ ...data } as Record<string, unknown>);
  const ad = await prisma.websiteAd.create({
    data: {
      tenantId,
      configId,
      ...cleanData,
      startsAt: toNullableDate(data.startsAt),
      endsAt: toNullableDate(data.endsAt),
    } as unknown as Prisma.WebsiteAdCreateInput,
  });

  await writeAuditLog(
    websiteAuditRecord({
      tenantId,
      actor,
      entityType: 'WebsiteAd',
      entityId: ad.id,
      action: AUDIT_ACTIONS.WEBSITE_AD_CREATED,
      before: null,
      after: ad,
    }),
  );

  return ad;
}

export async function updateAd(
  tenantId: string,
  adId: string,
  data: Record<string, unknown>,
  actor: WebsiteAuditActor,
) {
  // M29-01/BUG-68: same row-level gate as updateHeroSlide.
  await assertWebsiteChildBelongsToTenant(tenantId, 'ad', adId);
  const before = await prisma.websiteAd.findUniqueOrThrow({ where: { id: adId } });
  const cleanData = pruneEmptyStrings({ ...data } as Record<string, unknown>);
  const updateData: Record<string, unknown> = { ...cleanData };
  if ('startsAt' in data) {
    updateData.startsAt = toNullableDate(data.startsAt);
  }
  if ('endsAt' in data) {
    updateData.endsAt = toNullableDate(data.endsAt);
  }
  const ad = await prisma.websiteAd.update({
    where: { id: adId },
    data: updateData as Prisma.WebsiteAdUpdateInput,
  });

  await writeAuditLog(
    websiteAuditRecord({
      tenantId,
      actor,
      entityType: 'WebsiteAd',
      entityId: adId,
      action: AUDIT_ACTIONS.WEBSITE_AD_UPDATED,
      before,
      after: ad,
    }),
  );

  return ad;
}

export async function deleteAd(
  tenantId: string,
  adId: string,
  actor: WebsiteAuditActor,
) {
  await assertWebsiteChildBelongsToTenant(tenantId, 'ad', adId);
  const before = await prisma.websiteAd.findUniqueOrThrow({ where: { id: adId } });
  const deleted = await prisma.websiteAd.delete({ where: { id: adId } });

  await writeAuditLog(
    websiteAuditRecord({
      tenantId,
      actor,
      entityType: 'WebsiteAd',
      entityId: adId,
      action: AUDIT_ACTIONS.WEBSITE_AD_DELETED,
      before,
      after: null,
    }),
  );

  return deleted;
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
  actor: WebsiteAuditActor,
) {
  const before = await prisma.websiteHeroSlide.findMany({
    where: { configId, tenantId },
    orderBy: { sortOrder: 'asc' },
  });

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

  const after = await prisma.websiteHeroSlide.findMany({
    where: { configId, tenantId },
    orderBy: { sortOrder: 'asc' },
  });

  await writeAuditLog(
    websiteAuditRecord({
      tenantId,
      actor,
      entityType: 'WebsiteHeroSlide',
      entityId: configId,
      action: AUDIT_ACTIONS.WEBSITE_HERO_SLIDES_REPLACED,
      before: { count: before.length, slides: before },
      after: { count: after.length, slides: after },
    }),
  );
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
  actor: WebsiteAuditActor,
) {
  const before = await prisma.websiteAd.findMany({
    where: { configId, tenantId },
    orderBy: { createdAt: 'desc' },
  });

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

  const after = await prisma.websiteAd.findMany({
    where: { configId, tenantId },
    orderBy: { createdAt: 'desc' },
  });

  await writeAuditLog(
    websiteAuditRecord({
      tenantId,
      actor,
      entityType: 'WebsiteAd',
      entityId: configId,
      action: AUDIT_ACTIONS.WEBSITE_ADS_REPLACED,
      before: { count: before.length, ads: before },
      after: { count: after.length, ads: after },
    }),
  );
}

/**
 * Reset a tenant's website configuration to defaults: clears every config
 * field (copy, branding, colours, typography, SEO, nav, sections, footer,
 * announcement, appointments, about/contact/shop), removes all related hero
 * slides and ads, and best-effort deletes the tenant's uploaded website assets.
 * Returns a summary so the UI can report exactly what was removed (ARGUS #497).
 */
export async function resetWebsiteConfig(
  tenantId: string,
  actor: WebsiteAuditActor,
): Promise<WebsiteResetSummary> {
  const existing = await prisma.websiteConfig.findUnique({
    where: { tenantId },
    include: {
      heroSlides: { orderBy: { sortOrder: 'asc' } },
      ads: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!existing) {
    return websiteResetSummary({
      reset: false,
      deletedAssets: 0,
      failedAssets: 0,
      skippedAssets: 0,
    });
  }

  // Resolve tenant-owned storage keys before the DB rows disappear. External
  // links and unsupported providers are counted as skipped, never deleted.
  const assetPaths = new Set<string>();
  let skippedAssets = 0;
  for (const candidate of collectWebsiteAssetCandidates(existing)) {
    const path = extractTenantAssetPath(candidate, tenantId);
    if (path) assetPaths.add(path);
    else skippedAssets += 1;
  }

  await prisma.$transaction([
    prisma.websiteHeroSlide.deleteMany({ where: { tenantId } }),
    prisma.websiteAd.deleteMany({ where: { tenantId } }),
    prisma.websiteConfig.update({
      where: { id: existing.id },
      data: WEBSITE_RESET_CONFIG_DATA as unknown as Prisma.WebsiteConfigUpdateInput,
    }),
  ]);

  const results = await Promise.allSettled(
    [...assetPaths].map((path) => deleteFile(path)),
  );
  const deletedAssets = results.filter((result) => result.status === 'fulfilled').length;
  const failedAssets = results.filter((result) => result.status === 'rejected').length;

  const summary = websiteResetSummary({
    reset: true,
    deletedAssets,
    failedAssets,
    skippedAssets,
  });

  await writeAuditLog(
    websiteAuditRecord({
      tenantId,
      actor,
      entityType: 'WebsiteConfig',
      entityId: existing.id,
      action: AUDIT_ACTIONS.WEBSITE_CONFIG_RESET,
      before: existing,
      after: {
        config: WEBSITE_RESET_CONFIG_DATA,
        heroSlides: [],
        ads: [],
        ...summary,
      },
    }),
  );

  return summary;
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
