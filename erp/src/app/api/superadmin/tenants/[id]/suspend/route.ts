import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/api/superadmin-guard';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const tenant = await prisma.tenant.update({
    where: { id },
    data: { status: 'SUSPENDED' },
  });

  return NextResponse.json({ tenant });
}
