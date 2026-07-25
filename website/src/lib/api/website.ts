/**
 * Website configuration API — public, read-only.
 *
 * Wraps the ERP `/api/public/site/[tenantSlug]/config` endpoint
 * with caching and tenant-scoped tags.
 */

import { apiGet } from '@/lib/api/client';
import type { WebsiteConfigData, PublicTenantInfo } from '@/types/website.types';

export interface PublicWebsiteResponse {
  tenant: PublicTenantInfo;
  config: WebsiteConfigData | null;
}

/**
 * Fetch the public website configuration for a tenant.
 *
 * Returns `null` when the tenant has no website configured yet
 * (the storefront then renders with safe defaults).
 */
export async function getPublicWebsiteConfig(
  tenantSlug: string,
): Promise<PublicWebsiteResponse | null> {
  return apiGet<PublicWebsiteResponse | null>(
    `/api/public/site/${encodeURIComponent(tenantSlug)}/config`,
    {
      tags: [`site-config:${tenantSlug}`],
    },
  );
}

/** Resolve a tenant slug to its display name/logo (lightweight). */
export async function getTenantInfo(tenantSlug: string): Promise<PublicTenantInfo | null> {
  const data = await apiGet<PublicTenantResponse | null>(
    `/api/public/site/${encodeURIComponent(tenantSlug)}/tenant`,
    {
      tags: [`tenant:${tenantSlug}`],
    },
  );
  return data?.tenant ?? null;
}

interface PublicTenantResponse {
  tenant: PublicTenantInfo;
}