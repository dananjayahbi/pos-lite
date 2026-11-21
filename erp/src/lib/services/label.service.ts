import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveWaybillSender } from '@/lib/delivery/sender';
import {
  EMPTY_LABEL_TEMPLATE_META,
  type DeliveryLabelTemplate,
  type LabelBranding,
  type LabelTemplateHistoryEntry,
  type LabelTemplateMeta,
} from '@/types/delivery-label';
import type { LabelTemplateInput } from '@/lib/validators/label.validators';

/** The acting user recorded on a template write. */
export interface LabelTemplateActor {
  id: string;
  email: string;
  role: string;
}

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
  /** Who last saved/reset the template, and when. */
  meta: LabelTemplateMeta;
}

function readMeta(settings: unknown): LabelTemplateMeta {
  if (!settings || typeof settings !== 'object') return { ...EMPTY_LABEL_TEMPLATE_META };
  const delivery = (settings as Record<string, unknown>).delivery;
  if (!delivery || typeof delivery !== 'object') return { ...EMPTY_LABEL_TEMPLATE_META };
  const raw = (delivery as Record<string, unknown>).labelMeta;
  if (!raw || typeof raw !== 'object') return { ...EMPTY_LABEL_TEMPLATE_META };
  const meta = raw as Record<string, unknown>;
  const action = meta.action === 'saved' || meta.action === 'reset' ? meta.action : null;
  return {
    updatedAt: typeof meta.updatedAt === 'string' ? meta.updatedAt : null,
    updatedById: typeof meta.updatedById === 'string' ? meta.updatedById : null,
    updatedByEmail: typeof meta.updatedByEmail === 'string' ? meta.updatedByEmail : null,
    updatedByRole: typeof meta.updatedByRole === 'string' ? meta.updatedByRole : null,
    action,
  };
}

function actorMeta(actor?: LabelTemplateActor): LabelTemplateMeta {
  if (!actor) return { ...EMPTY_LABEL_TEMPLATE_META };
  return {
    updatedAt: new Date().toISOString(),
    updatedById: actor.id,
    updatedByEmail: actor.email,
    updatedByRole: actor.role,
    action: null,
  };
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
    meta: readMeta(tenant?.settings),
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
  actor?: LabelTemplateActor,
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
    delivery: {
      ...delivery,
      label: normalized as unknown as Prisma.InputJsonValue,
      labelMeta: { ...actorMeta(actor), action: 'saved' } as unknown as Prisma.InputJsonValue,
    },
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: nextSettings },
  });

  return getLabelTemplate(tenantId);
}

/** Clear the saved template, returning the default (branding-resolved) template. */
export async function resetLabelTemplate(
  tenantId: string,
  actor?: LabelTemplateActor,
): Promise<DeliveryLabelTemplate> {
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
  // Keep the provenance of the reset so the designer can still say who undid
  // the saved overrides and when.
  delivery.labelMeta = {
    ...actorMeta(actor),
    action: 'reset',
  } as unknown as Prisma.InputJsonValue;
  current.delivery = delivery;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: current as Prisma.InputJsonValue },
  });

  return getLabelTemplate(tenantId);
}

/**
 * ARGUS #306: the recent label-template audit rows, resolved with the acting
 * user's email so the designer can show a reviewable before/after history.
 */export async function getLabelTemplateHistory(
  tenantId: string,
  limit = 5,
): Promise<LabelTemplateHistoryEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: { tenantId, entityType: 'LabelTemplate' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      actorId: true,
      actorRole: true,
      action: true,
      before: true,
      after: true,
    },
  });

  const actorIds = [
    ...new Set(rows.map((row) => row.actorId).filter((id): id is string => Boolean(id))),
  ];
  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds }, tenantId },
          select: { id: true, email: true },
        })
      : [];
  const emailById = new Map(actors.map((actor) => [actor.id, actor.email]));

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    actorId: row.actorId,
    actorEmail: row.actorId ? emailById.get(row.actorId) ?? null : null,
    actorRole: row.actorRole,
    action: row.action,
    before: row.before,
    after: row.after,
  }));
}
