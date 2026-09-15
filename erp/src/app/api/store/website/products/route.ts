import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAllProducts } from '@/lib/services/product.service';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { parseQueryInt } from '@/lib/api/query-params';

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
    const idsParam = searchParams.get('ids');
    const ids = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    // XC-01: malformed page/limit → 400 (the `|| 1` fallback caught NaN but
    // silently ignored the caller's intent; now a 400 names the param).
    const page = parseQueryInt(searchParams, 'page', { default: 1, min: 1 }) ?? 1;
    const limit = parseQueryInt(searchParams, 'limit', { default: 20, min: 1, max: 100 }) ?? 20;

    const { products, total } = await getAllProducts(tenantId, {
      search,
      ids,
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
    // XC-01/INF-02: parser ApiErrors surface as their 400; unknown
    // errors are logged and returned as a generic, leak-free 500.
    return toErrorResponse(error, 'GET /api/store/website/products');
  }
}
