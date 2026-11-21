import { describe, expect, it } from 'vitest';

import {
  serializeWebsiteAudit,
  websiteAuditRecord,
} from '@/lib/website/websiteAudit.core';

/**
 * ARGUS #498: destructive CMS changes need durable rows carrying the real
 * actor and a JSON-safe before/after snapshot.
 */
describe('website audit records', () => {
  it('uses the real actor instead of a hard-coded OWNER', () => {
    const record = websiteAuditRecord({
      tenantId: 'tenant-1',
      actor: { id: 'user-7', role: 'MANAGER' },
      entityType: 'WebsiteHeroSlide',
      entityId: 'slide-1',
      action: 'WEBSITE_HERO_SLIDE_DELETED',
      before: { id: 'slide-1', title: 'Summer' },
      after: null,
    });

    expect(record.actorId).toBe('user-7');
    expect(record.actorRole).toBe('MANAGER');
    expect(record.action).toBe('WEBSITE_HERO_SLIDE_DELETED');
    expect(record.before).toEqual({ id: 'slide-1', title: 'Summer' });
    expect(record.after).toBeNull();
  });

  it('serialises dates and nested config objects', () => {
    const record = websiteAuditRecord({
      tenantId: 'tenant-1',
      actor: { id: 'user-1', role: 'OWNER' },
      entityType: 'WebsiteConfig',
      entityId: 'config-1',
      action: 'WEBSITE_CONFIG_UPDATED',
      before: { siteName: 'Old', updatedAt: new Date('2026-01-02T03:04:05.000Z') },
      after: {
        siteName: 'New',
        sections: { infoAd: { desktopImageUrl: 'https://cdn.example/x.png' } },
        updatedAt: new Date('2026-01-02T03:04:06.000Z'),
      },
    });

    expect(record.before).toEqual({
      siteName: 'Old',
      updatedAt: '2026-01-02T03:04:05.000Z',
    });
    expect(record.after).toMatchObject({
      siteName: 'New',
      sections: { infoAd: { desktopImageUrl: 'https://cdn.example/x.png' } },
      updatedAt: '2026-01-02T03:04:06.000Z',
    });
  });

  it('turns undefined snapshots into null rather than dropping the field', () => {
    expect(serializeWebsiteAudit(undefined)).toBeNull();
    expect(serializeWebsiteAudit({ value: undefined })).toEqual({});
  });

  it('keeps arrays and primitive JSON values intact', () => {
    expect(serializeWebsiteAudit([{ id: 'a' }, { id: 'b' }])).toEqual([
      { id: 'a' },
      { id: 'b' },
    ]);
    expect(serializeWebsiteAudit(false)).toBe(false);
    expect(serializeWebsiteAudit(0)).toBe(0);
  });
});
