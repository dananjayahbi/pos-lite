import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { ok, toErrorResponse } from '@/lib/api/error-envelope';
import { summarizeCustomerTags } from '@/lib/services/customerTag.core';

/**
 * ARGUS #333 — distinct customer tags for the customer-pricing tag picker.
 *
 * GET /api/store/customers/tags
 * Returns `[{ tag, customerCount }]` with canonical (upper-case) tags.
 * Read-only and tenant-scoped; gated on `customer:view`.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }

    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.CUSTOMER.viewCustomer);
    if (forbidden) return forbidden;

    const customers = await prisma.customer.findMany({
      where: { tenantId, deletedAt: null },
      select: { tags: true },
    });

    return ok(summarizeCustomerTags(customers.map((customer) => customer.tags)));
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/customers/tags');
  }
}
