import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { updatePromotion, deactivatePromotion, setPromotionActive } from '@/lib/services/promotion.service';
import { UpdatePromotionSchema } from '@/lib/validators/promotion.validators';
import { toErrorResponse } from '@/lib/api/error-envelope';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    if (!hasPermission(session.user, PERMISSIONS.PROMOTION.editPromotion)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = UpdatePromotionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error?.issues?.[0]?.message ?? 'Validation failed' } },
        { status: 400 },
      );
    }

    // ARGUS #325: an explicit status-only PATCH is Activate/Deactivate, not a
    // generic edit — it writes the ACTIVATED/ARCHIVED audit action.
    const changedKeys = Object.keys(parsed.data);
    if (changedKeys.length === 1 && changedKeys[0] === 'isActive') {
      const promotion = await setPromotionActive(
        tenantId,
        id,
        parsed.data.isActive === true,
        session.user.id,
      );
      return NextResponse.json({ success: true, data: promotion });
    }

    const promotion = await updatePromotion(tenantId, id, parsed.data);
    return NextResponse.json({ success: true, data: promotion });
  } catch (error) {
    // ARGUS #328/#330: foreign/missing ids are 404 NOT_FOUND (not 500), and
    // duplicate promo codes are 409 CONFLICT.
    return toErrorResponse(error, 'PATCH /api/store/promotions/[id]');
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    if (!hasPermission(session.user, PERMISSIONS.PROMOTION.deletePromotion)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const promotion = await deactivatePromotion(tenantId, id, session.user.id);
    return NextResponse.json({ success: true, data: promotion });
  } catch (error) {
    return toErrorResponse(error, 'DELETE /api/store/promotions/[id]');
  }
}
