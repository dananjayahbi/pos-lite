/**
 * Extract the storage key for a tenant-owned website asset from a public URL
 * or bare path (ARGUS #496).
 *
 * Uploads live under `<tenantId>/website/...` in every provider's key/folder
 * (R2 key, Supabase object path, Cloudinary public_id/folder). A caller may only
 * delete a key that belongs to its own tenant; foreign paths and traversal
 * attempts return null and are rejected by the route.
 */
export function extractTenantAssetPath(raw: string, tenantId: string): string | null {
  if (!raw || !tenantId) return null;

  let path: string;
  try {
    path = new URL(raw).pathname;
  } catch {
    path = raw;
  }

  path = path.replace(/^\/+/, '');
  try {
    path = decodeURIComponent(path);
  } catch {
    // Keep the undecoded value; the tenant check below still applies.
  }

  if (path.includes('..') || path.includes('\\')) return null;

  const segments = path.split('/').filter(Boolean);
  const index = segments.indexOf(tenantId);
  if (index === -1) return null;

  // Provider URLs place the key either at the root (R2) or under a known
  // storage folder (Cloudinary `website-images`, Supabase `product-images`).
  const KNOWN_PREFIXES = new Set(['website-images', 'website-videos', 'product-images']);
  if (index === 0) return segments.join('/');
  if (KNOWN_PREFIXES.has(segments[index - 1]!)) return segments.slice(index).join('/');

  return null;
}
