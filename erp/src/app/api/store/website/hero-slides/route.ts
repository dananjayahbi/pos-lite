import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWebsiteConfig, createHeroSlide, upsertWebsiteConfig } from '@/lib/services/website.service';
import { WebsiteHeroSlideSchema } from '@/lib/validators/website.validators';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const config = await getWebsiteConfig(session.user.tenantId);
    if (!config) {
      return NextResponse.json({ success: true, data: [] });
    }

    return NextResponse.json({ success: true, data: config.heroSlides });
  } catch (error) {
    console.error('GET /api/store/website/hero-slides error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    // Ensure config exists
    let existingConfig = await getWebsiteConfig(session.user.tenantId);
    if (!existingConfig) {
      await upsertWebsiteConfig(session.user.tenantId, {}, session.user.id);
      existingConfig = await getWebsiteConfig(session.user.tenantId);
    }
    if (!existingConfig) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create config' } },
        { status: 500 },
      );
    }

    const body = await request.json();
    const parsed = WebsiteHeroSlideSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid hero slide', details: parsed.error.flatten() },
        },
        { status: 400 },
      );
    }

    const slide = await createHeroSlide(
      session.user.tenantId,
      existingConfig.id,
      parsed.data as unknown as Record<string, unknown>,
    );
    return NextResponse.json({ success: true, data: slide }, { status: 201 });
  } catch (error) {
    console.error('POST /api/store/website/hero-slides error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
