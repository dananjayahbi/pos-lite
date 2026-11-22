/**
 * Storage object-key extraction (ARGUS #476).
 *
 * The logo upload stores a file and returns only its public URL; the tenant row
 * keeps that URL. Replacing the logo used to leave the old object orphaned.
 * Deriving the provider-relative key from the URL lets the audited profile PATCH
 * delete the replaced asset after the new URL is committed.
 *
 * Pure so the URL shapes are testable without touching a storage provider.
 */

/** R2 public URLs are `${publicBase}/${key}`. */
export function r2ObjectKeyFromUrl(url: string, publicBase: string | undefined): string | null {
  if (!url || !publicBase) return null;
  const base = publicBase.replace(/\/+$/, '');
  if (!url.startsWith(`${base}/`)) return null;
  const key = url.slice(base.length + 1).split(/[?#]/)[0] ?? '';
  return key.length > 0 ? decodeURIComponent(key) : null;
}

/** Cloudinary destroy() wants the public id, without the transform/version prefix. */
export function cloudinaryPublicIdFromUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match?.[1]) return null;
  const withExtension = decodeURIComponent(match[1].split(/[?#]/)[0] ?? '');
  if (!withExtension) return null;
  return withExtension.replace(/\.[a-z0-9]+$/i, '');
}

/** Supabase public URLs are `.../storage/v1/object/public/<bucket>/<path>`. */
export function supabaseObjectKeyFromUrl(url: string, bucket = 'product-images'): string | null {
  if (!url) return null;
  const marker = `/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const key = url.slice(index + marker.length).split(/[?#]/)[0] ?? '';
  return key.length > 0 ? decodeURIComponent(key) : null;
}

/** True when the URL looks like an object this application stored (not a CDN/manual URL). */
export function isStoredAssetUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes('/object/public/')) return true;
  if (url.includes('/upload/')) return true;
  return false;
}
