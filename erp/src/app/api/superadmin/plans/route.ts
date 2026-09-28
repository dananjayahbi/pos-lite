import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/api/superadmin-guard';

export async function GET() {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;

  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(plans);
}
