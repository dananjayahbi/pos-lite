/**
 * Shared audience selection for marketing broadcasts.
 *
 * Both the count/preview endpoints and the send route use the same filter
 * contract, and the selected channel decides which customers are reachable:
 * EMAIL needs an email address, SMS/WhatsApp need a phone number.
 */

import { prisma } from '@/lib/prisma';
import type { Gender, Prisma } from '@/generated/prisma/client';
import type {
  BroadcastChannelName,
  BroadcastRecipient,
} from '@/lib/services/broadcast-dispatch.service';

export interface BroadcastAudienceFilters {
  tags?: string | undefined;
  gender?: string | undefined;
  minSpend?: number | undefined;
  maxSpend?: number | undefined;
  birthdayMonth?: number | undefined;
}

/**
 * Build the tenant-scoped customer filter for a channel. Customer identity
 * filters (tags/gender/spend) are shared; reachability is channel-specific.
 */
export function buildBroadcastWhere(
  tenantId: string,
  channel: BroadcastChannelName,
  filters: BroadcastAudienceFilters,
): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {
    tenantId,
    deletedAt: null,
    isActive: true,
  };

  if (channel === 'EMAIL') {
    where.AND = [
      { email: { not: null } },
      { NOT: { email: '' } },
    ];
  } else {
    where.phone = { not: '' };
  }

  if (filters.tags) {
    const tags = filters.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (tags.length > 0) where.tags = { hasSome: tags };
  }

  if (filters.gender && filters.gender !== 'ALL') {
    where.gender = filters.gender as Gender;
  }

  if (filters.minSpend !== undefined || filters.maxSpend !== undefined) {
    where.totalSpend = {
      ...(filters.minSpend !== undefined ? { gte: filters.minSpend } : {}),
      ...(filters.maxSpend !== undefined ? { lte: filters.maxSpend } : {}),
    } as Prisma.DecimalFilter;
  }

  return where;
}

export interface BroadcastAudience {
  recipients: BroadcastRecipient[];
  total: number;
}

/**
 * Resolve every reachable customer for the selected channel. Birthday-month
 * filtering happens in JS because Prisma cannot express EXTRACT(month).
 */
export async function fetchBroadcastAudience(
  tenantId: string,
  channel: BroadcastChannelName,
  filters: BroadcastAudienceFilters,
): Promise<BroadcastAudience> {
  const where = buildBroadcastWhere(tenantId, channel, filters);

  const customers = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      birthday: true,
      tags: true,
      totalSpend: true,
      gender: true,
    },
    orderBy: { name: 'asc' },
  });

  const targeted =
    filters.birthdayMonth !== undefined &&
    filters.birthdayMonth >= 1 &&
    filters.birthdayMonth <= 12
      ? customers.filter(
          (customer) =>
            customer.birthday && customer.birthday.getMonth() + 1 === filters.birthdayMonth,
        )
      : customers;

  const reachable = targeted.filter((customer) => {
    if (channel === 'EMAIL') return Boolean(customer.email?.trim());
    return Boolean(customer.phone.trim());
  });

  return {
    recipients: reachable.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
    })),
    total: reachable.length,
  };
}
