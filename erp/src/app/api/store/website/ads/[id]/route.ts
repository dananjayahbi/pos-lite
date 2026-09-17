import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { updateAd, deleteAd } from '@/lib/services/website.service';
import { UpdateWebsiteAdSchema } from '@/lib/validators/website.validators';
import { revalidateTenantStorefront } from '@/lib/revalidate-website';
import { toErrorResponse } from '@/lib/api/error-envelope';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateWebsiteAdSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid ad update', details: parsed.error.flatten() },
        },
        { status: 400 },
      );
    }

    // M29-03 (OBS-41): website CMS write — owner/manager permission.
    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.SETTINGS.manageWebsite);
    if (forbidden) return forbidden;

    // M29-01/BUG-68: the ad id is client-controlled, so the mutation is
    // scoped to the caller's tenant — a foreign id fails closed as 404.
    const ad = await updateAd(
      session.user.tenantId,
      id,
      parsed.data as unknown as Record<string, unknown>,
    );

    // Revalidate the storefront config so the ad change appears immediately.
    try {
      await revalidateTenantStorefront(session.user.tenantId, { config: true });
    } catch (revalidateErr) {
      console.warn('[PATCH /api/store/website/ads/[id]] Revalidation warning:', revalidateErr);
    }

    return NextResponse.json({ success: true, data: ad });
  } catch (error) {
    // INF-02: thrown ApiErrors (404 cross-tenant miss) keep their status/code.
    return toErrorResponse(error, 'PATCH /api/store/website/ads/[id]');
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    // M29-03 (OBS-41): website CMS write — owner/manager permission.
    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.SETTINGS.manageWebsite);
    if (forbidden) return forbidden;

    const { id } = await params;
    // M29-01/BUG-68: tenant-scoped delete — see PATCH above.
    await deleteAd(session.user.tenantId, id);

    // Revalidate the storefront config so the removed ad disappears immediately.
    try {
      await revalidateTenantStorefront(session.user.tenantId, { config: true });
    } catch (revalidateErr) {
      console.warn('[DELETE /api/store/website/ads/[id]] Revalidation warning:', revalidateErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, 'DELETE /api/store/website/ads/[id]');
  }
}
