import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWebsiteConfig, upsertWebsiteConfig } from '@/lib/services/website.service';
import { WebsiteConfigSchema } from '@/lib/validators/website.validators';

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

    const config = await getWebsiteConfig(tenantId);
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('GET /api/store/website error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
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

    const body = await request.json();
    const parsed = WebsiteConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid website config', details: parsed.error.flatten() },
        },
        { status: 400 },
      );
    }

    const config = await upsertWebsiteConfig(tenantId, parsed.data, session.user.id);
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('PUT /api/store/website error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
