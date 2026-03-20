import Decimal from 'decimal.js';
import { prisma } from '@/lib/prisma';
import type { SaleStatus, TaxRule } from '@/generated/prisma/client';
import { adjustStockInTx, type TxClient } from '@/lib/services/inventory.service';
import { createAuditLog } from '@/lib/services/audit.service';
import { createPayment } from '@/lib/services/payment.service';
import type { CreateSaleInput, HoldSaleInput } from '@/lib/validators/sale.validators';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildVariantDescription(colour: string | null, size: string | null): string {
  if (colour && size) return `${colour} / ${size}`;
  if (colour) return colour;
  if (size) return size;
  return 'ONE SIZE';
}

function getTaxRate(
  taxRule: TaxRule,
  vatRate: number,
  ssclRate: number,
): Decimal {
  switch (taxRule) {
    case 'STANDARD_VAT':
      return new Decimal(vatRate).div(100);
    case 'SSCL':
      return new Decimal(ssclRate).div(100);
    case 'EXEMPT':
      return new Decimal(0);
  }
}

function extractTenantRates(settings: unknown): { vatRate: number; ssclRate: number } {
  const s = settings as Record<string, unknown>;
  const vatRate = typeof s.vatRate === 'number' ? s.vatRate : 0;
  const ssclRate = typeof s.ssclRate === 'number' ? s.ssclRate : 0;
  return { vatRate, ssclRate };
}

// ── Create Sale ──────────────────────────────────────────────────────────────

export async function createSale(tenantId: string, input: CreateSaleInput & { cashierId: string }) {
  return prisma.$transaction(async (tx: TxClient) => {
    // Validate shift
    const shift = await tx.shift.findFirst({
      where: { id: input.shiftId, tenantId, status: 'OPEN' },
    });
    if (!shift) {
      throw new Error('Shift not found or not open');
    }

    // Get tenant settings for tax
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    const { vatRate, ssclRate } = extractTenantRates(tenant.settings);

    // Resolve variants and compute line data
    const lineData: Array<{
      variantId: string;
      productNameSnapshot: string;
      variantDescriptionSnapshot: string;
      sku: string;
      unitPrice: Decimal;
      quantity: number;
      discountPercent: Decimal;
      discountAmount: Decimal;
      lineTotalBeforeDiscount: Decimal;
      lineTotalAfterDiscount: Decimal;
      lineTax: Decimal;
      taxRule: TaxRule;
    }> = [];

    for (const line of input.lines) {
      const variant = await tx.productVariant.findFirst({
        where: { id: line.variantId, tenantId, deletedAt: null },
        include: { product: true },
      });
      if (!variant) {
        throw new Error(`Variant ${line.variantId} not found`);
      }

      if (variant.stockQuantity < line.quantity) {
        throw new Error(
          `Insufficient stock for ${variant.product.name} (${variant.sku}): available ${variant.stockQuantity}, requested ${line.quantity}`,
        );
      }

      const unitPrice = new Decimal(variant.retailPrice.toString());
      const quantity = new Decimal(line.quantity);
      const discountPercent = new Decimal(line.discountPercent);

      const lineTotalBeforeDiscount = unitPrice.mul(quantity).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const discountAmount = lineTotalBeforeDiscount
        .mul(discountPercent)
        .div(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const lineTotalAfterDiscount = lineTotalBeforeDiscount.minus(discountAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      const taxRate = getTaxRate(variant.product.taxRule, vatRate, ssclRate);
      const lineTax = lineTotalAfterDiscount.mul(taxRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      lineData.push({
        variantId: variant.id,
        productNameSnapshot: variant.product.name,
        variantDescriptionSnapshot: buildVariantDescription(variant.colour, variant.size),
        sku: variant.sku,
        unitPrice,
        quantity: line.quantity,
        discountPercent,
        discountAmount,
        lineTotalBeforeDiscount,
        lineTotalAfterDiscount,
        lineTax,
        taxRule: variant.product.taxRule,
      });
    }

    // Compute sale totals
    const subtotal = lineData.reduce(
      (sum, l) => sum.plus(l.lineTotalAfterDiscount),
      new Decimal(0),
    ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const cartDiscount = new Decimal(input.cartDiscountAmount);
    if (cartDiscount.greaterThan(subtotal)) {
      throw new Error('Cart discount cannot exceed subtotal');
    }

    const totalTax = lineData.reduce(
      (sum, l) => sum.plus(l.lineTax),
      new Decimal(0),
    ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const totalAmount = subtotal
      .minus(cartDiscount)
      .plus(totalTax)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // Create Sale
    const sale = await tx.sale.create({
      data: {
        tenantId,
        shiftId: input.shiftId,
        cashierId: input.cashierId,
        subtotal: subtotal.toNumber(),
        discountAmount: cartDiscount.toNumber(),
        taxAmount: totalTax.toNumber(),
        totalAmount: totalAmount.toNumber(),
        paymentMethod: input.paymentMethod,
        authorizingManagerId: input.authorizingManagerId ?? null,
        status: 'COMPLETED',
        completedAt: new Date(),
        lines: {
          create: lineData.map((l) => ({
            variantId: l.variantId,
            productNameSnapshot: l.productNameSnapshot,
            variantDescriptionSnapshot: l.variantDescriptionSnapshot,
            sku: l.sku,
            unitPrice: l.unitPrice.toNumber(),
            quantity: l.quantity,
            discountPercent: l.discountPercent.toNumber(),
            discountAmount: l.discountAmount.toNumber(),
            lineTotalBeforeDiscount: l.lineTotalBeforeDiscount.toNumber(),
            lineTotalAfterDiscount: l.lineTotalAfterDiscount.toNumber(),
          })),
        },
      },
      include: { lines: true },
    });

    // Adjust stock for each line
    for (const l of lineData) {
      await adjustStockInTx(tx, tenantId, l.variantId, input.cashierId, {
        quantityDelta: -l.quantity,
        reason: 'SALE',
        saleId: sale.id,
      });
    }

    // Create Payment records
    if (input.paymentMethod === 'CASH') {
      await createPayment({ saleId: sale.id, method: 'CASH', amount: totalAmount }, tx);
    } else if (input.paymentMethod === 'CARD') {
      await createPayment({ saleId: sale.id, method: 'CARD', amount: totalAmount, ...(input.cardReferenceNumber !== undefined && { cardReferenceNumber: input.cardReferenceNumber }) }, tx);
    } else if (input.paymentMethod === 'SPLIT') {
      const cardAmt = new Decimal(input.cardAmount!);
      const cashAmt = totalAmount.minus(cardAmt);
      await createPayment({ saleId: sale.id, method: 'CARD', amount: cardAmt, ...(input.cardReferenceNumber !== undefined && { cardReferenceNumber: input.cardReferenceNumber }) }, tx);
      await createPayment({ saleId: sale.id, method: 'CASH', amount: cashAmt }, tx);
    }

    // Compute and save change given for CASH / SPLIT
    if (input.paymentMethod === 'CASH' || input.paymentMethod === 'SPLIT') {
      const cashPortionAmount = input.paymentMethod === 'CASH' ? totalAmount : totalAmount.minus(new Decimal(input.cardAmount!));
      const cashReceivedDec = new Decimal(input.cashReceived!);
      const changeGiven = cashReceivedDec.minus(cashPortionAmount);
      if (changeGiven.greaterThan(0)) {
        await tx.sale.update({
          where: { id: sale.id },
          data: { changeGiven: changeGiven.toNumber() },
        });
      }
    }

    const completeSale = await tx.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: { lines: true, payments: true },
    });
    return completeSale;
  });
}

// ── Get Sale By ID ───────────────────────────────────────────────────────────

export async function getSaleById(tenantId: string, saleId: string) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, tenantId },
    include: {
      lines: {
        include: {
          variant: { include: { product: true } },
          returnLines: { select: { quantity: true } },
        },
      },
      cashier: { select: { id: true, email: true } },
      authorizingManager: { select: { id: true, email: true } },
      shift: { select: { id: true, openedAt: true, status: true } },
      payments: true,
    },
  });

  if (!sale) {
    throw new Error('Sale not found');
  }

  return {
    ...sale,
    lines: sale.lines.map(line => ({
      ...line,
      returnedQuantity: line.returnLines.reduce((sum, rl) => sum + rl.quantity, 0),
    })),
  };
}

// ── Get Sales (Paginated) ────────────────────────────────────────────────────

export interface GetSalesFilters {
  shiftId?: string | undefined;
  cashierId?: string | undefined;
  status?: SaleStatus | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export async function getSales(tenantId: string, filters: GetSalesFilters) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { tenantId };
  if (filters.shiftId) where.shiftId = filters.shiftId;
  if (filters.cashierId) where.cashierId = filters.cashierId;
  if (filters.status) where.status = filters.status;
  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};
    if (filters.from) createdAt.gte = filters.from;
    if (filters.to) createdAt.lte = filters.to;
    where.createdAt = createdAt;
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: { lines: { include: { returnLines: { select: { quantity: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.sale.count({ where }),
  ]);

  const enrichedSales = sales.map(sale => ({
    ...sale,
    lines: sale.lines.map(line => ({
      ...line,
      returnedQuantity: line.returnLines.reduce((sum, rl) => sum + rl.quantity, 0),
    })),
  }));

  return { sales: enrichedSales, total };
}

// ── Create Held Sale ─────────────────────────────────────────────────────────

export async function createHeldSale(
  tenantId: string,
  input: HoldSaleInput & { cashierId: string },
) {
  return prisma.$transaction(async (tx: TxClient) => {
    const shift = await tx.shift.findFirst({
      where: { id: input.shiftId, tenantId, status: 'OPEN' },
    });
    if (!shift) throw new Error('Shift not found or not open');

    const lineData = input.lines.map((line) => {
      const unitPrice = new Decimal(line.unitPrice);
      const quantity = new Decimal(line.quantity);
      const discountPercent = new Decimal(line.discountPercent);
      const lineTotalBeforeDiscount = unitPrice
        .mul(quantity)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const discountAmount = lineTotalBeforeDiscount
        .mul(discountPercent)
        .div(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const lineTotalAfterDiscount = lineTotalBeforeDiscount
        .minus(discountAmount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      return {
        variantId: line.variantId,
        productNameSnapshot: line.productNameSnapshot,
        variantDescriptionSnapshot: line.variantDescriptionSnapshot,
        sku: line.sku,
        unitPrice: unitPrice.toNumber(),
        quantity: line.quantity,
        discountPercent: discountPercent.toNumber(),
        discountAmount: discountAmount.toNumber(),
        lineTotalBeforeDiscount: lineTotalBeforeDiscount.toNumber(),
        lineTotalAfterDiscount: lineTotalAfterDiscount.toNumber(),
      };
    });

    const subtotal = lineData
      .reduce((sum, l) => sum.plus(l.lineTotalAfterDiscount), new Decimal(0))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    let cartDiscount: Decimal;
    if (input.cartDiscountPercent > 0) {
      cartDiscount = subtotal
        .mul(input.cartDiscountPercent)
        .div(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else {
      cartDiscount = new Decimal(input.cartDiscountAmount);
    }

    const totalAmount = subtotal
      .minus(cartDiscount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const sale = await tx.sale.create({
      data: {
        tenantId,
        shiftId: input.shiftId,
        cashierId: input.cashierId,
        subtotal: subtotal.toNumber(),
        discountAmount: cartDiscount.toNumber(),
        taxAmount: 0,
        totalAmount: totalAmount.toNumber(),
        paymentMethod: null,
        status: 'OPEN',
        lines: {
          create: lineData.map((l) => ({
            variantId: l.variantId,
            productNameSnapshot: l.productNameSnapshot,
            variantDescriptionSnapshot: l.variantDescriptionSnapshot,
            sku: l.sku,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            discountPercent: l.discountPercent,
            discountAmount: l.discountAmount,
            lineTotalBeforeDiscount: l.lineTotalBeforeDiscount,
            lineTotalAfterDiscount: l.lineTotalAfterDiscount,
          })),
        },
      },
      include: { lines: true },
    });

    return sale;
  });
}

// ── Void Sale ────────────────────────────────────────────────────────────────

export async function voidSale(tenantId: string, saleId: string, actorId: string) {
  return prisma.$transaction(async (tx: TxClient) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, tenantId },
      include: { lines: true },
    });

    if (!sale) {
      throw new Error('Sale not found');
    }
    if (sale.status !== 'COMPLETED') {
      throw new Error('Only completed sales can be voided');
    }

    // Verify shift is still open
    const shift = await tx.shift.findFirst({
      where: { id: sale.shiftId, tenantId, status: 'OPEN' },
    });
    if (!shift) {
      throw new Error('Shift is not open');
    }

    const updatedSale = await tx.sale.update({
      where: { id: saleId },
      data: {
        status: 'VOIDED',
        voidedById: actorId,
        voidedAt: new Date(),
      },
      include: { lines: true },
    });

    // Reverse stock for each line
    for (const line of sale.lines) {
      await adjustStockInTx(tx, tenantId, line.variantId, actorId, {
        quantityDelta: line.quantity,
        reason: 'VOID_REVERSAL',
        saleId: sale.id,
      });
    }

    // Audit log (best-effort)
    await createAuditLog({
      tenantId,
      actorId,
      actorRole: 'USER',
      entityType: 'Sale',
      entityId: saleId,
      action: 'SALE_VOIDED',
      before: { status: 'COMPLETED' },
      after: { status: 'VOIDED', voidedById: actorId },
    });

    return updatedSale;
  });
}

// ── Get Shift Sales ──────────────────────────────────────────────────────────

export async function getShiftSales(tenantId: string, shiftId: string) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId },
  });
  if (!shift) {
    throw new Error('Shift not found');
  }

  const sales = await prisma.sale.findMany({
    where: { shiftId, tenantId, status: { not: 'VOIDED' } },
    include: { lines: true },
    orderBy: { createdAt: 'desc' },
  });

  let totalAmount = new Decimal(0);
  let totalCashSales = new Decimal(0);
  let totalCardSales = new Decimal(0);
  let totalDiscountGiven = new Decimal(0);

  for (const sale of sales) {
    const saleTotal = new Decimal(sale.totalAmount.toString());
    totalAmount = totalAmount.plus(saleTotal);
    if (sale.paymentMethod === 'CASH') {
      totalCashSales = totalCashSales.plus(saleTotal);
    } else if (sale.paymentMethod === 'CARD') {
      totalCardSales = totalCardSales.plus(saleTotal);
    } else if (sale.paymentMethod === 'SPLIT') {
      // SPLIT counts toward both — callers can refine later
      totalCashSales = totalCashSales.plus(saleTotal);
    }
    totalDiscountGiven = totalDiscountGiven.plus(new Decimal(sale.discountAmount.toString()));
  }

  return {
    sales,
    summary: {
      totalSalesCount: sales.length,
      totalAmount: totalAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      totalCashSales: totalCashSales.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      totalCardSales: totalCardSales.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      totalDiscountGiven: totalDiscountGiven.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    },
  };
}
