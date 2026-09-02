/**
 * Website configuration API — public, read-only.
 *
 * Wraps the ERP `/api/public/site/[tenantSlug]/config` endpoint
 * with caching and tenant-scoped tags.
 */

import { apiGet, apiFetch } from '@/lib/api/client';
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

/** Public appointment service exposed to the customer booking page. */
export interface PublicAppointmentService {
  id: string;
  name: string;
  description?: string | null;
  durationMins: number;
  price: string | number;
  color?: string | null;
}

/** Public available time slot. */
export interface PublicAppointmentSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  staffId?: string | null;
  staff?: { id: string; email: string } | null;
}

/** Payload used to submit a public booking. */
export interface PublicBookingInput {
  walkInName: string;
  walkInPhone: string;
  serviceId?: string | null;
  slotId?: string | null;
  staffId?: string | null;
  startTime: string;
  endTime: string;
  durationMins: number;
  price: number;
  notes?: string | null;
}

/**
 * Fetch public appointment services for the customer booking page.
 * Returns an empty array when the appointments module is disabled.
 */
export async function getPublicAppointmentServices(
  tenantSlug: string,
): Promise<PublicAppointmentService[]> {
  const res = await apiGet<{ success: boolean; data: PublicAppointmentService[] }>(
    `/api/public/site/${encodeURIComponent(tenantSlug)}/appointment-services`,
    { tags: [`appointments:${tenantSlug}`] },
  );
  return res?.data ?? [];
}

/**
 * Fetch available appointment slots for a given date.
 */
export async function getPublicAppointmentSlots(
  tenantSlug: string,
  date: string,
  serviceId?: string,
): Promise<PublicAppointmentSlot[]> {
  const params = new URLSearchParams({ date });
  if (serviceId) params.set('serviceId', serviceId);
  const res = await apiGet<{ success: boolean; data: PublicAppointmentSlot[] }>(
    `/api/public/site/${encodeURIComponent(tenantSlug)}/appointments/slots?${params.toString()}`,
    { tags: [`appointments-slots:${tenantSlug}`], revalidate: 30 },
  );
  return res?.data ?? [];
}

/**
 * Submit a public appointment booking (walk-in).
 */
export async function createPublicAppointment(
  tenantSlug: string,
  input: PublicBookingInput,
): Promise<{ success: boolean; data: unknown }> {
  return apiFetch<{ success: boolean; data: unknown }>(
    `/api/public/site/${encodeURIComponent(tenantSlug)}/appointments`,
    {
      method: 'POST',
      body: JSON.stringify(input),
      noStore: true,
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