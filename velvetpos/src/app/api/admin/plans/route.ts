import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const createPlanSchema = z.object({
  name: z.enum(['STARTER', 'GROWTH', 'ENTERPRISE']),
  monthlyPrice: z.number().positive(),
  annualPrice: z.number().positive(),
  maxUsers: z.int().min(1),
  maxProductVariants: z.int().min(1),
  features: z.array(z.string().min(1)).min(1),
});

export async function GET() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Super admin access required' } },
      { status: 403 },
    );
  }

  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { monthlyPrice: 'asc' },
    include: { _count: { select: { subscriptions: true } } },
  });

  return NextResponse.json({ success: true, data: plans });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Super admin access required' } },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = createPlanSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues } },
      { status: 422 },
    );
  }

  const plan = await prisma.subscriptionPlan.create({
    data: {
      name: parsed.data.name,
      monthlyPrice: parsed.data.monthlyPrice,
      annualPrice: parsed.data.annualPrice,
      maxUsers: parsed.data.maxUsers,
      maxProductVariants: parsed.data.maxProductVariants,
      features: parsed.data.features,
    },
  });

  return NextResponse.json({ success: true, data: plan }, { status: 201 });
}
