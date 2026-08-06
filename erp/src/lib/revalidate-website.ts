/**
 * Send on-demand revalidation requests to the customer-facing website.
 *
 * After the ERP saves website configuration (or hero slides, ads, etc.),
 * this module notifies the website to purge its ISR / fetch cache so
 * changes appear immediately without needing a restart or waiting for
 * the revalidation interval.
 *
 * Uses Next.js on-demand ISR via the website's `/api/revalidate` endpoint.
 * Both apps share a `REVALIDATION_SECRET` for authorization.
 */

const WEBSITE_URL = process.env.WEBSITE_URL || 'http://localhost:3002';
const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET;

export interface RevalidationPayload {
  tags?: string[];
  paths?: string[];
}

/**
 * Request the website to purge cached data for the given tags and paths.
 *
 * @example
 *   await revalidateWebsite({
 *     tags: [`site-config:${slug}`],
 *     paths: ['/', `/${slug}`],
 *   });
 *
 * Fails silently — a down website server or missing secret should not
 * block the ERP save operation.
 */
/**
 * Revalidate the storefront for a tenant after catalog/config mutations.
 *
 * Resolves the tenant slug from `tenantId` (the tenant must exist), then
 * purges the relevant fetch tags and ISR paths on the customer-facing
 * website so catalog & config changes appear immediately instead of
 * waiting for the revalidate interval.
 *
 * Call from any ERP mutation route (product create/update/archive/delete,
 * variant changes, bulk price updates, imports, hero slides, ads, etc.).
 *
 * @param tenantId - The tenant owning the mutated data.
 * @param opts.productIds - Product detail pages to revalidate (if any).
 * @param opts.config - Also purge website config (hero slides, ads, layout).
 * @param opts.catalog - Also purge category/brand filter caches.
 */
export async function revalidateTenantStorefront(
  tenantId: string,
  opts: { productIds?: string[]; config?: boolean; catalog?: boolean } = {},
): Promise<void> {
  // Resolve tenant slug — required to build cache tags / paths.
  const { prisma } = await import('@/lib/prisma');
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  if (!tenant?.slug) {
    console.warn(
      `[revalidate-website] Tenant ${tenantId} not found — skipping revalidation`,
    );
    return;
  }

  const slug = tenant.slug;
  const tags = new Set<string>(['tenant:' + slug, 'products:' + slug]);
  const paths = new Set<string>([`/${slug}`, `/${slug}/shop`]);

  if (opts.productIds && opts.productIds.length > 0) {
    for (const pid of opts.productIds) {
      tags.add('product:' + pid);
      paths.add(`/${slug}/product/${pid}`);
    }
  }

  if (opts.config) {
    tags.add('site-config:' + slug);
    paths.add(`/${slug}`);
  }

  if (opts.catalog) {
    tags.add('categories:' + slug);
    tags.add('brands:' + slug);
  }

  await revalidateWebsiteCache({ tags: [...tags], paths: [...paths] });
}

export async function revalidateWebsiteCache(
  payload: RevalidationPayload,
): Promise<void> {
  if (!REVALIDATION_SECRET) {
    console.warn(
      '[revalidate-website] REVALIDATION_SECRET not set — skipping revalidation. ' +
        'Add REVALIDATION_SECRET to the ERP .env.local file.',
    );
    return;
  }

  const url = `${WEBSITE_URL}/api/revalidate`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REVALIDATION_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.warn(
        `[revalidate-website] Website returned ${res.status}: ${JSON.stringify(body)}`,
      );
      return;
    }

    console.log('[revalidate-website] Successfully revalidated:', payload);
  } catch (err) {
    // Website may be down or unreachable — log but don't fail the ERP save
    console.warn(
      `[revalidate-website] Failed to reach website at ${url}:`,
      (err as Error).message,
    );
  }
}
