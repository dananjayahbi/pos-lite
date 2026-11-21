import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { listBomEligibleVariants } from '@/lib/services/bom.service';
import { toErrorResponse } from '@/lib/api/error-envelope';

/**
 * ARGUS #250 - the New BOM picker only offers variants that can actually
 * receive a recipe: live MANUFACTURED variants without an existing BOM.
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
    if (!hasPermission(session.user, PERMISSIONS.BOM.createBom)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const variants = await listBomEligibleVariants(tenantId);
    return NextResponse.json({ success: true, data: variants });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/bom/eligible-variants');
  }
}
