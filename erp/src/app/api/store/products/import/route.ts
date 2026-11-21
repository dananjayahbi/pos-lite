import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { createAuditLog } from '@/lib/services/audit.service';
import {
  allocateBarcode,
  createProduct,
  createProductVariants,
  type CreateVariantInput,
} from '@/lib/services/product.service';
import { revalidateTenantStorefront } from '@/lib/revalidate-website';
import {
  summarizeProductImportRows,
  validateProductImportRow,
  type ProductImportRowData,
  type ProductImportRowResult,
} from '@/lib/products/csv-import';

const ImportPayloadSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
});

type ValidRow = ProductImportRowResult & { data: ProductImportRowData };

function readRowNumber(row: Record<string, unknown>, fallback: number): number {
  const raw = row.rowNumber;
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    return Number(raw.trim());
  }
  return fallback;
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

  // ARGUS #146: validate EVERY row first. Invalid rows are reported with their
  // CSV row number; they do not silently become 0-cost / STANDARD_VAT rows.
  const validatedRows = rows.map((row, index) =>
    validateProductImportRow(row, readRowNumber(row, index + 1)),
  );
  const validation = summarizeProductImportRows(validatedRows);

  const validRows = validatedRows.filter(
    (row): row is ValidRow => row.ok && row.data !== undefined,
  );

  if (validRows.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No importable rows. Fix the reported rows and retry.',
          details: validation.rejected,
        },
        data: {
          productsCreated: 0,
          variantsCreated: 0,
          rowsReceived: validation.rowsReceived,
          rowsCreated: 0,
          rowsImported: 0,
          rowsRejected: validation.rowsRejected,
          rejected: validation.rejected,
          defaults: validation.defaults,
          taxRuleCounts: validation.taxRuleCounts,
          partial: true,
          message: 'No rows were imported.',
        },
      },
      { status: 400 },
    );
  }

  try {
    const [existingCategories, existingBrands] = await Promise.all([
      prisma.category.findMany({ where: { tenantId, deletedAt: null } }),
      prisma.brand.findMany({ where: { tenantId, deletedAt: null } }),
    ]);

    const categoryMap = new Map(
      existingCategories.map((c) => [c.name.toLowerCase().trim(), c.id]),
    );
    const brandMap = new Map(
      existingBrands.map((b) => [b.name.toLowerCase().trim(), b.id]),
    );

    // Group valid rows by product name: one product, many variants.
    const groups = new Map<string, ValidRow[]>();
    for (const row of validRows) {
      const key = row.data.productName.toLowerCase().trim();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    let productsCreated = 0;
    let variantsCreated = 0;
    let skuCounter = 0;
    // Counts of defaults actually applied to imported rows (not to rows that
    // were rejected or whose product group failed).
    const appliedDefaults = { taxRule: 0, initialStock: 0 };
    const appliedTaxRuleCounts: Record<'STANDARD_VAT' | 'SSCL' | 'EXEMPT', number> = {
      STANDARD_VAT: 0,
      SSCL: 0,
      EXEMPT: 0,
    };
    // Shared across the whole import so two generated barcodes in the same
    // CSV can never collide with each other before they reach the DB.
    const takenBarcodes = new Set<string>();
    const productFailures: Array<{ rowNumber: number; reasons: string[] }> = [];

    for (const groupRows of groups.values()) {
      const first = groupRows[0];
      if (!first) continue;

      let createdProductId: string | null = null;
      try {
        // Find or create category
        let categoryId = categoryMap.get(first.data.category.toLowerCase().trim());
        if (!categoryId) {
          const newCat = await prisma.category.create({
            data: { tenantId, name: first.data.category.trim() },
          });
          categoryId = newCat.id;
          categoryMap.set(first.data.category.toLowerCase().trim(), categoryId);
        }

        // Find or create brand
        let brandId: string | null = null;
        if (first.data.brand) {
          brandId = brandMap.get(first.data.brand.toLowerCase().trim()) ?? null;
          if (!brandId) {
            const newBrand = await prisma.brand.create({
              data: { tenantId, name: first.data.brand.trim() },
            });
            brandId = newBrand.id;
            brandMap.set(first.data.brand.toLowerCase().trim(), brandId);
          }
        }

        const tags = first.data.tags
          ? first.data.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [];

        // Service path: createProductVariants records opening stock as an
        // INITIAL_STOCK movement (ARGUS #139) instead of writing the quantity
        // straight onto the variant.
        const product = await createProduct(tenantId, actorId, {
          name: first.data.productName.trim(),
          categoryId,
          tags,
          taxRule: first.data.taxRule,
          ...(first.data.description ? { description: first.data.description } : {}),
          ...(brandId ? { brandId } : {}),
        });
        createdProductId = product.id;

        const variants: CreateVariantInput[] = [];
        for (const row of groupRows) {
          const data = row.data;
          skuCounter++;
          const sku =
            data.sku?.trim() ||
            `IMP-${first.data.productName.substring(0, 3).toUpperCase()}-${skuCounter
              .toString()
              .padStart(4, '0')}`;
          const supplied = data.barcode?.trim();
          const barcode =
            supplied || (await allocateBarcode(prisma, tenantId, takenBarcodes));

          variants.push({
            sku,
            barcode,
            costPrice: data.costPrice,
            retailPrice: data.retailPrice,
            initialStock: data.initialStock,
            lowStockThreshold: data.lowStockThreshold,
            ...(data.form ? { form: data.form } : {}),
            ...(data.packSize ? { packSize: data.packSize } : {}),
            ...(data.wholesalePrice !== undefined
              ? { wholesalePrice: data.wholesalePrice }
              : {}),
          });
        }

        const created = await createProductVariants(
          tenantId,
          actorId,
          product.id,
          variants,
        );
        productsCreated++;
        variantsCreated += created.length;

        if (first.defaults.taxRule) appliedDefaults.taxRule++;
        for (const row of groupRows) {
          if (row.defaults.initialStock) appliedDefaults.initialStock++;
        }
        appliedTaxRuleCounts[first.data.taxRule]++;
      } catch (error) {
        // createProductVariants is transactional, so a failed group leaves the
        // just-created product empty. Remove it so a rejected row does not
        // leave a stray product behind.
        if (createdProductId) {
          await prisma.product
            .delete({ where: { id: createdProductId } })
            .catch(() => undefined);
        }
        const reason =
          error instanceof Error && error.message.trim() !== ''
            ? error.message
            : 'Could not import this product';
        for (const row of groupRows) {
          productFailures.push({ rowNumber: row.rowNumber, reasons: [reason] });
        }
      }
    }

    const rejected = [...validation.rejected, ...productFailures];
    const rowsRejected = rejected.length;
    const defaults = {
      taxRule: appliedDefaults.taxRule,
      initialStock: appliedDefaults.initialStock,
      // Missing cost rows are rejected too; the count keeps the old silent
      // default visible rather than hiding that decision.
      costPrice: validation.defaults.costPrice,
    };
    const defaultsApplied = defaults.taxRule + defaults.initialStock + defaults.costPrice;
    const partial = rowsRejected > 0 || defaultsApplied > 0;

    const messageParts = [
      `${productsCreated} product${productsCreated === 1 ? '' : 's'} and ` +
        `${variantsCreated} variant${variantsCreated === 1 ? '' : 's'} imported`,
    ];
    if (rowsRejected > 0) {
      messageParts.push(`${rowsRejected} row${rowsRejected === 1 ? '' : 's'} rejected`);
    }
    if (defaultsApplied > 0) {
      messageParts.push(
        `${defaultsApplied} default${defaultsApplied === 1 ? '' : 's'} applied`,
      );
    }
    const message = `${messageParts.join('; ')}.`;

    const summary = {
      productsCreated,
      variantsCreated,
      rowsReceived: validation.rowsReceived,
      rowsCreated: variantsCreated,
      rowsImported: variantsCreated,
      rowsRejected,
      rejected,
      defaults,
      taxRuleCounts: appliedTaxRuleCounts,
      partial,
      message,
    };

    if (variantsCreated === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message, details: rejected },
          data: summary,
        },
        { status: 400 },
      );
    }

    await createAuditLog({
      tenantId,
      actorId,
      actorRole: 'SYSTEM',
      entityType: 'Product',
      entityId: 'BULK_IMPORT',
      action: 'PRODUCTS_IMPORTED',
      after: summary as unknown as Prisma.InputJsonValue,
    });

    // Revalidate the catalog so imported products appear on the storefront immediately.
    try {
      await revalidateTenantStorefront(tenantId, { catalog: true });
    } catch (revalidateErr) {
      console.warn('[POST /api/store/products/import] Revalidation warning:', revalidateErr);
    }

    return NextResponse.json({ success: true, data: summary }, { status: 201 });
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
