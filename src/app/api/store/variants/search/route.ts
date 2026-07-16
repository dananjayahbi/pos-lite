import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';

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

    if (
      !hasPermission(session.user, PERMISSIONS.SUPPLIER.viewSupplier) &&
      !hasPermission(session.user, PERMISSIONS.SUPPLIER.createPurchaseOrder)
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();

    if (!search || search.length < 1) {
      return NextResponse.json({ success: true, data: [] });
    }

    const variants = await prisma.productVariant.findMany({
      where: {
        tenantId,
        product: {
          isArchived: false,
          deletedAt: null,
        },
        OR: [
          { product: { name: { contains: search, mode: 'insensitive' } } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        sku: true,
        size: true,
        colour: true,
        costPrice: true,
        stockQuantity: true,
        product: { select: { name: true } },
      },
      take: 20,
      orderBy: { product: { name: 'asc' } },
    });

    return NextResponse.json({ success: true, data: variants });
  } catch (error) {
    console.error('GET /api/store/variants/search error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
