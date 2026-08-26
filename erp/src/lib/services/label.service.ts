import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getTenantBranding } from '@/lib/tenant-branding';
import { DEFAULT_LABEL_TEMPLATE } from '@/lib/constants/label';
import type { DeliveryLabelTemplate } from '@/types/delivery-label';
import type { LabelTemplateInput } from '@/lib/validators/label.validators';

/** Read the raw saved template from `Tenant.settings.delivery.label` (may be partial). */
function readSaved(settings: unknown): Partial<DeliveryLabelTemplate> | null {
  if (!settings || typeof settings !== 'object') return null;
  const delivery = (settings as Record<string, unknown>).delivery;
  if (!delivery || typeof delivery !== 'object') return null;
  const saved = (delivery as Record<string, unknown>).label as Partial<DeliveryLabelTemplate> | undefined;
  return saved ?? null;
}

/**
 * Resolve the effective template: merge saved over defaults, then fill any empty
 * brand/logo from the tenant branding. Never throws for a missing/corrupt blob.
 */
export async function getLabelTemplate(tenantId: string): Promise<DeliveryLabelTemplate> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const saved = readSaved(tenant?.settings);
  const branding = await getTenantBranding(tenantId);

  const merged = { ...DEFAULT_LABEL_TEMPLATE, ...(saved ?? {}) } as DeliveryLabelTemplate;

  return {
    ...merged,
    brandName: merged.brandName?.trim() ? merged.brandName : branding.name,
    logoUrl: merged.logoUrl?.trim() ? merged.logoUrl : branding.logoUrl,
  };
}

/** Persist a validated template under the tenant settings JSON. */
export async function saveLabelTemplate(
  tenantId: string,
  input: LabelTemplateInput,
): Promise<DeliveryLabelTemplate> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });

  const current = (tenant?.settings ?? {}) as Record<string, unknown>;
  const delivery =
    current.delivery && typeof current.delivery === 'object'
      ? { ...(current.delivery as Record<string, unknown>) }
      : {};

  const normalized: LabelTemplateInput = {
    ...input,
    logoUrl: input.logoUrl?.trim() ? input.logoUrl : null,
  };

  const nextSettings: Prisma.InputJsonValue = {
    ...current,
    delivery: { ...delivery, label: normalized as unknown as Prisma.InputJsonValue },
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: nextSettings },
  });

  return getLabelTemplate(tenantId);
}

/** Clear the saved template, returning the default (branding-resolved) template. */
export async function resetLabelTemplate(tenantId: string): Promise<DeliveryLabelTemplate> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });

  const current = { ...((tenant?.settings ?? {}) as Record<string, unknown>) };
  const delivery =
    current.delivery && typeof current.delivery === 'object'
      ? { ...(current.delivery as Record<string, unknown>) }
      : {};
  delete delivery.label;
  current.delivery = delivery;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: current as Prisma.InputJsonValue },
  });

  return getLabelTemplate(tenantId);
}
