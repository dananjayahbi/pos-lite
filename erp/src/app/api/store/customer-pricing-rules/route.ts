import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { ok, toErrorResponse } from '@/lib/api/error-envelope';
import { ApiError } from '@/lib/api/errors';
import { parsePagination, parseQueryBool } from '@/lib/api/query-params';
import { lockingTx, lockForUpdate } from '@/lib/api/race-guard';
import {
  CreateCustomerPricingRuleSchema,
  type CreateCustomerPricingRuleInput,
} from '@/lib/validators/customer-pricing.validators';
import type { Prisma } from '@/generated/prisma/client';

/**
 * M15-01 (BUG-46) — `CustomerPricingRule` collection API.
 *
 * GET  /api/store/customer-pricing-rules  tenant-scoped list
 *      (?customerTag=, ?variantId=, ?includeInactive=, ?page/limit)
 * POST /api/store/customer-pricing-rules  create a rule
 *
 * Overlap guard: two ACTIVE rules for the same customerTag whose variant
 * scopes intersect (NULL variantId = "all variants") and whose date windows
 * intersect (NULL bound = open-ended — the exact semantics
 * `evaluateCustomerPricing` applies at cart time) → 409
 * `CUSTOMER_PRICING_OVERLAP`. The schema is frozen (no DB unique can express
 * interval overlap), so the check runs inside a transaction that first takes
 * a `SELECT … FOR UPDATE` on the tenant row (XC-06 race-guard helpers):
 * concurrent same-tenant rule writes serialize on that lock, so the loser of
 * an overlapping race sees the winner's row instead of double-inserting.
 */

/** Variant display shape shared with the UI list. */
const variantInclude = {
  variant: { select: { id: true, sku: true, retailPrice: true, product: { select: { name: true } } } },
} satisfies Prisma.CustomerPricingRuleInclude;

/** A rule window with NULL = open-ended bounds (evaluation semantics). */
interface RuleWindow {
  customerTag: string;
  variantId: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

/** True when two open-ended windows share at least one instant (inclusive bounds). */
function windowsIntersect(
  a: { startsAt: Date | null; endsAt: Date | null },
  b: { startsAt: Date | null; endsAt: Date | null },
): boolean {
  const aStart = a.startsAt;
  const aEnd = a.endsAt;
  const bStart = b.startsAt;
  const bEnd = b.endsAt;
  if (aStart && bEnd && aStart > bEnd) return false;
  if (bStart && aEnd && bStart > aEnd) return false;
  return true;
}

/** True when the two rules' variant scopes can apply to the same cart line. */
function variantScopesIntersect(a: string | null, b: string | null): boolean {
  return a === null || b === null || a === b;
}

/**
 * Throw a typed 409 when `candidate` overlaps an existing ACTIVE rule for the
 * same tag/variant scope. Must run inside `lockingTx` after the tenant row
 * lock (see file header) so check-then-write cannot race.
 */
async function assertNoOverlap(
  tx: Prisma.TransactionClient,
  tenantId: string,
  candidate: RuleWindow,
  excludeRuleId?: string,
): Promise<void> {
  const existing = await tx.customerPricingRule.findMany({
    where: {
      tenantId,
      customerTag: candidate.customerTag,
      isActive: true,
      ...(excludeRuleId ? { id: { not: excludeRuleId } } : {}),
    },
    select: { id: true, variantId: true, startsAt: true, endsAt: true },
  });

  const clash = existing.find(
    (row) =>
      variantScopesIntersect(candidate.variantId, row.variantId) &&
      windowsIntersect(candidate, row),
  );
  if (clash) {
    throw new ApiError(
      409,
      'CUSTOMER_PRICING_OVERLAP',
      `An active pricing rule for tag "${candidate.customerTag}" already covers this variant and date window.`,
      { conflictingRuleId: clash.id },
    );
  }
}

/** Resolve a (possibly cross-tenant) variant id to a tenant-owned row or throw 404. */
async function ensureVariantInTenant(tenantId: string, variantId: string): Promise<void> {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, tenantId },
    select: { id: true },
  });
  if (!variant) {
    throw ApiError.notFound('The selected variant was not found in this store.');
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }

    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.PROMOTION.editPromotion);
    if (forbidden) return forbidden;

    const { searchParams } = new URL(request.url);
    const customerTag = searchParams.get('customerTag')?.trim() || undefined;
    const variantId = searchParams.get('variantId')?.trim() || undefined;
    // XC-01: malformed ?includeInactive= → 400 instead of silent truthiness.
    const includeInactive = parseQueryBool(searchParams, 'includeInactive', { default: false }) ?? false;
    const { page, limit } = parsePagination(searchParams);

    const where: Prisma.CustomerPricingRuleWhereInput = {
      tenantId,
      ...(customerTag ? { customerTag } : {}),
      ...(variantId ? { variantId } : {}),
      ...(includeInactive ? {} : { isActive: true }),
    };

    const [rules, total] = await prisma.$transaction([
      prisma.customerPricingRule.findMany({
        where,
        include: variantInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customerPricingRule.count({ where }),
    ]);

    return ok(rules, { meta: { page, limit, total, hasMore: page * limit < total } });
  } catch (error) {
    // INF-02: typed envelope for ApiErrors/sentinels/Prisma; generic logged 500.
    return toErrorResponse(error, 'GET /api/store/customer-pricing-rules');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }

    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.PROMOTION.createPromotion);
    if (forbidden) return forbidden;

    const body = await request.json();
    const parsed = CreateCustomerPricingRuleSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const data: CreateCustomerPricingRuleInput = parsed.data;
    const isActive = data.isActive ?? true;
    if (data.variantId) {
      await ensureVariantInTenant(tenantId, data.variantId);
    }

    const candidate: RuleWindow = {
      customerTag: data.customerTag,
      variantId: data.variantId ?? null,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
    };

    const created = await lockingTx(async (tx) => {
      if (isActive) {
        // Serialize same-tenant rule writes so the overlap check cannot race (XC-06).
        await lockForUpdate(tx, 'tenants', '"id" = $1', [tenantId]);
        await assertNoOverlap(tx, tenantId, candidate);
      }
      return tx.customerPricingRule.create({
        data: {
          tenantId,
          customerTag: candidate.customerTag,
          ...(candidate.variantId ? { variantId: candidate.variantId } : {}),
          price: data.price,
          ...(candidate.startsAt ? { startsAt: candidate.startsAt } : {}),
          ...(candidate.endsAt ? { endsAt: candidate.endsAt } : {}),
          isActive,
        },
        include: variantInclude,
      });
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/customer-pricing-rules');
  }
}
