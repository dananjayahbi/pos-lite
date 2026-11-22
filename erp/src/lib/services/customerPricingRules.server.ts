import Decimal from 'decimal.js';

import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { hasCustomerTag } from '@/lib/services/customerTag.core';

/**
 * ARGUS #333 — shared server-side guards for customer pricing rules.
 *
 * The tag picker and the form are UX; these checks are the contract. They are
 * kept in one place so POST and PATCH cannot drift.
 */

/** A rule price above the variant retail price is dead weight; reject it. */
export function assertRulePriceAtOrBelowRetail(
  price: number,
  retailPrice: { toString(): string },
): void {
  const retail = new Decimal(retailPrice.toString());
  if (new Decimal(price).greaterThan(retail)) {
    throw new ApiError(
      400,
      'PRICE_ABOVE_RETAIL',
      `Rule price cannot be above the variant retail price (${retail.toFixed(2)}).`,
      { path: 'price' },
    );
  }
}

/** The tag must be in use by at least one active customer (case-insensitive). */
export async function assertCustomerTagInUse(
  tenantId: string,
  customerTag: string,
): Promise<void> {
  const customers = await prisma.customer.findMany({
    where: { tenantId, deletedAt: null },
    select: { tags: true },
  });
  if (!hasCustomerTag(customers.map((customer) => customer.tags), customerTag)) {
    throw new ApiError(
      400,
      'CUSTOMER_TAG_UNKNOWN',
      `No customer currently uses the tag "${customerTag}". Assign the tag to a customer first.`,
      { path: 'customerTag' },
    );
  }
}

/** Tenant-scoped variant retail lookup, or 404 for a missing/foreign id. */
export async function getVariantRetailOr404(tenantId: string, variantId: string) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, tenantId },
    select: { id: true, retailPrice: true },
  });
  if (!variant) {
    throw ApiError.notFound('The selected variant was not found in this store.');
  }
  return variant;
}
