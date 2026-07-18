import { prisma } from '@/lib/prisma';

export type TenantBranding = {
  name: string;
  logoUrl: string | null;
};

const DEFAULT_BRANDING: TenantBranding = {
  name: 'VelvetPOS',
  logoUrl: null,
};

/**
 * Fetch the branding info (name + logo) for a tenant.
 * Returns a safe default if the tenant is not found.
 */
export async function getTenantBranding(
  tenantId: string | undefined | null,
): Promise<TenantBranding> {
  if (!tenantId) return DEFAULT_BRANDING;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, logoUrl: true },
    });

    if (!tenant) return DEFAULT_BRANDING;

    return {
      name: tenant.name || DEFAULT_BRANDING.name,
      logoUrl: tenant.logoUrl,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}
