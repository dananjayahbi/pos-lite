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
import type { GenderType, TaxRule } from '@/generated/prisma/client';
import { createAuditLog } from '@/lib/services/audit.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripUndefined<T extends object>(obj: T) {
  const result = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as { [K in keyof T]: Exclude<T[K], undefined> };
}

// ── Input Types ──────────────────────────────────────────────────────────────

export interface ProductFilters {
  search?: string | undefined;
  categoryId?: string | undefined;
  categoryIds?: string[] | undefined;
  brandId?: string | undefined;
  brandIds?: string[] | undefined;
  gender?: GenderType | undefined;
  genders?: GenderType[] | undefined;
  isArchived?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface CreateProductInput {
  name: string;
  description?: string | undefined;
  categoryId: string;
  brandId?: string | undefined;
  gender: GenderType;
  tags?: string[] | undefined;
  taxRule?: TaxRule | undefined;
}

export interface UpdateProductInput {
  name?: string | undefined;
  description?: string | undefined;
  categoryId?: string | undefined;
  brandId?: string | null | undefined;
  gender?: GenderType | undefined;
  tags?: string[] | undefined;
  taxRule?: TaxRule | undefined;
  isArchived?: boolean | undefined;
}

export interface CreateVariantInput {
  sku?: string | undefined;
  barcode?: string | undefined;
  size?: string | undefined;
  colour?: string | undefined;
  costPrice: number;
  retailPrice: number;
  wholesalePrice?: number | undefined;
  stockQuantity?: number | undefined;
  lowStockThreshold?: number | undefined;
  imageUrls?: string[] | undefined;
}

export interface UpdateVariantInput {
  sku?: string | undefined;
  barcode?: string | null | undefined;
  size?: string | undefined;
  colour?: string | undefined;
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
  parentId?: string;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  parentId?: string | null;
  sortOrder?: number;
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

function generateSku(brandName: string | null, colour: string | undefined | null, size: string | undefined | null): string {
  const brandCode = brandName ? brandName.replace(/\s/g, '').slice(0, 4).toUpperCase() : 'GEN';
  const colourCode = colour ? colour.replace(/\s/g, '').slice(0, 3).toUpperCase() : 'UNI';
  const sizeCode = size ? size.replace(/\s/g, '').slice(0, 4).toUpperCase() : 'OS';
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${brandCode}-${colourCode}-${sizeCode}-${random}`;
}

// ── Product Functions ────────────────────────────────────────────────────────

export async function getAllProducts(tenantId: string, filters: ProductFilters = {}) {
  const { search, categoryId, categoryIds, brandId, brandIds, gender, genders, isArchived, page = 1, limit = 20 } = filters;

  const where: Prisma.ProductWhereInput = {
    tenantId,
    deletedAt: null,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' as const } },
      { variants: { some: { sku: { contains: search, mode: 'insensitive' as const }, deletedAt: null } } },
      { variants: { some: { barcode: { contains: search, mode: 'insensitive' as const }, deletedAt: null } } },
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

  if (genders && genders.length > 0) {
    where.gender = { in: genders };
  } else if (gender) {
    where.gender = gender;
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
          where: { deletedAt: null },
          select: {
            id: true,
            sku: true,
            barcode: true,
            size: true,
            colour: true,
            stockQuantity: true,
            lowStockThreshold: true,
            imageUrls: true,
            retailPrice: true,
            costPrice: true,
          },
        },
        _count: {
          select: {
            variants: { where: { deletedAt: null } },
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
      gender: data.gender,
      tags: data.tags ?? [],
      taxRule: data.taxRule ?? 'STANDARD_VAT',
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
    sku: v.sku || generateSku(brandName, v.colour, v.size),
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
        size: v.size ?? null,
        colour: v.colour ?? null,
        costPrice: v.costPrice,
        retailPrice: v.retailPrice,
        wholesalePrice: v.wholesalePrice ?? null,
        stockQuantity: v.stockQuantity ?? 0,
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

  const updated = await prisma.product.update({
    where: { id: productId },
    data: stripUndefined(data),
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

  const updated = await prisma.productVariant.update({
    where: { id: variantId },
    data: stripUndefined(data),
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

// ── Variant Lookup Functions ─────────────────────────────────────────────────

export async function getVariantById(tenantId: string, variantId: string) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId, deletedAt: null },
    include: {
      product: { select: { id: true, name: true, categoryId: true, gender: true, taxRule: true } },
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
        select: { id: true, name: true, gender: true, taxRule: true, categoryId: true },
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
  // Check for duplicate name
  const existing = await prisma.category.findFirst({
    where: { tenantId, name: data.name, deletedAt: null },
  });

  if (existing) {
    throw new Error('A category with this name already exists');
  }

  // Verify parent if provided
  if (data.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: data.parentId, deletedAt: null },
    });
    if (!parent || parent.tenantId !== tenantId) {
      throw new Error('Parent category not found');
    }
  }

  return prisma.category.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description ?? null,
      parentId: data.parentId ?? null,
      sortOrder: data.sortOrder ?? 0,
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

  // Check name conflict on rename
  if (data.name && data.name !== existing.name) {
    const conflict = await prisma.category.findFirst({
      where: { tenantId, name: data.name, deletedAt: null, id: { not: categoryId } },
    });
    if (conflict) {
      throw new Error('A category with this name already exists');
    }
  }

  // Verify parent if changing
  if (data.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: data.parentId, deletedAt: null },
    });
    if (!parent || parent.tenantId !== tenantId) {
      throw new Error('Parent category not found');
    }
  }

  return prisma.category.update({
    where: { id: categoryId },
    data,
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
  const existing = await prisma.brand.findFirst({
    where: { tenantId, name: data.name, deletedAt: null },
  });

  if (existing) {
    throw new Error('A brand with this name already exists');
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

  // Check name conflict on rename
  if (data.name && data.name !== existing.name) {
    const conflict = await prisma.brand.findFirst({
      where: { tenantId, name: data.name, deletedAt: null, id: { not: brandId } },
    });
    if (conflict) {
      throw new Error('A brand with this name already exists');
    }
  }

  return prisma.brand.update({
    where: { id: brandId },
    data,
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
