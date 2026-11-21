import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ARGUS #498: every destructive website CMS write records a durable row with
 * the real actor and before/after. The pure builder is covered separately;
 * these tests pin the service wiring and actions.
 */
const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  configFindUnique: vi.fn(),
  configUpsert: vi.fn(),
  configUpdate: vi.fn(),
  slideCreate: vi.fn(),
  slideFindFirst: vi.fn(),
  slideFindUniqueOrThrow: vi.fn(),
  slideFindMany: vi.fn(),
  slideUpdate: vi.fn(),
  slideDelete: vi.fn(),
  slideDeleteMany: vi.fn(),
  adCreate: vi.fn(),
  adFindFirst: vi.fn(),
  adFindUniqueOrThrow: vi.fn(),
  adFindMany: vi.fn(),
  adUpdate: vi.fn(),
  adDelete: vi.fn(),
  adDeleteMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    websiteConfig: {
      findUnique: mocks.configFindUnique,
      upsert: mocks.configUpsert,
      update: mocks.configUpdate,
    },
    websiteHeroSlide: {
      create: mocks.slideCreate,
      findFirst: mocks.slideFindFirst,
      findUniqueOrThrow: mocks.slideFindUniqueOrThrow,
      findMany: mocks.slideFindMany,
      update: mocks.slideUpdate,
      delete: mocks.slideDelete,
      deleteMany: mocks.slideDeleteMany,
    },
    websiteAd: {
      create: mocks.adCreate,
      findFirst: mocks.adFindFirst,
      findUniqueOrThrow: mocks.adFindUniqueOrThrow,
      findMany: mocks.adFindMany,
      update: mocks.adUpdate,
      delete: mocks.adDelete,
      deleteMany: mocks.adDeleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock('@/lib/storage', () => ({
  deleteFile: vi.fn(),
}));

vi.mock('@/lib/services/audit.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/audit.service')>();
  return { ...actual, writeAuditLog: mocks.audit };
});

import { AUDIT_ACTIONS } from '@/lib/services/audit.service';
import {
  createHeroSlide,
  deleteAd,
  replaceHeroSlides,
  resetWebsiteConfig,
  upsertWebsiteConfig,
} from '@/lib/services/website.service';

const actor = { id: 'user-7', role: 'MANAGER' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockResolvedValue([]);
  mocks.slideDeleteMany.mockReturnValue({});
  mocks.adDeleteMany.mockReturnValue({});
  mocks.configUpdate.mockReturnValue({});
});

describe('website CMS audit wiring', () => {
  it('records a config update with the real actor and before/after', async () => {
    mocks.configFindUnique.mockResolvedValue({ id: 'cfg-1', siteName: 'Old' });
    mocks.configUpsert.mockResolvedValue({ id: 'cfg-1', siteName: 'New' });

    await upsertWebsiteConfig('tenant-1', { siteName: 'New' }, actor);

    expect(mocks.audit).toHaveBeenCalledTimes(1);
    const row = mocks.audit.mock.calls[0]?.[0];
    expect(row.action).toBe(AUDIT_ACTIONS.WEBSITE_CONFIG_UPDATED);
    expect(row.actorId).toBe('user-7');
    expect(row.actorRole).toBe('MANAGER');
    expect(row.before).toEqual({ id: 'cfg-1', siteName: 'Old' });
    expect(row.after).toEqual({ id: 'cfg-1', siteName: 'New' });
  });

  it('records a hero-slide create with a null before', async () => {
    mocks.slideCreate.mockResolvedValue({ id: 'slide-1', title: 'Summer' });

    await createHeroSlide('tenant-1', 'cfg-1', { mediaUrl: 'https://x/y.png' }, actor);

    const row = mocks.audit.mock.calls[0]?.[0];
    expect(row.action).toBe(AUDIT_ACTIONS.WEBSITE_HERO_SLIDE_CREATED);
    expect(row.entityType).toBe('WebsiteHeroSlide');
    expect(row.entityId).toBe('slide-1');
    expect(row.before).toBeNull();
    expect(row.after).toEqual({ id: 'slide-1', title: 'Summer' });
  });

  it('records an ad delete with the deleted row as before', async () => {
    mocks.adFindFirst.mockResolvedValue({ id: 'ad-1' });
    mocks.adFindUniqueOrThrow.mockResolvedValue({ id: 'ad-1', name: 'Sale' });
    mocks.adDelete.mockResolvedValue({ id: 'ad-1' });

    await deleteAd('tenant-1', 'ad-1', actor);

    const row = mocks.audit.mock.calls[0]?.[0];
    expect(row.action).toBe(AUDIT_ACTIONS.WEBSITE_AD_DELETED);
    expect(row.before).toEqual({ id: 'ad-1', name: 'Sale' });
    expect(row.after).toBeNull();
  });

  it('records a full slide replacement with before/after counts', async () => {
    mocks.slideFindMany
      .mockResolvedValueOnce([{ id: 'old-1' }])
      .mockResolvedValueOnce([{ id: 'new-1' }, { id: 'new-2' }]);

    await replaceHeroSlides(
      'cfg-1',
      'tenant-1',
      [{ mediaType: 'image', mediaUrl: 'https://x/1.png' }],
      actor,
    );

    const row = mocks.audit.mock.calls[0]?.[0];
    expect(row.action).toBe(AUDIT_ACTIONS.WEBSITE_HERO_SLIDES_REPLACED);
    expect(row.before).toMatchObject({ count: 1 });
    expect(row.after).toMatchObject({ count: 2 });
  });

  it('records the full reset with the previous config and cleanup summary', async () => {
    mocks.configFindUnique.mockResolvedValue({
      id: 'cfg-1',
      siteName: 'Old',
      heroSlides: [{ id: 'slide-1' }],
      ads: [{ id: 'ad-1' }],
    });

    await resetWebsiteConfig('tenant-1', actor);

    const row = mocks.audit.mock.calls[0]?.[0];
    expect(row.action).toBe(AUDIT_ACTIONS.WEBSITE_CONFIG_RESET);
    expect(row.before).toMatchObject({ id: 'cfg-1', siteName: 'Old' });
    expect(row.after).toMatchObject({ heroSlides: [], ads: [], reset: true });
  });
});
