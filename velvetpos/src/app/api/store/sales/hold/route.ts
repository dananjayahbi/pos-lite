import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { HoldSaleSchema } from '@/lib/validators/sale.validators';
import { createHeldSale, updateHeldSale } from '@/lib/services/sale.service';

export async function POST(request: Request) {
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

    if (!hasPermission(session.user, PERMISSIONS.SALE.holdSale)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = HoldSaleSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const inputWithCashier = { ...parsed.data, cashierId: session.user.id };

    // If an existing held sale ID is supplied, update it in-place
    let sale;
    if (parsed.data.saleId) {
      try {
        sale = await updateHeldSale(tenantId, parsed.data.saleId, inputWithCashier);
      } catch {
        // Held sale not found (e.g. already completed) — fall through to create a new one
        sale = await createHeldSale(tenantId, inputWithCashier);
      }
    } else {
      sale = await createHeldSale(tenantId, inputWithCashier);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: sale.id,
          shortId: sale.id.slice(0, 6).toUpperCase(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/store/sales/hold error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } },
      { status: 500 },
    );
  }
}

