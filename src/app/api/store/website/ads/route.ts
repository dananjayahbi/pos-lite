import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWebsiteConfig, getAds, createAd, upsertWebsiteConfig } from '@/lib/services/website.service';
import { WebsiteAdSchema } from '@/lib/validators/website.validators';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const ads = await getAds(session.user.tenantId);
    return NextResponse.json({ success: true, data: ads });
  } catch (error) {
    console.error('GET /api/store/website/ads error:', error);
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
    const parsed = WebsiteAdSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid ad', details: parsed.error.flatten() },
        },
        { status: 400 },
      );
    }

    const ad = await createAd(
      session.user.tenantId,
      existingConfig.id,
      parsed.data as unknown as Record<string, unknown>,
    );
    return NextResponse.json({ success: true, data: ad }, { status: 201 });
  } catch (error) {
    console.error('POST /api/store/website/ads error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
