import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import {
  EMPTY_RATE_CARD_META,
  type RateCardMeta,
} from '@/lib/delivery/rateCardMeta.core';

export interface RateCardActor {
  id: string;
  email: string;
  role: string;
}

/** Provenance stored under `Tenant.settings.delivery.rateCardMeta`. */
export async function getRateCardMeta(tenantId: string): Promise<RateCardMeta> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = tenant?.settings;
  if (!settings || typeof settings !== 'object') return { ...EMPTY_RATE_CARD_META };
  const delivery = (settings as Record<string, unknown>).delivery;
  if (!delivery || typeof delivery !== 'object') return { ...EMPTY_RATE_CARD_META };
  const raw = (delivery as Record<string, unknown>).rateCardMeta;
  if (!raw || typeof raw !== 'object') return { ...EMPTY_RATE_CARD_META };
  const meta = raw as Record<string, unknown>;
  return {
    updatedAt: typeof meta.updatedAt === 'string' ? meta.updatedAt : null,
    updatedByEmail: typeof meta.updatedByEmail === 'string' ? meta.updatedByEmail : null,
    updatedByRole: typeof meta.updatedByRole === 'string' ? meta.updatedByRole : null,
    action: meta.action === 'card' || meta.action === 'entries' ? meta.action : null,
  };
}

export async function recordRateCardMeta(
  tenantId: string,
  actor: RateCardActor,
  action: 'card' | 'entries',
): Promise<RateCardMeta> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const current = (tenant?.settings ?? {}) as Record<string, unknown>;
  const delivery =
    current.delivery && typeof current.delivery === 'object'
      ? { ...(current.delivery as Record<string, unknown>) }
      : {};
  const meta: RateCardMeta = {
    updatedAt: new Date().toISOString(),
    updatedByEmail: actor.email,
    updatedByRole: actor.role,
    action,
  };
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      settings: {
        ...current,
        delivery: { ...delivery, rateCardMeta: meta as unknown as Prisma.InputJsonValue },
      } as Prisma.InputJsonValue,
    },
  });
  return meta;
}
