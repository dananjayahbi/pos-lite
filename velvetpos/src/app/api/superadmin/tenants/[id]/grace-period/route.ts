import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session || session.user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const graceEndsAt = new Date();
  graceEndsAt.setDate(graceEndsAt.getDate() + 14);

  const tenant = await prisma.tenant.update({
    where: { id },
    data: { status: 'GRACE_PERIOD', graceEndsAt },
  });

  return NextResponse.json({ tenant });
}
