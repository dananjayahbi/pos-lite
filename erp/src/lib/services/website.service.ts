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
