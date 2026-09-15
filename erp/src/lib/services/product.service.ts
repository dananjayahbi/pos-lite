/**
 * Product Service Layer — sole entry point for all catalog read/write operations.
 *
 * IMPORTANT: This module never strips costPrice from variant data. The responsibility
 * for omitting costPrice from API responses rests entirely with the Route Handler.
 * This separation keeps the service layer usable in server-side contexts (reports,
 * PDF generation) where the full data is legitimately needed.
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import type { HealthConcern, ProductSource, TaxRule } from '@/generated/prisma/client';
import { createAuditLog, writeAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { ApiError } from '@/lib/api/errors';

// ── Helpers ──────────────────────────────────────────────────────────────────

// ── Input Types ──────────────────────────────────────────────────────────────

export interface ProductFilters {
  search?: string | undefined;
  categoryId?: string | undefined;
  categoryIds?: string[] | undefined;
  brandId?: string | undefined;
  brandIds?: string[] | undefined;
  /** Fetch a specific set of products by ID (used to hydrate pickers). */
  ids?: string[] | undefined;
  isArchived?: boolean | undefined;
  /**
   * M02-03 — opt-in "Deleted" view: when true, return ONLY soft-deleted
   * products (deletedAt != null). The default (false/undefined) keeps the
   * hard `deletedAt: null` filter that every other caller relies on.
   */
  includeDeleted?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface CreateProductInput {
  name: string;
  description?: string | undefined;
  categoryId: string;
  brandId?: string | undefined;
  tags?: string[] | undefined;
  taxRule?: TaxRule | undefined;
  mainImageUrl?: string | null | undefined;
  activeIngredients?: string | null | undefined;
  usageInstructions?: string | null | undefined;
  healthBenefits?: string | null | undefined;
  safetyPrecautions?: string | null | undefined;
  healthConcerns?: HealthConcern[] | undefined;
  productSource?: ProductSource | undefined;
}

export interface UpdateProductInput {
  name?: string | undefined;
  description?: string | undefined;
  categoryId?: string | undefined;
  brandId?: string | null | undefined;
  tags?: string[] | undefined;
  taxRule?: TaxRule | undefined;
  isArchived?: boolean | undefined;
  mainImageUrl?: string | null | undefined;
  activeIngredients?: string | null | undefined;
  usageInstructions?: string | null | undefined;
  healthBenefits?: string | null | undefined;
  safetyPrecautions?: string | null | undefined;
  healthConcerns?: HealthConcern[] | undefined;
  productSource?: ProductSource | undefined;
}

export interface CreateVariantInput {
  sku?: string | undefined;
  barcode?: string | undefined;
  form?: string | undefined;
  packSize?: string | undefined;
  costPrice: number;
  retailPrice: number;
  wholesalePrice?: number | undefined;
  stockQuantity?: number | undefined;
  initialStock?: number | undefined;
  lowStockThreshold?: number | undefined;
  imageUrls?: string[] | undefined;
}

export interface UpdateVariantInput {
  sku?: string | undefined;
  barcode?: string | null | undefined;
  form?: string | null | undefined;
  packSize?: string | null | undefined;
  costPrice?: number | undefined;
  retailPrice?: number | undefined;
  wholesalePrice?: number | null | undefined;
  stockQuantity?: number | undefined;
  lowStockThreshold?: number | undefined;
  imageUrls?: string[] | undefined;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  sortOrder?: number;
  imageUrl?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  sortOrder?: number;
  imageUrl?: string | null;
}

export interface CreateBrandInput {
  name: string;
  description?: string;
  logoUrl?: string;
}

export interface UpdateBrandInput {
  name?: string;
  description?: string;
  logoUrl?: string | null;
}

// ── SKU Generation (private) ─────────────────────────────────────────────────

function generateSku(brandName: string | null, form: string | undefined | null, packSize: string | undefined | null): string {
  const brandCode = brandName ? brandName.replace(/\s/g, '').slice(0, 4).toUpperCase() : 'GEN';
  const formCode = form ? form.replace(/\s/g, '').slice(0, 3).toUpperCase() : 'UNI';
  const packCode = packSize ? packSize.replace(/\s/g, '').slice(0, 4).toUpperCase() : 'OS';
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${brandCode}-${formCode}-${packCode}-${random}`;
}

// ── Product Functions ────────────────────────────────────────────────────────

export async function getAllProducts(tenantId: string, filters: ProductFilters = {}) {
  const { search, categoryId, categoryIds, brandId, brandIds, ids, isArchived, includeDeleted, page = 1, limit = 20 } = filters;

  // M02-03: `includeDeleted` flips the hard filter into the "Deleted" view —
  // ONLY soft-deleted rows. Default behavior (deletedAt: null) is unchanged.
  const where: Prisma.ProductWhereInput = {
    tenantId,
    deletedAt: includeDeleted ? { not: null } : null,
  };

  if (ids && ids.length > 0) {
    where.id = { in: ids };
  }

  if (search) {
    // In the deleted view the variants are soft-deleted too, so the variant
    // sub-conditions must not re-filter them by deletedAt: null.
    const variantSearch = includeDeleted ? {} : { deletedAt: null };
    where.OR = [
      { name: { contains: search, mode: 'insensitive' as const } },
      { variants: { some: { sku: { contains: search, mode: 'insensitive' as const }, ...variantSearch } } },
      { variants: { some: { barcode: { contains: search, mode: 'insensitive' as const }, ...variantSearch } } },
    ];
  }

  if (categoryIds && categoryIds.length > 0) {
    where.categoryId = { in: categoryIds };
  } else if (categoryId) {
    where.categoryId = categoryId;
  }

  if (brandIds && brandIds.length > 0) {
    where.brandId = { in: brandIds };
  } else if (brandId) {
    where.brandId = brandId;
  }

  if (isArchived !== undefined) {
    where.isArchived = isArchived;
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        variants: {
          // Mirror the product-level filter: the Deleted view shows the
          // soft-deleted variants (so SKU/stock are visible before restore).
          where: { deletedAt: includeDeleted ? { not: null } : null },
          select: {
            id: true,
            sku: true,
            barcode: true,
            form: true,
            packSize: true,
            stockQuantity: true,
            lowStockThreshold: true,
            imageUrls: true,
            retailPrice: true,
            costPrice: true,
            // Batch/expiry summary (doc 30) — surfaced in inventory lists.
            batchTrackings: {
              where: { quantity: { gt: 0 } },
              select: { id: true, batchNumber: true, expiryDate: true, quantity: true },
              orderBy: { receivedAt: 'desc' },
            },
          },
        },
        _count: {
          select: {
            variants: { where: { deletedAt: includeDeleted ? { not: null } : null } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return { products, total };
}

export async function getProductById(tenantId: string, productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId, deletedAt: null },
    include: {
      category: true,
      brand: true,
      variants: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
    },
  });

  if (!product || product.tenantId !== tenantId) {
    throw new Error('Product not found');
  }

  return product;
}

export async function createProduct(tenantId: string, actorId: string, data: CreateProductInput) {
  const product = await prisma.product.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description ?? null,
      categoryId: data.categoryId,
      brandId: data.brandId ?? null,
      tags: data.tags ?? [],
      taxRule: data.taxRule ?? 'STANDARD_VAT',
      mainImageUrl: data.mainImageUrl ?? null,
      activeIngredients: data.activeIngredients ?? null,
      usageInstructions: data.usageInstructions ?? null,
      healthBenefits: data.healthBenefits ?? null,
      safetyPrecautions: data.safetyPrecautions ?? null,
      healthConcerns: data.healthConcerns ?? [],
      productSource: data.productSource ?? 'MANUFACTURED',
    },
    include: {
      category: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
    },
  });

  await createAuditLog({
    tenantId,
    actorId,
    actorRole: 'SYSTEM',
    entityType: 'Product',
    entityId: product.id,
    action: 'PRODUCT_CREATED',
    after: { name: product.name, categoryId: product.categoryId, brandId: product.brandId } as unknown as Prisma.InputJsonValue,
  });

  return product;
}

export async function createProductVariants(
  tenantId: string,
  productId: string,
  variants: CreateVariantInput[],
) {
  const product = await prisma.product.findUnique({
    where: { id: productId, deletedAt: null },
    include: { brand: { select: { name: true } } },
  });

  if (!product || product.tenantId !== tenantId) {
    throw new Error('Product not found');
  }

  const brandName = product.brand?.name ?? null;

  // Resolve SKUs
  const resolvedVariants = variants.map((v) => ({
    ...v,
    sku: v.sku || generateSku(brandName, v.form, v.packSize),
  }));

  // Check for duplicate SKUs within the batch
  const skuSet = new Set<string>();
  for (const v of resolvedVariants) {
    if (skuSet.has(v.sku)) {
      throw new Error(`Duplicate SKU in batch: ${v.sku}`);
    }
    skuSet.add(v.sku);
  }

  // Check for existing SKUs in the same tenant
  const existingSkus = await prisma.productVariant.findMany({
    where: {
      tenantId,
      sku: { in: resolvedVariants.map((v) => v.sku) },
      deletedAt: null,
    },
    select: { sku: true },
  });

  if (existingSkus.length > 0) {
    const conflicting = existingSkus.map((e) => e.sku).join(', ');
    throw new Error(`SKU already exists: ${conflicting}`);
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.productVariant.createMany({
      data: resolvedVariants.map((v) => ({
        productId,
        tenantId,
        sku: v.sku,
        barcode: v.barcode ?? null,
        form: v.form ?? null,
        packSize: v.packSize ?? null,
        costPrice: v.costPrice,
        retailPrice: v.retailPrice,
        wholesalePrice: v.wholesalePrice ?? null,
        stockQuantity: v.initialStock ?? v.stockQuantity ?? 0,
        lowStockThreshold: v.lowStockThreshold ?? 5,
        imageUrls: v.imageUrls ?? [],
      })),
    });

    return tx.productVariant.findMany({
      where: {
        productId,
        tenantId,
        sku: { in: resolvedVariants.map((v) => v.sku) },
      },
    });
  });

  return created;
}

export async function updateProduct(
  tenantId: string,
  productId: string,
  actorId: string,
  data: UpdateProductInput,
) {
  const existing = await prisma.product.findUnique({
    where: { id: productId, deletedAt: null },
  });

  if (!existing || existing.tenantId !== tenantId) {
    throw new Error('Product not found');
  }

  // If categoryId is changing, verify the new category belongs to the same tenant
  if (data.categoryId && data.categoryId !== existing.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId, deletedAt: null },
    });
    if (!category || category.tenantId !== tenantId) {
      throw new Error('Category not found');
    }
  }

  const updateData: Prisma.ProductUncheckedUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.brandId !== undefined) updateData.brandId = data.brandId;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.taxRule !== undefined) updateData.taxRule = data.taxRule;
  if (data.isArchived !== undefined) updateData.isArchived = data.isArchived;
  if (data.mainImageUrl !== undefined) updateData.mainImageUrl = data.mainImageUrl;
  if (data.activeIngredients !== undefined) updateData.activeIngredients = data.activeIngredients;
  if (data.usageInstructions !== undefined) updateData.usageInstructions = data.usageInstructions;
  if (data.healthBenefits !== undefined) updateData.healthBenefits = data.healthBenefits;
  if (data.safetyPrecautions !== undefined) updateData.safetyPrecautions = data.safetyPrecautions;
  if (data.healthConcerns !== undefined) updateData.healthConcerns = data.healthConcerns;
  if (data.productSource !== undefined) updateData.productSource = data.productSource;

  const updated = await prisma.product.update({
    where: { id: productId },
    // Explicitly-typed unchecked input so scalar FK fields (categoryId,
    // brandId, mainImageUrl) are accepted at runtime rather than Prisma
    // resolving to the checked relation input.
    data: updateData,
    include: {
      category: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
    },
  });

  await createAuditLog({
    tenantId,
    actorId,
    actorRole: 'SYSTEM',
    entityType: 'Product',
    entityId: productId,
    action: 'PRODUCT_UPDATED',
    before: { name: existing.name, categoryId: existing.categoryId, brandId: existing.brandId, isArchived: existing.isArchived } as unknown as Prisma.InputJsonValue,
    after: data as unknown as Prisma.InputJsonValue,
  });

  return updated;
}

export async function updateProductVariant(
  tenantId: string,
  variantId: string,
  actorId: string,
  data: UpdateVariantInput,
) {
  const existing = await prisma.productVariant.findUnique({
    where: { id: variantId, deletedAt: null },
  });

  if (!existing || existing.tenantId !== tenantId) {
    throw new Error('Variant not found');
  }

  // Price change audit
  const priceFields = ['costPrice', 'retailPrice', 'wholesalePrice'] as const;
  const priceChanged = priceFields.some(
    (f) => data[f] !== undefined && String(data[f]) !== String(existing[f]),
  );

  if (priceChanged) {
    const beforePrices: Record<string, unknown> = {};
    const afterPrices: Record<string, unknown> = {};
    for (const f of priceFields) {
      if (data[f] !== undefined) {
        beforePrices[f] = existing[f]?.toString() ?? null;
        afterPrices[f] = data[f]?.toString() ?? null;
      }
    }

    await createAuditLog({
      tenantId,
      actorId,
      actorRole: 'SYSTEM',
      entityType: 'ProductVariant',
      entityId: variantId,
      action: 'VARIANT_PRICE_CHANGED',
      before: beforePrices as unknown as Prisma.InputJsonValue,
      after: afterPrices as unknown as Prisma.InputJsonValue,
    });
  }

  const updateData: Prisma.ProductVariantUncheckedUpdateInput = {};
  if (data.sku !== undefined) updateData.sku = data.sku;
  if (data.barcode !== undefined) updateData.barcode = data.barcode;
  if (data.form !== undefined) updateData.form = data.form;
  if (data.packSize !== undefined) updateData.packSize = data.packSize;
  if (data.costPrice !== undefined) updateData.costPrice = data.costPrice;
  if (data.retailPrice !== undefined) updateData.retailPrice = data.retailPrice;
  if (data.wholesalePrice !== undefined) updateData.wholesalePrice = data.wholesalePrice;
  if (data.stockQuantity !== undefined) updateData.stockQuantity = data.stockQuantity;
  if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = data.lowStockThreshold;
  if (data.imageUrls !== undefined) updateData.imageUrls = data.imageUrls;

  const updated = await prisma.productVariant.update({
    where: { id: variantId },
    // Explicitly-typed unchecked input so scalar variant fields are
    // accepted at runtime (matches the updateProduct pattern).
    data: updateData,
  });

  return updated;
}

export async function softDeleteProduct(tenantId: string, productId: string, actorId: string) {
  const existing = await prisma.product.findUnique({
    where: { id: productId, deletedAt: null },
  });

  if (!existing || existing.tenantId !== tenantId) {
    throw new Error('Product not found');
  }

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id: productId },
      data: { deletedAt: now },
    });

    await tx.productVariant.updateMany({
      where: { productId, deletedAt: null },
      data: { deletedAt: now },
    });

    return product;
  });

  await createAuditLog({
    tenantId,
    actorId,
    actorRole: 'SYSTEM',
    entityType: 'Product',
    entityId: productId,
    action: 'PRODUCT_DELETED',
    before: { name: existing.name } as unknown as Prisma.InputJsonValue,
  });

  return updated;
}

export async function archiveProduct(tenantId: string, productId: string, actorId: string) {
  const existing = await prisma.product.findUnique({
    where: { id: productId, deletedAt: null },
  });

  if (!existing || existing.tenantId !== tenantId) {
    throw new Error('Product not found');
  }

  const newValue = !existing.isArchived;

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { isArchived: newValue },
  });

  await createAuditLog({
    tenantId,
    actorId,
    actorRole: 'SYSTEM',
    entityType: 'Product',
    entityId: productId,
    action: newValue ? 'PRODUCT_ARCHIVED' : 'PRODUCT_UNARCHIVED',
    after: { isArchived: newValue } as unknown as Prisma.InputJsonValue,
  });

  return updated;
}

/**
 * M02-03 (BUG-20 / D4 policy) — undo a soft delete: clear `deletedAt` on the
 * product AND its variants (exactly the scope `softDeleteProduct` sets), so
 * stock/prices come back untouched.
 *
 * Idempotency: restoring a live product is a 409, not a silent 200 no-op —
 * the caller almost certainly has stale UI state and deserves an honest
 * "already restored" signal.
 *
 * SKU guard: names/SKUs are RESERVED after soft-delete (D4), so a duplicate
 * create is rejected while the product is deleted. As a belt-and-braces
 * check, if some OTHER live product somehow holds a variant SKU of this
 * product (e.g. data written before the pre-check shipped), refuse the
 * restore with 409 rather than letting the @@unique([tenantId, sku])
 * constraint throw a raw 500.
 */
export async function restoreProduct(
  tenantId: string,
  productId: string,
  actor: { id: string; role: string },
) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    include: {
      variants: {
        where: { deletedAt: { not: null } },
        select: { id: true, sku: true },
      },
    },
  });

  if (!existing) {
    throw ApiError.notFound('Product not found');
  }

  if (!existing.deletedAt) {
    throw ApiError.conflict('Product is not deleted');
  }

  // SKU collision guard: any of this product's (deleted) variant SKUs already
  // owned by a LIVE variant of another product blocks the restore.
  const skus = existing.variants.map((v) => v.sku);
  if (skus.length > 0) {
    const collision = await prisma.productVariant.findFirst({
      where: {
        tenantId,
        sku: { in: skus },
        deletedAt: null,
        productId: { not: productId },
      },
      select: { sku: true },
    });
    if (collision) {
      throw ApiError.conflict(
        `Restore blocked: SKU ${collision.sku} now belongs to another product`,
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id: productId },
      data: { deletedAt: null },
    });

    // Mirror softDeleteProduct's scope exactly: it set deletedAt on every
    // variant of this product; restore clears the same set.
    await tx.productVariant.updateMany({
      where: { productId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });

    return product;
  });

  await writeAuditLog({
    tenantId,
    actorId: actor.id,
    actorRole: actor.role,
    entityType: 'Product',
    entityId: productId,
    action: AUDIT_ACTIONS.PRODUCT_RESTORED,
    before: { deletedAt: existing.deletedAt } as unknown as Prisma.InputJsonValue,
    after: { deletedAt: null } as unknown as Prisma.InputJsonValue,
  });

  return updated;
}

// ── Variant Lookup Functions ─────────────────────────────────────────────────

export async function getVariantById(tenantId: string, variantId: string) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId, deletedAt: null },
    include: {
      product: { select: { id: true, name: true, categoryId: true, taxRule: true } },
    },
  });

  if (!variant || variant.tenantId !== tenantId) {
    throw new Error('Variant not found');
  }

  return variant;
}

export async function getVariantByBarcode(tenantId: string, barcode: string) {
  const variant = await prisma.productVariant.findFirst({
    where: {
      tenantId,
      barcode,
      deletedAt: null,
    },
    include: {
      product: {
        select: { id: true, name: true, taxRule: true, categoryId: true },
      },
    },
  });

  return variant;
}

export async function softDeleteVariant(tenantId: string, variantId: string, actorId: string) {
  const existing = await prisma.productVariant.findUnique({
    where: { id: variantId, deletedAt: null },
  });

  if (!existing || existing.tenantId !== tenantId) {
    throw new Error('Variant not found');
  }

  const updated = await prisma.productVariant.update({
    where: { id: variantId },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    tenantId,
    actorId,
    actorRole: 'SYSTEM',
    entityType: 'ProductVariant',
    entityId: variantId,
    action: 'VARIANT_DELETED',
    before: { sku: existing.sku } as unknown as Prisma.InputJsonValue,
  });

  return updated;
}

// ── Category Functions ───────────────────────────────────────────────────────

export async function getCategoryById(tenantId: string, categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId, deletedAt: null },
    include: {
      _count: {
        select: {
          products: { where: { deletedAt: null } },
        },
      },
    },
  });

  if (!category || category.tenantId !== tenantId) {
    throw new Error('Category not found');
  }

  return category;
}

export async function getAllCategories(tenantId: string) {
  return prisma.category.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          products: { where: { deletedAt: null } },
        },
      },
    },
  });
}

export async function createCategory(tenantId: string, data: CreateCategoryInput) {
  // M04-01 (D4 policy): the name is reserved while ANY row carries it — live
  // or soft-deleted — because @@unique([tenantId, name]) keeps archived rows
  // holding the name. A deletedAt-agnostic pre-check surfaces the friendly
  // 409 from the service instead of letting the DB throw a raw P2002 dump;
  // mapPrismaError in toErrorResponse stays the belt-and-braces safety net
  // for races between this check and the insert (BUG-21).
  const existing = await prisma.category.findFirst({
    where: { tenantId, name: data.name },
  });

  if (existing) {
    throw ApiError.conflict(
      existing.deletedAt
        ? 'A category with this name already exists (an archived record uses this name)'
        : 'A category with this name already exists',
    );
  }

  return prisma.category.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description ?? null,
      sortOrder: data.sortOrder ?? 0,
      imageUrl: data.imageUrl ?? null,
    },
  });
}

export async function updateCategory(
  tenantId: string,
  categoryId: string,
  data: UpdateCategoryInput,
) {
  const existing = await prisma.category.findUnique({
    where: { id: categoryId, deletedAt: null },
  });

  if (!existing || existing.tenantId !== tenantId) {
    throw new Error('Category not found');
  }

  // Check name conflict on rename — M04-01 (D4): archived rows still reserve
  // the name at the DB, so the pre-check is deletedAt-agnostic and throws a
  // typed 409 with the friendly message (P2002 mapper stays the safety net).
  if (data.name && data.name !== existing.name) {
    const conflict = await prisma.category.findFirst({
      where: { tenantId, name: data.name, id: { not: categoryId } },
    });
    if (conflict) {
      throw ApiError.conflict(
        conflict.deletedAt
          ? 'A category with this name already exists (an archived record uses this name)'
          : 'A category with this name already exists',
      );
    }
  }

  // Build the unchecked input explicitly so scalar fields (imageUrl) are
  // accepted at runtime rather than Prisma resolving to the checked relation
  // input (which rejects scalar FK / image fields).
  const updateData: Prisma.CategoryUncheckedUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;

  return prisma.category.update({
    where: { id: categoryId },
    data: updateData,
  });
}

export async function softDeleteCategory(tenantId: string, categoryId: string, actorId: string) {
  const existing = await prisma.category.findUnique({
    where: { id: categoryId, deletedAt: null },
  });

  if (!existing || existing.tenantId !== tenantId) {
    throw new Error('Category not found');
  }

  // Check for dependent products
  const productCount = await prisma.product.count({
    where: { categoryId, deletedAt: null },
  });

  if (productCount > 0) {
    throw new Error('Cannot delete category while products are assigned to it');
  }

  const updated = await prisma.category.update({
    where: { id: categoryId },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    tenantId,
    actorId,
    actorRole: 'SYSTEM',
    entityType: 'Category',
    entityId: categoryId,
    action: 'CATEGORY_DELETED',
    before: { name: existing.name } as unknown as Prisma.InputJsonValue,
  });

  return updated;
}

// ── Brand Functions ──────────────────────────────────────────────────────────

export async function getBrandById(tenantId: string, brandId: string) {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId, deletedAt: null },
    include: {
      _count: {
        select: {
          products: { where: { deletedAt: null } },
        },
      },
    },
  });

  if (!brand || brand.tenantId !== tenantId) {
    throw new Error('Brand not found');
  }

  return brand;
}

export async function getAllBrands(tenantId: string) {
  return prisma.brand.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      _count: {
        select: {
          products: { where: { deletedAt: null } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function createBrand(tenantId: string, data: CreateBrandInput) {
  // M04-01 (D4 policy): deletedAt-agnostic name reservation — see
  // createCategory above for the full rationale (BUG-21 belt-and-braces).
  const existing = await prisma.brand.findFirst({
    where: { tenantId, name: data.name },
  });

  if (existing) {
    throw ApiError.conflict(
      existing.deletedAt
        ? 'A brand with this name already exists (an archived record uses this name)'
        : 'A brand with this name already exists',
    );
  }

  return prisma.brand.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description ?? null,
      logoUrl: data.logoUrl ?? null,
    },
  });
}

export async function updateBrand(tenantId: string, brandId: string, data: UpdateBrandInput) {
  const existing = await prisma.brand.findUnique({
    where: { id: brandId, deletedAt: null },
  });

  if (!existing || existing.tenantId !== tenantId) {
    throw new Error('Brand not found');
  }

  // Check name conflict on rename — M04-01 (D4): deletedAt-agnostic, see the
  // category update above (BUG-21 belt-and-braces).
  if (data.name && data.name !== existing.name) {
    const conflict = await prisma.brand.findFirst({
      where: { tenantId, name: data.name, id: { not: brandId } },
    });
    if (conflict) {
      throw ApiError.conflict(
        conflict.deletedAt
          ? 'A brand with this name already exists (an archived record uses this name)'
          : 'A brand with this name already exists',
      );
    }
  }

  // Build the unchecked input explicitly so scalar fields (logoUrl) are
  // accepted at runtime rather than Prisma resolving to the checked relation
  // input (which rejects scalar fields).
  const updateData: Prisma.BrandUncheckedUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;

  return prisma.brand.update({
    where: { id: brandId },
    data: updateData,
  });
}

export async function softDeleteBrand(tenantId: string, brandId: string, actorId: string) {
  const existing = await prisma.brand.findUnique({
    where: { id: brandId, deletedAt: null },
  });

  if (!existing || existing.tenantId !== tenantId) {
    throw new Error('Brand not found');
  }

  // Check for dependent products
  const productCount = await prisma.product.count({
    where: { brandId, deletedAt: null },
  });

  if (productCount > 0) {
    throw new Error('Cannot delete brand while products are assigned to it');
  }

  const updated = await prisma.brand.update({
    where: { id: brandId },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    tenantId,
    actorId,
    actorRole: 'SYSTEM',
    entityType: 'Brand',
    entityId: brandId,
    action: 'BRAND_DELETED',
    before: { name: existing.name } as unknown as Prisma.InputJsonValue,
  });

  return updated;
}
