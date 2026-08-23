import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  listBatches,
  getBatchStats,
  type GetBatchesFilters,
} from '@/lib/services/batchTracking.service';
import { BatchSource } from '@/generated/prisma/client';

const EXPIRY_STATUSES = ['EXPIRED', 'EXPIRING_SOON', 'OK'] as const;
type ExpiryStatusFilter = (typeof EXPIRY_STATUSES)[number];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }
    if (!hasPermission(session.user, PERMISSIONS.BATCH.viewBatch)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') ?? undefined;
    const variantId = searchParams.get('variantId') ?? undefined;
    const sourceRaw = searchParams.get('source') ?? undefined;
    const expiryStatusRaw = searchParams.get('expiryStatus') ?? undefined;
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '25')));

    const filters: GetBatchesFilters = {
      page,
      limit,
      ...(search ? { search } : {}),
      ...(variantId ? { variantId } : {}),
      ...(sourceRaw &&
      (sourceRaw === BatchSource.PURCHASE || sourceRaw === BatchSource.MANUFACTURED)
        ? { source: sourceRaw as BatchSource }
        : {}),
      ...(EXPIRY_STATUSES.includes(expiryStatusRaw as ExpiryStatusFilter)
        ? { expiryStatus: expiryStatusRaw as ExpiryStatusFilter }
        : {}),
    };

    const [listResult, stats] = await Promise.all([
      listBatches(tenantId, filters),
      getBatchStats(tenantId),
    ]);

    return NextResponse.json({ success: true, data: listResult.batches, meta: { ...stats, total: listResult.total } });
  } catch (error) {
    console.error('GET batches error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to list batches' } },
      { status: 500 },
    );
  }
}
