import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getSaleById } from '@/lib/services/sale.service';
import { resolveSaleIdByReference } from '@/lib/services/returnReference';
import { toErrorResponse } from '@/lib/api/error-envelope';

/**
 * GET /api/store/returns/sale-lookup?reference=CMWGA0KT
 *
 * ARGUS #98: the Process Return sheet accepts the printed 8-character sale
 * reference shown on receipts/tables instead of requiring the full cuid.
 * Tenant-scoped; an ambiguous prefix is a typed 409.
 */
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

    if (!hasPermission(session.user, PERMISSIONS.SALE.viewSale)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const reference = request.nextUrl.searchParams.get('reference') ?? '';
    const saleId = await resolveSaleIdByReference(tenantId, reference);
    const sale = await getSaleById(tenantId, saleId);

    return NextResponse.json({ success: true, data: sale });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/returns/sale-lookup');
  }
}
