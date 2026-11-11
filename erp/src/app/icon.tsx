import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

/**
 * Tenant-aware favicon.
 *
 * The ERP is multi-tenant, so the browser tab icon must match the tenant the
 * operator is signed in to instead of a fixed AyurPOS mark. The tenant is
 * resolved, most-specific first, from:
 *
 *   1. the `x-tenant-slug` header `src/proxy.ts` sets for tenant subdomains,
 *   2. the request host against `Tenant.customDomain` (e.g. a white-labelled
 *      admin domain),
 *   3. the signed-in session's tenant,
 *   4. the first active tenant as a safe fallback for unauthenticated requests
 *      such as the login page.
 *
 * The configured logo is fetched server-side and embedded as a data URL so
 * `ImageResponse` never has to chase a remote image mid-render. Any failure
 * (missing logo, unsupported format, network error) falls back to the existing
 * initial-letter icon, which keeps the favicon available even when branding is
 * misconfigured.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

interface TenantIconInfo {
  name: string;
  logoUrl: string | null;
}

const SUPPORTED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

async function loadLogoDataUrl(url: string | null): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    if (!SUPPORTED_LOGO_TYPES.has(contentType)) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024) return null;

    return `data:${contentType};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

async function resolveTenantIconInfo(): Promise<TenantIconInfo | null> {
  try {
    const requestHeaders = await headers();

    const slug = requestHeaders.get('x-tenant-slug')?.trim();
    if (slug) {
      const bySlug = await prisma.tenant.findFirst({
        where: { slug, deletedAt: null },
        select: { name: true, logoUrl: true },
      });
      if (bySlug) return bySlug;
    }

    const host = requestHeaders.get('host')?.split(':')[0]?.trim();
    if (host) {
      const byDomain = await prisma.tenant.findFirst({
        where: { customDomain: host, deletedAt: null },
        select: { name: true, logoUrl: true },
      });
      if (byDomain) return byDomain;

      const suffix = '.ayurpos.com';
      if (host.endsWith(suffix)) {
        const subdomain = host.slice(0, -suffix.length);
        const bySubdomain = await prisma.tenant.findFirst({
          where: { slug: subdomain, deletedAt: null },
          select: { name: true, logoUrl: true },
        });
        if (bySubdomain) return bySubdomain;
      }
    }
  } catch {
    // Header/DB lookup is best-effort; fall through to the session/fallback.
  }

  try {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (tenantId) {
      const bySession = await prisma.tenant.findFirst({
        where: { id: tenantId, deletedAt: null },
        select: { name: true, logoUrl: true },
      });
      if (bySession) return bySession;
    }
  } catch {
    // Unauthenticated favicon requests have no session — expected.
  }

  try {
    return await prisma.tenant.findFirst({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { name: true, logoUrl: true },
      orderBy: { createdAt: 'asc' },
    });
  } catch {
    return null;
  }
}

export default async function Icon() {
  const tenant = await resolveTenantIconInfo();
  const initial = tenant?.name?.charAt(0).toUpperCase() || 'A';
  const logo = await loadLogoDataUrl(tenant?.logoUrl ?? null);

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: logo ? '#FFFFFF' : '#3B2A1F',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F5F0EB',
          borderRadius: 6,
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 700,
          overflow: 'hidden',
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={tenant?.name ? `${tenant.name} logo` : 'Tenant logo'}
            width={32}
            height={32}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          initial
        )}
      </div>
    ),
    { ...size },
  );
}
