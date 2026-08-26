import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getWebsiteConfig,
  upsertWebsiteConfig,
  replaceHeroSlides,
  replaceAds,
  resetWebsiteConfig,
} from '@/lib/services/website.service';
import {
  WebsiteConfigSchema,
  WebsiteHeroSlideSchema,
  WebsiteAdSchema,
} from '@/lib/validators/website.validators';
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

    // The core config is validated by `WebsiteConfigSchema`. Hero slides and
    // ads are stored as dedicated relation rows (the storefront's source of
    // truth), so they are reconciled separately rather than persisted in the
    // JSON blob. We validate each item so malformed rows never reach the DB.
    const rawHeroSlides = Array.isArray(body.heroSlides) ? body.heroSlides : undefined;
    const rawAds = Array.isArray(body.ads)
      ? (body.ads as Record<string, unknown>[]).map((ad) => ({
          ...ad,
          // The form's sanitizer converts null dates to '' — normalize back
          // to undefined so the datetime validator accepts them.
          startsAt: ad.startsAt && ad.startsAt !== '' ? ad.startsAt : undefined,
          endsAt: ad.endsAt && ad.endsAt !== '' ? ad.endsAt : undefined,
        }))
      : undefined;

    let heroSlides: z.infer<typeof WebsiteHeroSlideSchema>[] | undefined;
    if (rawHeroSlides !== undefined) {
      const parsedSlides = WebsiteHeroSlideSchema.array().safeParse(rawHeroSlides);
      if (!parsedSlides.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid hero slides',
              details: parsedSlides.error.flatten(),
            },
          },
          { status: 400 },
        );
      }
      // Persist only slides that actually have media; skip incomplete drafts.
      heroSlides = parsedSlides.data.filter(
        (s) => typeof s.mediaUrl === 'string' && s.mediaUrl.trim().length > 0,
      );
    }

    let ads: z.infer<typeof WebsiteAdSchema>[] | undefined;
    if (rawAds !== undefined) {
      const parsedAds = WebsiteAdSchema.array().safeParse(rawAds);
      if (!parsedAds.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid ads',
              details: parsedAds.error.flatten(),
            },
          },
          { status: 400 },
        );
      }
      // Persist only ads with a name and media; skip incomplete drafts.
      ads = parsedAds.data.filter(
        (a) =>
          typeof a.name === 'string' &&
          a.name.trim().length > 0 &&
          typeof a.mediaUrl === 'string' &&
          a.mediaUrl.trim().length > 0,
      );
    }

    const config = await upsertWebsiteConfig(tenantId, parsed.data, session.user.id);

    // Reconcile hero slides / ads relation rows to match the editor.
    if (heroSlides) {
      await replaceHeroSlides(config.id, tenantId, heroSlides);
    }
    if (ads) {
      await replaceAds(config.id, tenantId, ads);
    }

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

export async function DELETE() {
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

    const reset = await resetWebsiteConfig(tenantId);

    // Revalidate the storefront so the reset is reflected immediately.
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true },
      });
      if (tenant?.slug) {
        await revalidateWebsiteCache({
          tags: [`site-config:${tenant.slug}`, `tenant:${tenant.slug}`],
          paths: ['/', `/${tenant.slug}`, `/${tenant.slug}/shop`],
        });
      }
    } catch (revalidateErr) {
      console.warn('[DELETE /api/store/website] Revalidation warning:', revalidateErr);
    }

    return NextResponse.json({ success: true, data: { reset } });
  } catch (error) {
    console.error('DELETE /api/store/website error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
