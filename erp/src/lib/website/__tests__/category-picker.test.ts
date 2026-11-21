/**
 * ARGUS #499 (BUG-69) — the website CMS category picker must only offer live
 * categories. The route previously filtered by tenant only, so a soft-deleted
 * category (`deletedAt` set) appeared in the picker and could be saved into a
 * section. This drives the real route with a mocked Prisma client and pins the
 * `deletedAt: null` predicate on the query.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  categoryFindMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: { findMany: mocks.categoryFindMany },
  },
}));

import { GET } from '@/app/api/store/website/categories/route';

describe('GET /api/store/website/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        role: 'OWNER',
        permissions: [],
      },
    });
    mocks.categoryFindMany.mockResolvedValue([]);
  });

  it('excludes soft-deleted categories from the picker query', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    expect(mocks.categoryFindMany).toHaveBeenCalledTimes(1);
    const query = mocks.categoryFindMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(query.where).toEqual({ tenantId: 'tenant-1', deletedAt: null });
  });

  it('keeps tenant scoping on the picker query', async () => {
    await GET();

    const query = mocks.categoryFindMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(query.where.tenantId).toBe('tenant-1');
  });
});
