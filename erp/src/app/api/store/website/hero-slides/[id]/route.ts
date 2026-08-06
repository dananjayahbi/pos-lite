import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateHeroSlide, deleteHeroSlide } from '@/lib/services/website.service';
import { UpdateWebsiteHeroSlideSchema } from '@/lib/validators/website.validators';
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
    const parsed = UpdateWebsiteHeroSlideSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid hero slide update', details: parsed.error.flatten() },
        },
        { status: 400 },
      );
    }

    const slide = await updateHeroSlide(id, parsed.data as unknown as Record<string, unknown>);

    // Revalidate the storefront config so the hero slide change appears immediately.
    try {
      await revalidateTenantStorefront(session.user.tenantId, { config: true });
    } catch (revalidateErr) {
      console.warn('[PATCH /api/store/website/hero-slides/[id]] Revalidation warning:', revalidateErr);
    }

    return NextResponse.json({ success: true, data: slide });
  } catch (error) {
    console.error('PATCH /api/store/website/hero-slides/[id] error:', error);
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
    await deleteHeroSlide(id);

    // Revalidate the storefront config so the removed hero slide disappears immediately.
    try {
      await revalidateTenantStorefront(session.user.tenantId, { config: true });
    } catch (revalidateErr) {
      console.warn('[DELETE /api/store/website/hero-slides/[id]] Revalidation warning:', revalidateErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/store/website/hero-slides/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
