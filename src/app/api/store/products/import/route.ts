import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { GenderType, TaxRule, Prisma } from '@/generated/prisma/client';
import { createAuditLog } from '@/lib/services/audit.service';

const ImportRowSchema = z.object({
  productName: z.string().min(1),
  category: z.string().min(1),
  retailPrice: z.number().positive(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  brand: z.string().optional(),
  description: z.string().optional(),
  gender: z.string().optional(),
  tags: z.string().optional(),
  costPrice: z.number().positive().optional(),
  size: z.string().optional(),
  colour: z.string().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  wholesalePrice: z.number().positive().optional(),
});

const ImportPayloadSchema = z.object({
  rows: z.array(ImportRowSchema).min(1).max(5000),
});

function mapGender(value?: string): GenderType {
  if (!value) return 'UNISEX';
  const v = value.toLowerCase().trim();
  const map: Record<string, GenderType> = {
    men: 'MEN',
    man: 'MEN',
    male: 'MEN',
    women: 'WOMEN',
    woman: 'WOMEN',
    female: 'WOMEN',
    unisex: 'UNISEX',
    kids: 'KIDS',
    kid: 'KIDS',
    children: 'KIDS',
    toddlers: 'TODDLERS',
    toddler: 'TODDLERS',
  };
  return map[v] ?? 'UNISEX';
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: { message: 'Unauthorized' } },
      { status: 401 },
    );
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: { message: 'Unauthorized' } },
      { status: 401 },
    );
  }

  if (!hasPermission(session.user, PERMISSIONS.PRODUCT.createProduct)) {
    return NextResponse.json(
      { success: false, error: { message: 'Forbidden' } },
      { status: 403 },
    );
  }

  const body = await req.json();
  const parsed = ImportPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: 'Validation failed', details: parsed.error.issues } },
      { status: 400 },
    );
  }

  const actorId = session.user.id;
  const { rows } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingCategories = await tx.category.findMany({
        where: { tenantId, deletedAt: null },
      });
      const existingBrands = await tx.brand.findMany({
        where: { tenantId, deletedAt: null },
      });

      const categoryMap = new Map(
        existingCategories.map((c) => [c.name.toLowerCase().trim(), c.id]),
      );
      const brandMap = new Map(
        existingBrands.map((b) => [b.name.toLowerCase().trim(), b.id]),
      );

      // Group rows by productName
      const groups = new Map<string, typeof rows>();
      for (const row of rows) {
        const key = row.productName.toLowerCase().trim();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }

      let productsCreated = 0;
      let variantsCreated = 0;
      let skuCounter = 0;

      for (const [, groupRows] of groups) {
        const firstRow = groupRows[0];
        if (!firstRow) continue;

        // Find or create category
        let categoryId = categoryMap.get(firstRow.category.toLowerCase().trim());
        if (!categoryId) {
          const newCat = await tx.category.create({
            data: { tenantId, name: firstRow.category.trim() },
          });
          categoryId = newCat.id;
          categoryMap.set(firstRow.category.toLowerCase().trim(), categoryId);
        }

        // Find or create brand
        let brandId: string | null = null;
        if (firstRow.brand) {
          brandId = brandMap.get(firstRow.brand.toLowerCase().trim()) ?? null;
          if (!brandId) {
            const newBrand = await tx.brand.create({
              data: { tenantId, name: firstRow.brand.trim() },
            });
            brandId = newBrand.id;
            brandMap.set(firstRow.brand.toLowerCase().trim(), brandId);
          }
        }

        const genderValue = mapGender(firstRow.gender);
        const tags = firstRow.tags
          ? firstRow.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [];

        const product = await tx.product.create({
          data: {
            tenantId,
            name: firstRow.productName.trim(),
            description: firstRow.description?.trim() || null,
            categoryId,
            brandId,
            gender: genderValue,
            tags,
            taxRule: 'STANDARD_VAT' satisfies TaxRule,
          },
        });
        productsCreated++;

        const variantData = groupRows.map((row) => {
          skuCounter++;
          const sku =
            row.sku?.trim() ||
            `IMP-${firstRow!.productName.substring(0, 3).toUpperCase()}-${skuCounter.toString().padStart(4, '0')}`;
          return {
            productId: product.id,
            tenantId,
            sku,
            barcode: row.barcode?.trim() || null,
            size: row.size?.trim() || null,
            colour: row.colour?.trim() || null,
            costPrice: new Prisma.Decimal(row.costPrice ?? 0),
            retailPrice: new Prisma.Decimal(row.retailPrice),
            wholesalePrice: row.wholesalePrice
              ? new Prisma.Decimal(row.wholesalePrice)
              : null,
            stockQuantity: 0,
            lowStockThreshold: row.lowStockThreshold ?? 5,
            imageUrls: [] as string[],
          };
        });

        await tx.productVariant.createMany({ data: variantData });
        variantsCreated += variantData.length;
      }

      await createAuditLog({
        tenantId,
        actorId,
        actorRole: 'SYSTEM',
        entityType: 'Product',
        entityId: 'BULK_IMPORT',
        action: 'PRODUCTS_IMPORTED',
        after: { productsCreated, variantsCreated } as unknown as Prisma.InputJsonValue,
      });

      return { productsCreated, variantsCreated };
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed';
    if (message.includes('Unique constraint')) {
      return NextResponse.json(
        { success: false, error: { message: 'Duplicate SKU found. Please ensure all SKUs are unique.' } },
        { status: 409 },
      );
    }
    console.error('POST /api/store/products/import error:', error);
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 },
    );
  }
}
