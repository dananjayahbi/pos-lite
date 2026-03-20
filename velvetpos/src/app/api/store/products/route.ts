import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getAllProducts, createProduct, createProductVariants } from '@/lib/services/product.service';
import { ProductListQuerySchema, CreateProductSchema } from '@/lib/validators/product.validators';

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
    for (const key of ['search', 'categoryId', 'brandId', 'gender', 'isArchived', 'categories', 'brands', 'genders', 'status', 'page', 'limit'] as const) {
      const val = url.searchParams.get(key);
      if (val !== null) rawParams[key] = val;
    }

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

    const { page, limit, categories, brands, genders, status, ...filters } = parsed.data;

    // Parse multi-value params
    const categoryIds = categories?.split(',').filter(Boolean);
    const brandIds = brands?.split(',').filter(Boolean);
    const genderValues = genders?.split(',').filter(Boolean) as import('@/generated/prisma/client').GenderType[] | undefined;

    // Map status to isArchived
    let isArchived = filters.isArchived;
    if (status === 'active') isArchived = false;
    else if (status === 'archived') isArchived = true;
    else if (status === 'low_stock' || status === 'out_of_stock') isArchived = false;

    const result = await getAllProducts(tenantId, {
      ...filters,
      isArchived,
      categoryIds,
      brandIds,
      genders: genderValues,
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
    console.error('GET /api/store/products error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
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
    const message = error instanceof Error ? error.message : '';

    if (message.includes('already exists')) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message } },
        { status: 409 },
      );
    }

    if (message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        { status: 404 },
      );
    }

    console.error('POST /api/store/products error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
