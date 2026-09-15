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
import { toErrorResponse } from '@/lib/api/error-envelope';
import { parseQueryInt } from '@/lib/api/query-params';

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
    // XC-01: Math.max(1,Number('abc')) is NaN — malformed page/limit now 400.
    const page = parseQueryInt(searchParams, 'page', { default: 1, min: 1 }) ?? 1;
    const limit = parseQueryInt(searchParams, 'limit', { default: 25, min: 1, max: 100 }) ?? 25;

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
    // XC-01/INF-02: parser ApiErrors surface as their 400; unknown
    // errors are logged and returned as a generic, leak-free 500.
    return toErrorResponse(error, 'GET batches');
  }
}
