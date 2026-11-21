import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getPackagingConsumptionHistory } from '@/lib/services/packaging.service';
import { PackagingHistoryQuerySchema } from '@/lib/validators/packaging.validators';

/**
 * ARGUS #281: read-only packaging consumption ledger.
 * Bounded by the shared schema (default 25, max 100 rows per page).
 */
export async function GET(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.managePackaging);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const parsed = PackagingHistoryQuerySchema.safeParse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    itemId: url.searchParams.get('itemId') ?? undefined,
  });
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    return validationError(errors, 'Validation failed');
  }

  try {
    const result = await getPackagingConsumptionHistory(guard.tenantId, parsed.data);
    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        page: result.page,
        limit: result.pageSize,
        total: result.total,
        hasMore: result.page * result.pageSize < result.total,
      },
    });
  } catch (error) {
    console.error('GET /api/store/packaging/history error:', error);
    return internalError('An unexpected error occurred');
  }
}
