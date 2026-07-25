import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWebsiteConfig, upsertWebsiteConfig } from '@/lib/services/website.service';
import { WebsiteConfigSchema } from '@/lib/validators/website.validators';
import { revalidateWebsiteCache } from '@/lib/revalidate-website';

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
      console.error('[PUT /api/store/website] Validation failed:', JSON.stringify(parsed.error.flatten(), null, 2));
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid website config',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    const config = await upsertWebsiteConfig(tenantId, parsed.data, session.user.id);

    // ── On-demand revalidation ─────────────────────────────────────────────
    // Notify the customer-facing website to purge its ISR / fetch cache
    // so changes appear immediately without waiting for the 60 s interval.
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true },
      });
      if (tenant?.slug) {
        // Revalidate pages and fetch caches for this tenant's storefront
        await revalidateWebsiteCache({
          tags: [
            `site-config:${tenant.slug}`,
            `tenant:${tenant.slug}`,
          ],
          paths: [
            '/',
            `/${tenant.slug}`,
            `/${tenant.slug}/shop`,
          ],
        });
      }
    } catch (revalidateErr) {
      // Don't fail the save if revalidation fails — log and continue
      console.warn('[PUT /api/store/website] Revalidation warning:', revalidateErr);
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('PUT /api/store/website error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
