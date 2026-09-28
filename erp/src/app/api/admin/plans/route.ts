import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/api/superadmin-guard';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { withUniqueGuard } from '@/lib/api/race-guard';
import { parseQueryBool } from '@/lib/api/query-params';

const createPlanSchema = z.object({
  name: z.enum(['STARTER', 'GROWTH', 'ENTERPRISE']),
  monthlyPrice: z.number().positive(),
  annualPrice: z.number().positive(),
  maxUsers: z.int().min(1),
  maxProductVariants: z.int().min(1),
  features: z.array(z.string().min(1)).min(1),
});

export async function GET(request: Request) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;

  try {
    // OBS-17 / M08-05 list-semantics decision (D4 policy, client-answered):
    // this GET now defaults to ACTIVE plans only, aligning it with
    // /api/superadmin/plans (same resource, one contract). Archived rows are
    // opt-in via `?includeInactive=true` (admin archive tooling / QA cleanup).
    // Filtering does NOT free a name: SubscriptionPlan.name is globally
    // @unique, so an archived plan still blocks POST with 409 (D4: unique
    // names stay reserved while ANY row exists — see the POST message).
    const { searchParams } = new URL(request.url);
    const includeInactive = parseQueryBool(searchParams, 'includeInactive', {
      default: false,
    });

    const plans = await prisma.subscriptionPlan.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { monthlyPrice: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    });

    return NextResponse.json({ success: true, data: plans });
  } catch (error) {
    return toErrorResponse(error, 'admin plans list');
  }
}

export async function POST(request: Request) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const parsed = createPlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues } },
        { status: 422 },
      );
    }

    // M08-05 (BUG-39): the bare create used to let P2002 escape → 500 with a
    // completely EMPTY body. Now insert-and-map via the XC-06 race-guard
    // (same pattern as staff POST / M03-06): duplicate name → typed 409
    // CONFLICT envelope. D4 semantics: the name stays reserved while ANY
    // row exists (archived included), so the message says so.
    const plan = await withUniqueGuard(
      () =>
        prisma.subscriptionPlan.create({
          data: {
            name: parsed.data.name,
            monthlyPrice: parsed.data.monthlyPrice,
            annualPrice: parsed.data.annualPrice,
            maxUsers: parsed.data.maxUsers,
            maxProductVariants: parsed.data.maxProductVariants,
            features: parsed.data.features,
          },
        }),
      'A plan with this name already exists (an archived plan may also occupy this name)',
    );

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, 'admin plans create');
  }
}
