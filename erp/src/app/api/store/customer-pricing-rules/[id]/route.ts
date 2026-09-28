import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { ok, toErrorResponse } from '@/lib/api/error-envelope';
import { ApiError } from '@/lib/api/errors';
import { lockingTx, lockForUpdate } from '@/lib/api/race-guard';
import {
  UpdateCustomerPricingRuleSchema,
  type UpdateCustomerPricingRuleInput,
} from '@/lib/validators/customer-pricing.validators';
import type { Prisma } from '@/generated/prisma/client';

/**
 * M15-01 (BUG-46) — single-rule API for `CustomerPricingRule`.
 *
 * GET    /api/store/customer-pricing-rules/[id]  read one (404 NOT_FOUND when
 *        missing or belonging to another tenant — no existence leak).
 * PATCH  partial update; re-runs the ACTIVE overlap guard excluding self.
 * DELETE soft-deactivate: sets `isActive:false` and returns 200 with the
 *        updated row. The model has no deletedAt, so "delete" in this API
 *        ALWAYS means deactivate (documented in the response and UI) — the
 *        rule stops applying to carts immediately but stays auditable.
 */

const variantInclude = {
  variant: { select: { id: true, sku: true, retailPrice: true, product: { select: { name: true } } } },
} satisfies Prisma.CustomerPricingRuleInclude;

function windowsIntersect(
  a: { startsAt: Date | null; endsAt: Date | null },
  b: { startsAt: Date | null; endsAt: Date | null },
): boolean {
  if (a.startsAt && b.endsAt && a.startsAt > b.endsAt) return false;
  if (b.startsAt && a.endsAt && b.startsAt > a.endsAt) return false;
  return true;
}

function variantScopesIntersect(a: string | null, b: string | null): boolean {
  return a === null || b === null || a === b;
}

/** Load the rule tenant-scoped, or throw a typed 404 (foreign rows are indistinguishable). */
async function findRuleOr404(tenantId: string, id: string) {
  const rule = await prisma.customerPricingRule.findFirst({
    where: { id, tenantId },
    select: { id: true, customerTag: true, variantId: true, startsAt: true, endsAt: true, isActive: true },
  });
  if (!rule) {
    throw ApiError.notFound('Customer pricing rule not found');
  }
  return rule;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const rule = await prisma.customerPricingRule.findFirst({
      where: { id, tenantId },
      include: variantInclude,
    });
    if (!rule) {
      throw ApiError.notFound('Customer pricing rule not found');
    }

    return ok(rule);
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/customer-pricing-rules/[id]');
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const existing = await findRuleOr404(tenantId, id);

    const body = await request.json();
    const parsed = UpdateCustomerPricingRuleSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const data: UpdateCustomerPricingRuleInput = parsed.data;

    // Effective post-PATCH values (undefined = untouched → keep existing).
    const customerTag = data.customerTag ?? existing.customerTag;
    const variantId = data.variantId === undefined ? existing.variantId : data.variantId;
    const startsAt =
      data.startsAt === undefined ? existing.startsAt : data.startsAt ? new Date(data.startsAt) : null;
    const endsAt =
      data.endsAt === undefined ? existing.endsAt : data.endsAt ? new Date(data.endsAt) : null;
    const isActive = data.isActive ?? existing.isActive;

    if (data.variantId) {
      const variant = await prisma.productVariant.findFirst({
        where: { id: data.variantId, tenantId },
        select: { id: true },
      });
      if (!variant) {
        throw ApiError.notFound('The selected variant was not found in this store.');
      }
    }

    const updated = await lockingTx(async (tx) => {
      if (isActive) {
        // Same tenant-row serialization as POST; overlap re-check excludes self.
        await lockForUpdate(tx, 'tenants', '"id" = $1', [tenantId]);
        const others = await tx.customerPricingRule.findMany({
          where: { tenantId, customerTag, isActive: true, id: { not: id } },
          select: { id: true, variantId: true, startsAt: true, endsAt: true },
        });
        const clash = others.find(
          (row) =>
            variantScopesIntersect(variantId, row.variantId) &&
            windowsIntersect({ startsAt, endsAt }, row),
        );
        if (clash) {
          throw new ApiError(
            409,
            'CUSTOMER_PRICING_OVERLAP',
            `An active pricing rule for tag "${customerTag}" already covers this variant and date window.`,
            { conflictingRuleId: clash.id },
          );
        }
      }
      return tx.customerPricingRule.update({
        where: { id },
        data: {
          customerTag,
          variantId,
          startsAt,
          endsAt,
          isActive,
          ...(data.price !== undefined ? { price: data.price } : {}),
        },
        include: variantInclude,
      });
    });

    return ok(updated);
  } catch (error) {
    return toErrorResponse(error, 'PATCH /api/store/customer-pricing-rules/[id]');
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    // Deactivation is an edit, not a promotion delete — MANAGER+ (editPromotion)
    // may do it; deletePromotion stays OWNER-only like the promotions family.
    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.PROMOTION.editPromotion);
    if (forbidden) return forbidden;

    const { id } = await params;
    await findRuleOr404(tenantId, id);

    // Soft-deactivate semantics (documented): CustomerPricingRule has no
    // deletedAt, so DELETE flips isActive=false and returns the updated row
    // with 200 — never a hard delete.
    const deactivated = await prisma.customerPricingRule.update({
      where: { id },
      data: { isActive: false },
      include: variantInclude,
    });

    return ok({ ...deactivated, deactivated: true });
  } catch (error) {
    return toErrorResponse(error, 'DELETE /api/store/customer-pricing-rules/[id]');
  }
}
