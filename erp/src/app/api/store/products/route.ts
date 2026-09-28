import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getAllProducts, createProduct, createProductVariants } from '@/lib/services/product.service';
import { ProductListQuerySchema, CreateProductSchema } from '@/lib/validators/product.validators';
import { revalidateTenantStorefront } from '@/lib/revalidate-website';
import { toErrorResponse } from '@/lib/api/error-envelope';

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

    const url = request.nextUrl;
    const rawParams: Record<string, string> = {};
    for (const key of ['search', 'categoryId', 'brandId', 'isArchived', 'categories', 'brands', 'forms', 'status', 'page', 'limit'] as const) {
      const val = url.searchParams.get(key);
      if (val !== null) rawParams[key] = val;
    }

    // M02-03 — the "Deleted" view: `?status=deleted` lists ONLY soft-deleted
    // products. It is intercepted here (before schema validation) because
    // ProductListQuerySchema's status enum covers live states only.
    const includeDeleted = rawParams.status === 'deleted';
    if (includeDeleted) delete rawParams.status;

    const parsed = ProductListQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: errors } },
        { status: 400 },
      );
    }

    const { page, limit, categories, brands, status, ...filters } = parsed.data;

    // Parse multi-value params
    const categoryIds = categories?.split(',').filter(Boolean);
    const brandIds = brands?.split(',').filter(Boolean);

    // Map status to isArchived
    let isArchived = filters.isArchived;
    if (status === 'active') isArchived = false;
    else if (status === 'archived') isArchived = true;
    else if (status === 'low_stock' || status === 'out_of_stock') isArchived = false;

    const result = await getAllProducts(tenantId, {
      ...filters,
      isArchived,
      includeDeleted,
      categoryIds,
      brandIds,
      page,
      limit,
    });

    const canViewCost = hasPermission(session.user, PERMISSIONS.PRODUCT.viewCostPrice);

    let filteredProducts = canViewCost
      ? result.products
      : result.products.map((p) => ({
          ...p,
          variants: 'variants' in p && Array.isArray(p.variants)
            ? p.variants.map(({ costPrice: _cost, ...rest }) => rest)
            : undefined,
        }));

    // Post-filter for stock status (can't compare two columns in Prisma)
    if (status === 'low_stock') {
      filteredProducts = filteredProducts.filter((p) =>
        'variants' in p && Array.isArray(p.variants) &&
        p.variants.some((v) => v.stockQuantity > 0 && v.stockQuantity <= v.lowStockThreshold),
      );
    } else if (status === 'out_of_stock') {
      filteredProducts = filteredProducts.filter((p) =>
        'variants' in p && Array.isArray(p.variants) &&
        p.variants.every((v) => v.stockQuantity <= 0),
      );
    }

    const totalPages = Math.ceil(result.total / limit);

    return NextResponse.json({
      success: true,
      data: filteredProducts,
      meta: { page, limit, total: result.total, totalPages },
    });
  } catch (error) {
    // INF-02: one-line error mapping — Prisma P2002/P2025 and service
    // sentinels become typed envelope responses; unknown errors are logged
    // server-side and returned as a generic 500 with no internals.
    return toErrorResponse(error, 'GET /api/store/products');
  }
}

export async function POST(request: Request) {
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

    if (!hasPermission(session.user, PERMISSIONS.PRODUCT.createProduct)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = CreateProductSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const { variantDefinitions, ...productData } = parsed.data;

    const product = await createProduct(tenantId, session.user.id, productData);

    // Revalidate the storefront catalog so the new product appears immediately.
    try {
      await revalidateTenantStorefront(tenantId, { productIds: [product.id], catalog: true });
    } catch (revalidateErr) {
      console.warn('[POST /api/store/products] Revalidation warning:', revalidateErr);
    }

    if (variantDefinitions && variantDefinitions.length > 0) {
      try {
        const variants = await createProductVariants(tenantId, product.id, variantDefinitions);
        return NextResponse.json(
          { success: true, data: { ...product, variants } },
          { status: 201 },
        );
      } catch (variantError) {
        const message = variantError instanceof Error ? variantError.message : 'Variant creation failed';
        return NextResponse.json(
          {
            success: true,
            data: product,
            warning: { code: 'PARTIAL_SUCCESS', message: `Product created but variant creation failed: ${message}` },
          },
          { status: 207 },
        );
      }
    }

    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error) {
    // INF-02: one-line error mapping — Prisma P2002/P2025 and service
    // sentinels become typed envelope responses; unknown errors are logged
    // server-side and returned as a generic 500 with no internals.
    return toErrorResponse(error, 'POST /api/store/products');
  }
}
