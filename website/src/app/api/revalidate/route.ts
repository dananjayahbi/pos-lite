import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET;

/**
 * On-demand revalidation endpoint for ISR.
 *
 * Called by the ERP admin after data changes (website config, products, etc.).
 * Uses a shared secret to prevent unauthorized cache purges.
 *
 * Body:
 *   { tags?: string[], paths?: string[] }
 *
 * Tags correspond to the cache tags in lib/api/*.ts:
 *   - site-config:{slug}   — website config
 *   - tenant:{slug}        — tenant info
 *   - products:{slug}      — product lists
 *   - categories:{slug}    — categories
 *   - brands:{slug}        — brands
 *
 * Paths correspond to Next.js page paths:
 *   - /                        — homepage
 *   - /{slug}                  — tenant storefront
 *   - /{slug}/shop             — shop page
 *   - /{slug}/product/{id}     — product detail
 *   - /{slug}/category/{id}    — category page
 */
export async function POST(request: Request): Promise<Response> {
  // 1. Validate secret
  if (!REVALIDATION_SECRET) {
    return NextResponse.json(
      { success: false, error: 'REVALIDATION_SECRET not configured on the website' },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token !== REVALIDATION_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing revalidation token' },
      { status: 401 },
    );
  }

  // 2. Parse body
  let body: { tags?: string[]; paths?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const tags = body.tags ?? [];
  const paths = body.paths ?? [];

  if (tags.length === 0 && paths.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No tags or paths provided' },
      { status: 400 },
    );
  }

  // 3. Revalidate tags (purges fetch cache for tagged requests)
  const results = { tags: [] as string[], paths: [] as string[] };

  for (const tag of tags) {
    try {
      revalidateTag(tag);
      results.tags.push(tag);
    } catch (err) {
      console.error(`[revalidate] Failed to revalidate tag "${tag}":`, err);
    }
  }

  // 4. Revalidate paths (purges ISR page cache)
  for (const path of paths) {
    try {
      revalidatePath(path, 'layout');
      results.paths.push(path);
    } catch (err) {
      console.error(`[revalidate] Failed to revalidate path "${path}":`, err);
    }
  }

  console.log(`[revalidate] Revalidated tags: [${results.tags.join(', ')}], paths: [${results.paths.join(', ')}]`);

  return NextResponse.json({ success: true, results });
}
