import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';

const GENDER_LABELS: Record<string, string> = {
  MEN: 'Men',
  WOMEN: 'Women',
  UNISEX: 'Unisex',
  KIDS: 'Kids',
  TODDLERS: 'Toddlers',
};

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

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
    const search = url.searchParams.get('search');
    const categoryId = url.searchParams.get('categoryId');
    const brandId = url.searchParams.get('brandId');
    const gender = url.searchParams.get('gender');
    const isArchived = url.searchParams.get('isArchived');
    const productIds = url.searchParams.get('productIds');
    const includeCostPrices = url.searchParams.get('include_cost_prices') === 'true';

    if (includeCostPrices && !hasPermission(session.user, PERMISSIONS.PRODUCT.viewCostPrice)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const where: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };

    if (productIds) {
      where.id = { in: productIds.split(',') };
    } else {
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } },
        ];
      }
      if (categoryId) where.categoryId = categoryId;
      if (brandId) where.brandId = brandId;
      if (gender) where.gender = gender;
      if (isArchived === 'true') where.isArchived = true;
      else if (isArchived === 'false') where.isArchived = false;
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        name: true,
        description: true,
        gender: true,
        isArchived: true,
        tags: true,
        createdAt: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        variants: {
          where: { deletedAt: null },
          select: {
            sku: true,
            barcode: true,
            size: true,
            colour: true,
            costPrice: true,
            retailPrice: true,
            wholesalePrice: true,
            stockQuantity: true,
            lowStockThreshold: true,
          },
          orderBy: { sku: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const headersWithCost = [
      'Product Name', 'Category', 'Brand', 'Gender', 'SKU', 'Barcode',
      'Size', 'Colour', 'Cost Price', 'Retail Price', 'Wholesale Price',
      'Stock Quantity', 'Low Stock Threshold', 'Status', 'Tags', 'Description', 'Created At',
    ];
    const headersWithoutCost = headersWithCost.filter((h) => h !== 'Cost Price');
    const headers = includeCostPrices ? headersWithCost : headersWithoutCost;

    const rows: string[] = [headers.join(',')];

    for (const product of products) {
      for (const variant of product.variants) {
        const fields: string[] = [
          escapeCsv(product.name),
          escapeCsv(product.category.name),
          escapeCsv(product.brand?.name ?? ''),
          GENDER_LABELS[product.gender] ?? product.gender,
          escapeCsv(variant.sku),
          escapeCsv(variant.barcode ?? ''),
          escapeCsv(variant.size ?? ''),
          escapeCsv(variant.colour ?? ''),
        ];

        if (includeCostPrices) {
          fields.push(String(variant.costPrice));
        }

        fields.push(
          String(variant.retailPrice),
          String(variant.wholesalePrice ?? ''),
          String(variant.stockQuantity),
          String(variant.lowStockThreshold),
          product.isArchived ? 'ARCHIVED' : 'ACTIVE',
          escapeCsv(product.tags.join(', ')),
          escapeCsv(product.description ?? ''),
          product.createdAt.toISOString().split('T')[0] ?? '',
        );

        rows.push(fields.join(','));
      }
    }

    const csvContent = rows.join('\n');
    const date = new Date().toISOString().split('T')[0];

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': `attachment;filename="velvetpos-inventory-${date}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Export failed' } },
      { status: 500 },
    );
  }
}
