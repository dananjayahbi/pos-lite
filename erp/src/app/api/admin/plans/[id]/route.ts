import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/api/superadmin-guard';

const updatePlanSchema = z
  .object({
    name: z.enum(['STARTER', 'GROWTH', 'ENTERPRISE']),
    monthlyPrice: z.number().positive(),
    annualPrice: z.number().positive(),
    maxUsers: z.int().min(1),
    maxProductVariants: z.int().min(1),
    features: z.array(z.string().min(1)).min(1),
    isActive: z.boolean(),
  })
  .partial();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } },
      { status: 404 },
    );
  }

  const body = await request.json();
  const parsed = updatePlanSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues } },
      { status: 422 },
    );
  }

  // Strip undefined keys to satisfy exactOptionalPropertyTypes
  const data = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  );

  const updatedPlan = await prisma.subscriptionPlan.update({
    where: { id },
    data,
  });

  return NextResponse.json({ success: true, data: updatedPlan });
}
