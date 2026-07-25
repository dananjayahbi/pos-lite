import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAllProducts } from '@/lib/services/product.service';

export async function GET(request: NextRequest) {
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

    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') ?? undefined;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));

    const { products, total } = await getAllProducts(tenantId, {
      search,
      page,
      limit,
      isArchived: false,
    });

    const simplified = products.map((product) => ({
      id: product.id,
      name: product.name,
      primaryVariant:
        product.variants.length > 0
          ? {
              id: product.variants[0]!.id,
              imageUrls: product.variants[0]!.imageUrls,
              retailPrice: product.variants[0]!.retailPrice,
            }
          : null,
    }));

    return NextResponse.json({
      success: true,
      data: { products: simplified, total },
    });
  } catch (error) {
    console.error('GET /api/store/website/products error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
      },
      { status: 500 },
    );
  }
}
