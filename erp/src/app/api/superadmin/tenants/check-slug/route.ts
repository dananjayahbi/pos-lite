import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/api/superadmin-guard';

export async function GET(request: NextRequest) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;

  const slug = request.nextUrl.searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ available: false });
  }

  const existing = await prisma.tenant.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true },
  });

  return NextResponse.json({ available: !existing });
}
