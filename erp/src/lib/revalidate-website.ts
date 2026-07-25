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
