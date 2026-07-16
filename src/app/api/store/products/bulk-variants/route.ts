import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { success: false, error: { message: 'Unauthorized' } },
      { status: 401 },
    );
  }

  const body = await req.json();
  const { productIds } = body as { productIds: unknown };

  if (
    !Array.isArray(productIds) ||
    productIds.length === 0 ||
    !productIds.every((id): id is string => typeof id === 'string')
  ) {
    return NextResponse.json(
      { success: false, error: { message: 'productIds must be a non-empty array of strings' } },
      { status: 400 },
    );
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      productId: { in: productIds },
      deletedAt: null,
      product: { tenantId: session.user.tenantId, deletedAt: null },
    },
    include: {
      product: {
        select: { name: true, brand: { select: { name: true } } },
      },
    },
    orderBy: [{ productId: 'asc' }, { sku: 'asc' }],
  });

  return NextResponse.json({ success: true, data: variants });
}
