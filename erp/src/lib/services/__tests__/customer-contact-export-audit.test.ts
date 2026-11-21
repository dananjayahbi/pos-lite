import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ARGUS #316: the ad-hoc contact export returned full contact PII through a
 * compile-only path that wrote no audit row. Every download must leave exactly
 * one CONTACT_EXPORT_RUN entry with the acting user and the exported count.
 */
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: { create: mocks.create },
  },
}));

import {
  CONTACT_EXPORT_ACTION,
  CONTACT_EXPORT_ENTITY,
  recordAdHocContactExportDownload,
} from '@/lib/services/customer-contact-export.service';
import type { ContactExportCompiled } from '@/lib/services/customer-contact-export.service';

const compiled: ContactExportCompiled = {
  tenantId: 'tenant-1',
  scope: 'ACTIVE',
  format: 'csv',
  totalCandidates: 10,
  included: 8,
  excluded: 2,
  filename: 'contacts-20261122-010000.csv',
  content: 'customerId,name\r\nc1,Alice',
  createdAt: '2026-11-22T01:00:00.000Z',
};

describe('recordAdHocContactExportDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({});
  });

  it('writes one CONTACT_EXPORT_RUN row with the actor and exported count', async () => {
    await recordAdHocContactExportDownload({
      compiled,
      actorId: 'user-1',
      actorRole: 'MANAGER',
    });

    expect(mocks.create).toHaveBeenCalledTimes(1);
    const data = mocks.create.mock.calls[0]?.[0]?.data;

    expect(data.tenantId).toBe('tenant-1');
    expect(data.actorId).toBe('user-1');
    expect(data.actorRole).toBe('MANAGER');
    expect(data.entityType).toBe(CONTACT_EXPORT_ENTITY);
    expect(data.action).toBe(CONTACT_EXPORT_ACTION);
    expect(data.entityId).toContain(':adhoc');
    expect(data.after).toMatchObject({
      trigger: 'ADHOC',
      scope: 'ACTIVE',
      format: 'csv',
      totalCandidates: 10,
      included: 8,
      excluded: 2,
      destination: 'download',
      deliveredTo: null,
    });
  });

  it('uses the same action as the scheduled run', () => {
    expect(CONTACT_EXPORT_ACTION).toBe('CONTACT_EXPORT_RUN');
    expect(CONTACT_EXPORT_ENTITY).toBe('CUSTOMER_CONTACT_EXPORT');
  });
});
