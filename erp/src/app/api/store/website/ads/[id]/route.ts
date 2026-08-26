import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateAd, deleteAd } from '@/lib/services/website.service';
import { UpdateWebsiteAdSchema } from '@/lib/validators/website.validators';
import { revalidateTenantStorefront } from '@/lib/revalidate-website';

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

    const ad = await updateAd(id, parsed.data as unknown as Record<string, unknown>);

    // Revalidate the storefront config so the ad change appears immediately.
    try {
      await revalidateTenantStorefront(session.user.tenantId, { config: true });
    } catch (revalidateErr) {
      console.warn('[PATCH /api/store/website/ads/[id]] Revalidation warning:', revalidateErr);
    }

    return NextResponse.json({ success: true, data: ad });
  } catch (error) {
    console.error('PATCH /api/store/website/ads/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
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

    const { id } = await params;
    await deleteAd(id);

    // Revalidate the storefront config so the removed ad disappears immediately.
    try {
      await revalidateTenantStorefront(session.user.tenantId, { config: true });
    } catch (revalidateErr) {
      console.warn('[DELETE /api/store/website/ads/[id]] Revalidation warning:', revalidateErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/store/website/ads/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
