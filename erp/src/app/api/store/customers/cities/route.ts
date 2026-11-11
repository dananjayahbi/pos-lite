import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { SRI_LANKA_CITIES } from '@/lib/constants/sri-lanka-cities';
import { getCachedLocations } from '@/lib/services/location-sync.service';
import { buildCustomerCityOptions } from '@/lib/utils/customer-cities';
import { toErrorResponse } from '@/lib/api/error-envelope';

/**
 * City options for the customer create/edit form.
 *
 * Reads the tenant's cached Trans Express master locations (synced by the
 * delivery module) and falls back to a curated Sri Lankan city list when no
 * cache exists. Gated on `customer:view` so cashiers can also create customers
 * without needing courier-settings permissions.
 */
export async function GET() {
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

    if (!hasPermission(session.user, PERMISSIONS.CUSTOMER.viewCustomer)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const cache = await getCachedLocations(tenantId);
    const { cities, source } = buildCustomerCityOptions(
      cache?.cities ?? [],
      SRI_LANKA_CITIES,
    );

    return NextResponse.json({
      success: true,
      data: { cities, source, syncedAt: cache?.syncedAt ?? null },
    });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/customers/cities');
  }
}
