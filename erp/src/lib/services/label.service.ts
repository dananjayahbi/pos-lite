import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveWaybillSender } from '@/lib/delivery/sender';
import type { DeliveryLabelTemplate, LabelBranding } from '@/types/delivery-label';
import type { LabelTemplateInput } from '@/lib/validators/label.validators';

/** Read the raw saved template from `Tenant.settings.delivery.label` (may be partial). */
function readSaved(settings: unknown): Partial<DeliveryLabelTemplate> | null {
  if (!settings || typeof settings !== 'object') return null;
  const delivery = (settings as Record<string, unknown>).delivery;
  if (!delivery || typeof delivery !== 'object') return null;
  const saved = (delivery as Record<string, unknown>).label as Partial<DeliveryLabelTemplate> | undefined;
  return saved ?? null;
}

/** Read the tenant's client-facing branding fallback (name/address/contact). */
function readBranding(
  name: string | null | undefined,
  settings: unknown,
): LabelBranding {
  const values =
    settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
  return {
    name: name?.trim() || '',
    address: typeof values.address === 'string' ? values.address : '',
    phoneNumber: typeof values.phoneNumber === 'string' ? values.phoneNumber : '',
  };
}

export interface LabelTemplateBundle {
  template: DeliveryLabelTemplate;
  branding: LabelBranding;
  /** False when the tenant has never saved a template (defaults are in use). */
  saved: boolean;
}

/**
 * Resolve the template plus the tenant branding needed by the client fallback
 * (ARGUS #298). One tenant read, so the GET route can return both atomically.
 */
export async function getLabelTemplateBundle(tenantId: string): Promise<LabelTemplateBundle> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, settings: true },
  });
  const saved = readSaved(tenant?.settings);
  const branding = readBranding(tenant?.name, tenant?.settings);

  // ARGUS #301: the audited Store Profile is the sender. A stale saved label
  // brand/contact must never override the business name or pickup address.
  const sender = resolveWaybillSender({
    name: branding.name,
    contact: branding.phoneNumber,
    pickupAddress: branding.address,
  });

  return {
    template: {
      brandName: sender.name,
      fromContact: sender.contact,
      pickupAddress: sender.pickupAddress,
    },
    branding,
    saved: saved !== null,
  };
}

/**
 * Resolve the effective template: merge saved over defaults, then fill an empty
 * sender name from the tenant branding. Never throws for a missing/corrupt blob.
 */
export async function getLabelTemplate(tenantId: string): Promise<DeliveryLabelTemplate> {
  return (await getLabelTemplateBundle(tenantId)).template;
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
    brandName: input.brandName,
    fromContact: input.fromContact,
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
