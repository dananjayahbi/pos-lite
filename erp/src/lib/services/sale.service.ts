import Decimal from 'decimal.js';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import type { Prisma, SaleStatus, TaxRule, PaymentMethod } from '@/generated/prisma/client';
import { adjustStockInTx, type TxClient } from '@/lib/services/inventory.service';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { createPayment } from '@/lib/services/payment.service';
import { buildSaleAccountLegs, postSaleToAccounts, reverseSaleAccounts } from '@/lib/services/saleAccounts';
import { redeemCredit, addToSpendTotal, issueCredit, reverseSpendOnVoid } from '@/lib/services/customer.service';
import { kickCashDrawer } from '@/lib/hardware/cashDrawer';
import type { PrinterConfig } from '@/lib/hardware/printer';
import type { CreateSaleInput, HoldSaleInput, UpdateSaleInput } from '@/lib/validators/sale.validators';
import { setSentryTenantContext } from '@/lib/sentry/context';
import { dispatchWebhooks } from '@/lib/webhooks/dispatch';
import { allocateCartDiscountShares } from '@/lib/services/saleDiscount.core';
import { buildSaleTenderLegs, sumRedeemedCreditLegs } from '@/lib/services/saleTender.core';
import { resolveCashTender } from '@/lib/services/saleCashTender.core';
import { assertSaleVoidable } from '@/lib/services/saleVoid.core';
import { assertCompletedSaleShape } from '@/lib/services/saleCompleteness.core';
import {
  assertDiscountsAuthorized,
  cartDiscountPercent,
  clampPromotionDiscounts,
  reconcileSaleDiscount,
  sumClientPromotionDiscount,
} from '@/lib/services/saleDiscountValidation.core';
import { evaluatePromotions } from '@/lib/services/promotion.service';
import { notifySaleVoided } from '@/lib/notifications/sale-alert-service';
import { reconcileCommissionForSale } from '@/lib/services/commission.service';
import { resolveTaxRate } from '@/lib/pricing/taxRules.core';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildVariantDescription(form: string | null, packSize: string | null): string {
  if (form && packSize) return `${form} / ${packSize}`;
  if (form) return form;
  if (packSize) return packSize;
  return 'Default';
}

// Tax rules are mutually exclusive: exactly one of VAT, SSCL or exempt applies
// per line (ARGUS #469). The shared pure resolver is also used by the cart
// preview so the two can never drift.

export function extractTenantRates(settings: unknown): { vatRate: number; ssclRate: number } {
  const s = settings as Record<string, unknown>;
  const vatRate = typeof s.vatRate === 'number' ? s.vatRate : 0;
  const ssclRate = typeof s.ssclRate === 'number' ? s.ssclRate : 0;
  return { vatRate, ssclRate };
}

// ── Create Sale ──────────────────────────────────────────────────────────────

export async function createSale(tenantId: string, input: CreateSaleInput & { cashierId: string }) {
  setSentryTenantContext({
    tenantId,
    tenantSlug: tenantId,
    userId: input.cashierId,
    userEmail: '',
  });

  const result = await prisma.$transaction(async (tx: TxClient) => {
    // POS sales must belong to an open shift. Management sales may be
    // recorded without a shift when no shiftId is supplied.
    if (input.shiftId) {
      const shift = await tx.shift.findFirst({
        where: { id: input.shiftId, tenantId, status: 'OPEN' },
      });
      if (!shift) {
        throw new Error('Shift not found or not open');
      }
    }

    // POS sales must be linked to a customer unless the operator recorded an
    // explicit walk-in/guest sale. Management sales may omit the customer, but
    // still validate the link when one is supplied.
    if (input.shiftId && !input.customerId && !input.isGuestSale) {
      throw new Error('A customer must be linked to finalize a POS sale');
    }
    // Store credit is customer-scoped: a guest sale must never redeem it.
    const requestedCredit = Number.parseFloat(input.appliedStoreCredit ?? '0');
    if (!input.customerId && Number.isFinite(requestedCredit) && requestedCredit > 0) {
      throw new ApiError(
        400,
        'STORE_CREDIT_REQUIRES_CUSTOMER',
        'Store credit cannot be applied to a guest sale - link a customer first',
        { path: ['appliedStoreCredit'] },
      );
    }
    // `isGuestSale` without an open shift is a management back-office sale; it
    // is persisted as customerId = null exactly like a shiftless one.
    let linkedCreditBalance: Decimal | null = null;
    if (input.customerId) {
      const linkedCustomer = await tx.customer.findFirst({
        where: { id: input.customerId, tenantId, deletedAt: null },
      });
      if (!linkedCustomer) {
        throw new Error('Linked customer not found');
      }
      if (!linkedCustomer.name || !linkedCustomer.phone) {
        throw new Error('Linked customer must have a name and a mobile number');
      }
      linkedCreditBalance = new Decimal(linkedCustomer.creditBalance.toString());
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

    // ── Linked EXCHANGE return (ARGUS #93) ─────────────────────────────
    // An exchange refunds the returned goods as credit toward the replacement
    // sale. The return supplies the credit; the sale records the link so the
    // customer's value is traceable and cannot be spent twice.
    let linkedReturn: { id: string; refundAmount: Decimal } | null = null;
    if (input.linkedReturnId) {
      const exchangeReturn = await tx.return.findFirst({
        where: { id: input.linkedReturnId, tenantId },
        select: { id: true, refundMethod: true, status: true, refundAmount: true },
      });
      if (!exchangeReturn) {
        throw new ApiError(400, 'RETURN_NOT_FOUND', 'The linked return was not found');
      }
      if (exchangeReturn.status !== 'COMPLETED') {
        throw new ApiError(
          400,
          'RETURN_NOT_COMPLETED',
          'Only a completed return can fund a replacement sale',
        );
      }
      if (exchangeReturn.refundMethod !== 'EXCHANGE') {
        throw new ApiError(
          400,
          'RETURN_NOT_EXCHANGE',
          'Only an exchange return can be linked to a replacement sale',
        );
      }
      const alreadyLinked = await tx.sale.findFirst({
        where: { tenantId, linkedReturnId: exchangeReturn.id },
        select: { id: true },
      });
      if (alreadyLinked) {
        throw new ApiError(
          409,
          'RETURN_ALREADY_LINKED',
          'This return already has a linked replacement sale',
        );
      }
      linkedReturn = {
        id: exchangeReturn.id,
        refundAmount: new Decimal(exchangeReturn.refundAmount.toString()),
      };
    }

    // Resolve variants and compute line data
    const lineData: Array<{
      variantId: string;
      productNameSnapshot: string;
      variantDescriptionSnapshot: string;
      sku: string;
      unitPrice: Decimal;
      costPriceSnapshot: Decimal;
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

      lineData.push({
        variantId: variant.id,
        productNameSnapshot: variant.product.name,
        variantDescriptionSnapshot: buildVariantDescription(variant.form, variant.packSize),
        sku: variant.sku,
        unitPrice,
        costPriceSnapshot: new Decimal(variant.costPrice.toString()),
        quantity: line.quantity,
        discountPercent,
        discountAmount,
        lineTotalBeforeDiscount,
        lineTotalAfterDiscount,
        // Placeholder — the cart-level discount is allocated across lines below,
        // then each line is taxed on what the customer actually pays for it.
        lineTax: new Decimal(0),
        taxRule: variant.product.taxRule,
      });
    }

    // Compute sale totals
    const subtotal = lineData
      .reduce((sum, l) => sum.plus(l.lineTotalAfterDiscount), new Decimal(0))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // ── Discount / promotion authorization (ARGUS #321) ────────────────
    // The cart sends one combined `cartDiscountAmount` (manual + promotions),
    // and the promotion records are opaque. Re-evaluate promotions server-side
    // and reject a stale/mismatched claim; enforce the cashier thresholds with
    // a real manager override instead of trusting the client.
    const cashier = await tx.user.findUnique({
      where: { id: input.cashierId },
      select: { role: true },
    });
    const hasManagerRole =
      cashier?.role === 'MANAGER' || cashier?.role === 'OWNER' || cashier?.role === 'SUPER_ADMIN';

    let hasValidOverride = false;
    if (input.authorizingManagerId) {
      const manager = await tx.user.findFirst({
        where: {
          id: input.authorizingManagerId,
          tenantId,
          isActive: true,
          role: { in: ['MANAGER', 'OWNER', 'SUPER_ADMIN'] },
        },
        select: { id: true },
      });
      if (!manager) {
        throw new ApiError(
          400,
          'INVALID_AUTHORIZING_MANAGER',
          'The authorizing manager is not an active manager/owner in this store',
          { path: ['authorizingManagerId'] },
        );
      }
      hasValidOverride = true;
    }
    const canOverrideDiscounts = hasManagerRole || hasValidOverride;

    let cartDiscount: Decimal;
    let serverPromotions: unknown;
    if (input.appliedPromotions !== undefined || input.promoCode !== undefined) {
      const cartLines = lineData.map((line) => {
        const manualDiscount = line.discountPercent.greaterThan(0)
          ? line.lineTotalBeforeDiscount
              .mul(line.discountPercent)
              .div(100)
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          : new Decimal(0);
        return {
          variantId: line.variantId,
          quantity: line.quantity,
          unitPrice: line.unitPrice.toString(),
          ...(manualDiscount.greaterThan(0)
            ? { manualDiscountAmount: manualDiscount.toString() }
            : {}),
        };
      });
      const evaluation = await evaluatePromotions(
        tenantId,
        cartLines,
        input.customerId,
        input.promoCode,
      );
      const reconciled = reconcileSaleDiscount({
        subtotal,
        submittedDiscount: input.cartDiscountAmount,
        clientPromoTotal: sumClientPromotionDiscount(input.appliedPromotions),
        serverPromoTotal: evaluation.totalDiscountAmount,
        ...(input.manualCartDiscountAmount !== undefined
          ? { manualDiscount: input.manualCartDiscountAmount }
          : {}),
      });
      cartDiscount = reconciled.cartDiscount;
      serverPromotions = clampPromotionDiscounts(
        evaluation.appliedDiscounts,
        reconciled.appliedPromotionTotal,
      );

      assertDiscountsAuthorized({
        canOverride: canOverrideDiscounts,
        lineDiscountPercents: lineData.map((line) => line.discountPercent.toNumber()),
        cartDiscountPercent: cartDiscountPercent(reconciled.manualDiscount, subtotal),
      });
    } else {
      cartDiscount = new Decimal(input.cartDiscountAmount).toDecimalPlaces(
        2,
        Decimal.ROUND_HALF_UP,
      );
      assertDiscountsAuthorized({
        canOverride: canOverrideDiscounts,
        lineDiscountPercents: lineData.map((line) => line.discountPercent.toNumber()),
        cartDiscountPercent: cartDiscountPercent(cartDiscount, subtotal),
      });
    }

    if (cartDiscount.greaterThan(subtotal)) {
      throw new Error('Cart discount cannot exceed subtotal');
    }

    // Allocate the cart-level discount across the lines so each line is taxed
    // on the amount actually charged for it. Previously each line was taxed at
    // full price and the cart discount was applied only after tax, so a fully
    // discounted VAT sale still owed tax — which made a cart the cashier sees
    // as Rs. 0.00 impossible to complete as a zero-value sale (ISSUE 7).
    const discountShares = allocateCartDiscountShares(
      lineData.map((line) => line.lineTotalAfterDiscount),
      cartDiscount,
    );
    lineData.forEach((line, index) => {
      const taxableLine = Decimal.max(line.lineTotalAfterDiscount.minus(discountShares[index]!), 0);
      const taxRate = resolveTaxRate(line.taxRule, { vatRate, ssclRate });
      line.lineTax = taxableLine.mul(taxRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    });

    const totalTax = lineData
      .reduce((sum, l) => sum.plus(l.lineTax), new Decimal(0))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // Delivery charge is part of what the customer pays (it is folded into
    // totalAmount so payment legs, change and shift reconciliation stay
    // consistent). Absent → 0, so the POS terminal's totals are unchanged.
    const deliveryCharge = new Decimal(input.deliveryCharge ?? 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
    if (deliveryCharge.isNegative()) {
      throw new ApiError(400, 'INVALID_DELIVERY_CHARGE', 'Delivery charge cannot be negative', {
        path: ['deliveryCharge'],
      });
    }

    const totalAmount = Decimal.max(
      subtotal
        .minus(cartDiscount)
        .plus(totalTax)
        .plus(deliveryCharge),
      0,
    ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // ── Store credit (ARGUS #61) ─────────────────────────────────────────
    // Credit is a tender, not a display-only deduction: it settles part (or
    // all) of the sale and moves no cash. Payment legs carry it so
    // `sum(payments) === totalAmount` and the shift drawer reconciles against
    // what was actually collected instead of the full sale value.
    const creditAmount = new Decimal(input.appliedStoreCredit ?? '0').toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
    if (creditAmount.isNegative()) {
      throw new ApiError(400, 'INVALID_STORE_CREDIT', 'Store credit cannot be negative', {
        path: ['appliedStoreCredit'],
      });
    }
    if (creditAmount.greaterThan(0)) {
      if (!input.customerId) {
        throw new ApiError(
          400,
          'STORE_CREDIT_REQUIRES_CUSTOMER',
          'Store credit cannot be applied to a guest sale - link a customer first',
          { path: ['appliedStoreCredit'] },
        );
      }
      if (creditAmount.greaterThan(totalAmount)) {
        throw new ApiError(
          400,
          'STORE_CREDIT_EXCEEDS_TOTAL',
          'Store credit cannot exceed the sale total',
          { path: ['appliedStoreCredit'] },
        );
      }
      if (linkedCreditBalance && creditAmount.greaterThan(linkedCreditBalance)) {
        throw new ApiError(
          400,
          'STORE_CREDIT_EXCEEDS_BALANCE',
          'Store credit cannot exceed the customer\u2019s available balance',
          { path: ['appliedStoreCredit'] },
        );
      }
    }
    // What the cashier still has to collect after store credit and the linked
    // exchange credit. The exchange applies up to what is still owed; any
    // remainder is issued as store credit to the customer (never silently
    // dropped).
    const afterStoreCredit = totalAmount
      .minus(creditAmount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const requestedExchangeCredit = linkedReturn?.refundAmount ?? new Decimal(0);
    const exchangeCreditAmount = Decimal.min(
      requestedExchangeCredit,
      Decimal.max(afterStoreCredit, 0),
    ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const exchangeCreditRemainder = requestedExchangeCredit
      .minus(exchangeCreditAmount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (exchangeCreditRemainder.greaterThan(0) && !input.customerId) {
      throw new ApiError(
        400,
        'EXCHANGE_CREDIT_REMAINDER_REQUIRES_CUSTOMER',
        'The exchange credit exceeds this sale - link a customer to receive the remainder as store credit',
      );
    }
    const payableAmount = afterStoreCredit
      .minus(exchangeCreditAmount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (input.paymentMethod === 'STORE_CREDIT' && payableAmount.greaterThan(0)) {
      throw new ApiError(
        400,
        'STORE_CREDIT_DOES_NOT_COVER_TOTAL',
        'Store credit does not cover the whole sale - choose a tender for the remaining amount',
        { path: ['paymentMethod'] },
      );
    }
    if (input.paymentMethod === 'EXCHANGE_CREDIT' && payableAmount.greaterThan(0)) {
      throw new ApiError(
        400,
        'EXCHANGE_CREDIT_DOES_NOT_COVER_TOTAL',
        'Exchange credit does not cover the whole sale - choose a tender for the remaining amount',
        { path: ['paymentMethod'] },
      );
    }

    // ── Zero-value verification (doc 33 / 34) ───────────────────────────
    // A zero (or negative) total is only permitted with a recorded reason; a
    // non-zero total must never carry a zero-value reason. PRODUCT_REPLACEMENT
    // must resolve to an existing, non-voided historical order in this tenant.
    const isZeroValue = totalAmount.lte(0);

    // M14-01 (BUG-44) defense-in-depth: the validator rejects NONE without a
    // reason, but only the service can see the COMPUTED total. A NONE tender
    // on a non-zero sale would complete with no Payment leg at all, bypassing
    // tender reconciliation — block it for every caller, API or internal.
    if (input.paymentMethod === 'NONE' && !isZeroValue) {
      throw new ApiError(
        422,
        'NONE_PAYMENT_REQUIRES_ZERO_VALUE',
        'A non-zero sale requires CASH/CARD/SPLIT/LANKAQR or store credit - NONE is reserved for zero-value sales',
      );
    }
    if (isZeroValue && !input.zeroValueReason) {
      throw new Error('A zero-value sale requires a zeroValueReason');
    }
    if (!isZeroValue && input.zeroValueReason) {
      throw new Error('A zeroValueReason is only valid when the sale total is zero');
    }

    let resolvedLinkedOrderRef: string | null = null;
    if (input.zeroValueReason === 'PRODUCT_REPLACEMENT') {
      const ref = input.zeroValueLinkedOrderRef?.trim();
      if (!ref) {
        throw new Error('An original order reference is required for PRODUCT_REPLACEMENT sales');
      }
      const originalSale = await tx.sale.findFirst({
        where: { id: ref, tenantId, status: { not: 'VOIDED' } },
        select: { id: true },
      });
      if (!originalSale) {
        throw new Error(`Original order ${ref} not found - replacement cannot be linked`);
      }
      resolvedLinkedOrderRef = ref;
    }

    // M14-04 (req 3.11 / D14): a replacement must also carry the scanned
    // barcode of the defective item, validated against this tenant's variant
    // barcodes (same lookup the /variants/barcode/[barcode] route uses via
    // product.service.getVariantByBarcode — replicated here on the tx client
    // so the check is transactional). Miss → typed 400 naming the field.
    let resolvedDefectiveBarcode: string | null = null;
    if (input.defectiveBarcode) {
      const barcode = input.defectiveBarcode.trim();
      if (barcode) {
        const defective = await tx.productVariant.findFirst({
          where: { tenantId, barcode, deletedAt: null },
          select: { id: true },
        });
        if (!defective) {
          throw new ApiError(
            400,
            'DEFECTIVE_BARCODE_NOT_FOUND',
            `defectiveBarcode "${barcode}" does not match any product barcode in this store`,
            { path: ['defectiveBarcode'] },
          );
        }
        resolvedDefectiveBarcode = barcode;
      }
    }

    // Zero-value sales settle with no payment leg. A sale fully settled by
    // store credit is NOT a zero-value sale: it has a real total and a credit
    // tender, and must never require a zero-value reason.
    const effectivePaymentMethod: PaymentMethod = isZeroValue
      ? 'NONE'
      : payableAmount.lte(0) && exchangeCreditAmount.greaterThan(0)
        ? 'EXCHANGE_CREDIT'
        : payableAmount.lte(0) && creditAmount.greaterThan(0)
          ? 'STORE_CREDIT'
          : input.paymentMethod;

    // ── Completed-shape invariant (ARGUS #76) ────────────────────────────
    // Build the tender legs before writing the row so a COMPLETED sale can
    // never be persisted with a total but no line item or no payment. This is
    // the same guard the validator applies, repeated at the only service that
    // creates completed sales (internal callers bypass the HTTP validator).
    if (input.paymentMethod === 'SPLIT' && payableAmount.greaterThan(0)) {
      const digitalAmt = new Decimal(input.cardAmount ?? 0);
      if (digitalAmt.greaterThan(payableAmount)) {
        throw new ApiError(
          400,
          'CARD_AMOUNT_EXCEEDS_PAYABLE',
          'The card portion cannot exceed the amount still payable after store credit',
          { path: ['cardAmount'] },
        );
      }
    }
    const tenderLegs = buildSaleTenderLegs({
      paymentMethod: input.paymentMethod,
      payableAmount,
      creditAmount,
      exchangeCreditAmount,
      ...(input.cardAmount !== undefined ? { cardAmount: new Decimal(input.cardAmount) } : {}),
      ...(input.splitLegMethod !== undefined ? { splitLegMethod: input.splitLegMethod } : {}),
    });
    assertCompletedSaleShape({
      status: 'COMPLETED',
      lineCount: lineData.length,
      paymentCount: tenderLegs.length,
      totalAmount,
    });

    // Create Sale
    const sale = await tx.sale.create({
      data: {
        tenant: { connect: { id: tenantId } },
        cashier: { connect: { id: input.cashierId } },
        ...(input.shiftId ? { shift: { connect: { id: input.shiftId } } } : {}),
        ...(input.customerId ? { customer: { connect: { id: input.customerId } } } : {}),
        ...(input.authorizingManagerId
          ? { authorizingManager: { connect: { id: input.authorizingManagerId } } }
          : {}),
        ...(serverPromotions !== undefined && {
          appliedPromotions: serverPromotions as Prisma.InputJsonValue,
        }),
        ...(linkedReturn ? { linkedReturn: { connect: { id: linkedReturn.id } } } : {}),
        subtotal: subtotal.toNumber(),
        discountAmount: cartDiscount.toNumber(),
        taxAmount: totalTax.toNumber(),
        totalAmount: totalAmount.toNumber(),
        deliveryCharge: deliveryCharge.toNumber(),
        // Guest sales are stored exactly like shiftless management sales:
        // customerId stays NULL. `isGuestSale` only relaxes the validator.
        // Backdated entries carry the operator's date; everything else stamps
        // "now" exactly as createdAt would, so the Date column is always real.
        saleDate: input.saleDate ?? new Date(),
        paymentMethod: effectivePaymentMethod,
        zeroValueReason: input.zeroValueReason ?? null,
        zeroValueLinkedOrderRef: resolvedLinkedOrderRef,
        defectiveBarcode: resolvedDefectiveBarcode,
        status: 'COMPLETED',
        completedAt: new Date(),
        lines: {
          create: lineData.map((l) => ({
            variantId: l.variantId,
            productNameSnapshot: l.productNameSnapshot,
            variantDescriptionSnapshot: l.variantDescriptionSnapshot,
            sku: l.sku,
            unitPrice: l.unitPrice.toNumber(),
            costPriceSnapshot: l.costPriceSnapshot.toNumber(),
            quantity: l.quantity,
            discountPercent: l.discountPercent.toNumber(),
            discountAmount: l.discountAmount.toNumber(),
            lineTotalBeforeDiscount: l.lineTotalBeforeDiscount.toNumber(),
            lineTotalAfterDiscount: l.lineTotalAfterDiscount.toNumber(),
            lineTax: l.lineTax.toNumber(),
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

    // Create Payment records. The credit leg settles whatever the customer's
    // balance covers; the chosen tender settles only the remaining payable.
    for (const leg of tenderLegs) {
      await createPayment(
        {
          saleId: sale.id,
          method: leg.method,
          amount: leg.amount,
          ...(input.cardReferenceNumber !== undefined &&
            leg.method !== 'CASH' &&
            leg.method !== 'STORE_CREDIT' && { cardReferenceNumber: input.cardReferenceNumber }),
        },
        tx,
      );
    }

    // ── Cash tender (ARGUS #62) ─────────────────────────────────────────
    // Short cash must never be persisted as a fully-paid sale. The server, not
    // the terminal, owns the cash portion: for CASH it is the whole payable
    // amount, for SPLIT only the remainder after the card/QR leg. Payable is
    // already net of discounts, store credit and exchange credit. Overpayment
    // is recorded as change; an exact tender stores no change. A missing or
    // malformed `cashReceived` counts as zero tendered rather than crashing.
    // See docs/pos-cash-tender.md.
    const cashTender = resolveCashTender({
      paymentMethod: input.paymentMethod,
      payableAmount,
      cardAmount: input.cardAmount,
      cashReceived: input.cashReceived,
    });
    if (cashTender.status === 'SHORT') {
      throw new ApiError(
        400,
        'INSUFFICIENT_CASH',
        `Cash received (${cashTender.cashReceived.toFixed(2)}) is less than the cash due (${cashTender.cashDue.toFixed(2)}) after discounts and credit`,
        { path: ['cashReceived'] },
      );
    }
    if (cashTender.status === 'SETTLED' && cashTender.changeGiven.greaterThan(0)) {
      await tx.sale.update({
        where: { id: sale.id },
        data: { changeGiven: cashTender.changeGiven.toNumber() },
      });
    }

    // Customer credit redemption and spend tracking. Guest sales never reach
    // this block: with no customerId there is no ledger to touch, so a walk-in
    // bill accrues no loyalty spend and consumes no store credit.
    if (input.customerId) {
      if (creditAmount.greaterThan(0)) {
        await redeemCredit(tenantId, input.customerId, creditAmount, tx);
      }
      if (exchangeCreditRemainder.greaterThan(0) && linkedReturn) {
        // The replacement is cheaper than the returned goods; the difference
        // stays with the customer as store credit rather than disappearing.
        await issueCredit(
          tenantId,
          input.customerId,
          exchangeCreditRemainder,
          `Exchange remainder for return ${linkedReturn.id}`,
          tx,
        );
      }
      await addToSpendTotal(tenantId, input.customerId, totalAmount, tx);
    }

    // Route the collected money into payment accounts. Only the payable part
    // was collected; the credit leg reduces the customer's balance instead of
    // landing in a cash/bank account. Inside the transaction so the sale and
    // the money commit together; a tenant with no accounts yet simply writes
    // nothing and the sale still completes.
    await postSaleToAccounts(
      tx,
      tenantId,
      input.cashierId,
      sale.id,
      sale.id.slice(0, 8).toUpperCase(),
      buildSaleAccountLegs({
        paymentMethod: effectivePaymentMethod,
        totalAmount: payableAmount,
        ...(input.cardAmount !== undefined && { cardAmount: input.cardAmount }),
        ...(input.splitLegMethod !== undefined && { splitLegMethod: input.splitLegMethod }),
      }),
      input.paymentAccountId !== undefined ? { CASH: input.paymentAccountId } : {},
    );

    const completeSale = await tx.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: { lines: true, payments: true },
    });
    return completeSale;
  }, { maxWait: 10_000, timeout: 30_000 });

  const zeroValue = new Decimal(result.totalAmount.toString()).lte(0);
  void createAuditLog({
    tenantId,
    actorId: input.cashierId,
    actorRole: 'CASHIER',
    entityType: 'Sale',
    entityId: result.id,
    action: zeroValue ? AUDIT_ACTIONS.SALE_ZERO_VALUE_COMPLETED : AUDIT_ACTIONS.SALE_COMPLETED,
    after: {
      totalAmount: result.totalAmount,
      paymentMethod: result.paymentMethod,
      linkedReturnId: result.linkedReturnId,
      lineCount: result.lines.length,
      deliveryCharge: result.deliveryCharge,
      customerId: result.customerId ?? null,
      saleDate: result.saleDate?.toISOString() ?? null,
      ...(zeroValue && {
        zeroValueReason: result.zeroValueReason,
        zeroValueLinkedOrderRef: result.zeroValueLinkedOrderRef,
      }),
    },
  }).catch(() => {});

  void dispatchWebhooks(tenantId, 'sale.completed', {
    saleId: result.id,
    totalAmount: result.totalAmount.toString(),
    itemCount: result.lines.length,
    customerId: result.customerId ?? null,
  });

  // Kick cash drawer for cash payments (fire-and-forget)
  if (input.paymentMethod === 'CASH' || input.paymentMethod === 'SPLIT') {
    void prisma.tenant
      .findUnique({ where: { id: tenantId }, select: { settings: true } })
      .then((tenant) => {
        if (!tenant) return;
        const settings = tenant.settings as {
          hardware?: {
            printer?: {
              type?: PrinterConfig['type'];
              host?: string;
              port?: number;
              paperWidth?: PrinterConfig['paperWidth'];
            };
          };
        } | null;
        const hw = settings?.hardware?.printer;
        if (!hw?.host) return;
        const printerConfig: PrinterConfig = {
          type: hw.type ?? 'NETWORK',
          host: hw.host,
          ...(hw.port !== undefined ? { port: hw.port } : {}),
          paperWidth: hw.paperWidth ?? '58mm',
        };
        void kickCashDrawer(printerConfig);
      })
      .catch(() => {});
  }

  return result;
}

// ── Validate Replacement Reference (doc 34) ─────────────────────────────────
// Resolves an original order reference against historical, non-voided sales in
// the tenant. Used by the POS UI to validate Product Replacement linkage before
// enabling confirmation.
export async function validateReplacementRef(
  tenantId: string,
  ref: string,
): Promise<{
  valid: boolean;
  message?: string;
  originalOrder?: { id: string; totalAmount: string; createdAt: Date };
}> {
  const trimmed = ref.trim();
  if (!trimmed) {
    return { valid: false, message: 'Enter an original order reference' };
  }
  const original = await prisma.sale.findFirst({
    where: { id: trimmed, tenantId, status: { not: 'VOIDED' } },
    select: { id: true, totalAmount: true, createdAt: true },
  });
  if (!original) {
    return { valid: false, message: `Original order ${trimmed} not found` };
  }
  return {
    valid: true,
    originalOrder: {
      id: original.id,
      totalAmount: original.totalAmount.toString(),
      createdAt: original.createdAt,
    },
  };
}

// ── Get Sale By ID ───────────────────────────────────────────────────────────

export async function getSaleById(tenantId: string, saleId: string) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, tenantId },
    include: {
      lines: {
        include: {
          variant: { include: { product: true } },
          returnLines: { where: { return: { status: 'COMPLETED' } }, select: { quantity: true } },
        },
      },
      cashier: { select: { id: true, email: true } },
      // Guest sales have customerId = null; the detail page renders a
      // "Walk-in / Guest" label rather than a blank.
      customer: { select: { id: true, name: true, phone: true } },
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
    lines: sale.lines.map((line) => ({
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
  /** Exact tender (CASH, CARD, ...). Server-side so totals/pages stay correct. */
  paymentMethod?: PaymentMethod | undefined;
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
  if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod;
  if (filters.from || filters.to) {
    // Backdated sales must be findable under their accounting date, so the
    // range matches `saleDate` when it is set and falls back to `createdAt`
    // for rows recorded before that column existed.
    const range: Record<string, Date> = {};
    if (filters.from) range.gte = filters.from;
    if (filters.to) range.lte = filters.to;
    where.OR = [{ saleDate: range }, { saleDate: null, createdAt: range }];
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        lines: { include: { returnLines: { where: { return: { status: 'COMPLETED' } }, select: { quantity: true } } } },
        // TASK B: the management table shows the customer name, so the list
        // response carries the minimum identity fields (never the full record).
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.sale.count({ where }),
  ]);

  const enrichedSales = sales.map((sale) => ({
    ...sale,
    lines: sale.lines.map((line) => ({
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

    const totalAmount = subtotal.minus(cartDiscount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

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

export async function updateHeldSale(
  tenantId: string,
  saleId: string,
  input: HoldSaleInput & { cashierId: string },
) {
  return prisma.$transaction(async (tx: TxClient) => {
    const existing = await tx.sale.findFirst({
      where: { id: saleId, tenantId, status: 'OPEN' },
    });
    if (!existing) throw new Error('Held sale not found or already completed');

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

    const totalAmount = subtotal.minus(cartDiscount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // Replace lines atomically
    await tx.saleLine.deleteMany({ where: { saleId: existing.id } });

    const sale = await tx.sale.update({
      where: { id: existing.id },
      data: {
        subtotal: subtotal.toNumber(),
        discountAmount: cartDiscount.toNumber(),
        taxAmount: 0,
        totalAmount: totalAmount.toNumber(),
        updatedAt: new Date(),
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

export async function deleteHeldSale(tenantId: string, saleId: string) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, tenantId, status: 'OPEN' },
  });

  if (!sale) {
    throw new Error('Held sale not found');
  }

  await prisma.$transaction([
    prisma.saleLine.deleteMany({ where: { saleId } }),
    prisma.sale.delete({ where: { id: saleId } }),
  ]);
}

export async function voidSale(tenantId: string, saleId: string, actorId: string) {
  const result = await prisma.$transaction(async (tx: TxClient) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, tenantId },
      include: { lines: true },
    });

    if (!sale) {
      throw new Error('Sale not found');
    }
    // A return already restocked/refunded part of this sale; voiding would
    // double-restock and over-reverse the ledger (ARGUS #94).
    const completedReturnCount = await tx.return.count({
      where: { originalSaleId: saleId, tenantId, status: 'COMPLETED' },
    });
    assertSaleVoidable({ status: sale.status, completedReturnCount });

    // Shift-bound sales can only be voided while their shift is open.
    // Management sales have no shift and can be voided by an authorized actor.
    if (sale.shiftId) {
      const shift = await tx.shift.findFirst({
        where: { id: sale.shiftId, tenantId, status: 'OPEN' },
      });
      if (!shift) {
        throw new Error('Shift is not open');
      }
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
      if (!line.variantId) continue;
      await adjustStockInTx(tx, tenantId, line.variantId, actorId, {
        quantityDelta: line.quantity,
        reason: 'VOID_REVERSAL',
        saleId: sale.id,
      });
    }

    // Put the money back where it came from. Mirrors the entries written by
    // `postSaleToAccounts` at collection time.
    await reverseSaleAccounts(tx, tenantId, actorId, sale.id, sale.id.slice(0, 8).toUpperCase());

    // Store/exchange credit redeemed on this sale must return to the customer.
    // The tender legs are the source of truth; voiding previously reversed only
    // the payment account legs, so the redeemed balance vanished.
    const creditLegs = await tx.payment.findMany({
      where: {
        saleId: sale.id,
        method: { in: ['STORE_CREDIT', 'EXCHANGE_CREDIT'] },
      },
      select: { method: true, amount: true },
    });
    const redeemedCredit = sumRedeemedCreditLegs(
      creditLegs.map((leg) => ({ method: leg.method, amount: new Decimal(leg.amount.toString()) })),
    );
    if (sale.customerId && redeemedCredit.total.greaterThan(0)) {
      await issueCredit(
        tenantId,
        sale.customerId,
        redeemedCredit.total,
        `Void of sale ${sale.id.slice(0, 8).toUpperCase()} - restored store/exchange credit`,
        tx,
      );
    }

    // Voided sales must stop counting toward the customer's lifetime spend and
    // visit/loyalty metrics (ARGUS #308).
    if (sale.customerId) {
      await reverseSpendOnVoid(
        tenantId,
        sale.customerId,
        new Decimal(sale.totalAmount.toString()),
        sale.id,
        tx,
      );
    }

    // Commission on a voided sale is fully clawed back as a negative
    // outstanding record (ARGUS #361); a paid original row is left untouched.
    await reconcileCommissionForSale({
      tenantId,
      saleId,
      voided: true,
      actorId,
      tx,
    });

    return updatedSale;
  });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: 'USER',
    entityType: 'Sale',
    entityId: saleId,
    action: AUDIT_ACTIONS.SALE_VOIDED,
    before: { status: 'COMPLETED' },
    after: { status: 'VOIDED', voidedById: actorId },
  }).catch(() => {});

  // ARGUS #52: the "Sale Completed" alert must not keep advertising a voided
  // sale. Best-effort — a notification failure never fails the void.
  void notifySaleVoided(tenantId, {
    id: result.id,
    totalAmount: result.totalAmount.toString(),
  }).catch((notifError) => {
    console.warn('Sale void notification update failed:', notifError);
  });

  return result;
}

// ── Update Sale (amend mutable details) ──────────────────────────────────────

/**
 * Amend the financially-inert details of a COMPLETED sale.
 *
 * Deliberately narrow: the customer link, the accounting date and the delivery
 * charge may change; line items, unit prices, discounts and tender METHODS may
 * NOT (those are financially immutable and must go through a return or a void,
 * which restores stock and leaves its own audit trail).
 *
 * The delivery charge is a component of `totalAmount`, so changing it re-bases
 * the total and the existing payment legs are re-scaled to match — the
 * `sum(payments) === totalAmount` invariant is preserved rather than edited by
 * hand. The operator never types a payment amount; the legs follow the total.
 */
export async function updateSale(
  tenantId: string,
  saleId: string,
  actorId: string,
  input: UpdateSaleInput,
) {
  const before = await prisma.sale.findFirst({
    where: { id: saleId, tenantId },
    include: { payments: { orderBy: { createdAt: 'asc' } } },
  });

  if (!before) {
    // Typed 404 so the route maps it without a message-substring comparison.
    throw new ApiError(404, 'NOT_FOUND', 'Sale not found');
  }
  if (before.status !== 'COMPLETED') {
    throw new ApiError(
      400,
      'SALE_NOT_EDITABLE',
      'Only completed sales can be edited - held and voided sales cannot be amended',
    );
  }

  if (input.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, tenantId, deletedAt: null },
      select: { id: true, name: true, phone: true },
    });
    if (!customer) {
      throw new ApiError(400, 'CUSTOMER_NOT_FOUND', 'Linked customer not found');
    }
    if (!customer.name || !customer.phone) {
      throw new ApiError(400, 'INVALID_CUSTOMER_LINK', 'Linked customer must have a name and a mobile number');
    }
  }

  const previousTotal = new Decimal(before.totalAmount.toString());
  const previousDelivery = new Decimal(before.deliveryCharge.toString());

  const data: {
    customerId?: string | null;
    saleDate?: Date | null;
    deliveryCharge?: number;
    totalAmount?: number;
    changeGiven?: number | null;
  } = {};

  if (input.customerId !== undefined) data.customerId = input.customerId ?? null;
  if (input.saleDate !== undefined) data.saleDate = input.saleDate ?? null;

  let nextTotal = previousTotal;
  if (input.deliveryCharge !== undefined) {
    const nextDelivery = new Decimal(input.deliveryCharge).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
    const delta = nextDelivery.minus(previousDelivery);
    nextTotal = previousTotal.plus(delta).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    // A delivery charge cannot turn a paid sale negative (e.g. removing a
    // charge larger than the goods total).
    if (nextTotal.isNegative()) {
      throw new ApiError(
        400,
        'INVALID_DELIVERY_CHARGE',
        'Delivery charge cannot reduce the sale total below zero',
      );
    }
    // The tender legs are derived, not typed, so re-basing the total requires
    // them to currently reconcile. A sale whose payments already disagree with
    // its total is a data-integrity case for a void, never for an edit.
    if (!delta.isZero() && before.payments.length > 0) {
      const settled = before.payments.reduce(
        (sum, p) => sum.plus(new Decimal(p.amount.toString())),
        new Decimal(0),
      );
      if (!settled.equals(previousTotal)) {
        throw new ApiError(
          400,
          'SALE_PAYMENTS_OUT_OF_BALANCE',
          'This sale\u2019s payments no longer reconcile with its total - void it instead of editing the delivery charge',
        );
      }
    }
    data.deliveryCharge = nextDelivery.toNumber();
    if (!delta.isZero()) {
      data.totalAmount = nextTotal.toNumber();
      // Change handed back is derived from the settled cash portion, so it has
      // to move with the total or the drawer reconciliation drifts.
      if (before.changeGiven !== null && before.changeGiven !== undefined) {
        const newChange = new Decimal(before.changeGiven.toString()).minus(delta);
        data.changeGiven = newChange.isNegative() ? null : newChange.toNumber();
      }
    }
  }

  // A completed sale always carries settled tenders. Removing a delivery
  // charge must never re-base the total to (or below) zero — that would leave
  // zero-amount payment legs, which is a refund/void scenario, not an edit.
  if (!nextTotal.equals(previousTotal) && before.payments.length > 0 && nextTotal.lte(0)) {
    throw new ApiError(
      400,
      'INVALID_DELIVERY_CHARGE',
      'This delivery charge would reduce the settled total to zero - void the sale instead',
    );
  }

  const updated = await prisma.$transaction(async (tx: TxClient) => {
    // Re-scale existing tender legs so they still sum to the new total. The
    // split shape (how many legs, which methods, which card references) is
    // preserved; only the amounts follow the total.
    //
    // A STORE_CREDIT leg is a fixed redemption — its amount is pinned to the
    // customer's balance and cannot move with a delivery charge — so only the
    // cash/card/QR legs absorb the delta.
    if (
      !nextTotal.equals(previousTotal) &&
      before.payments.length > 0 &&
      previousTotal.greaterThan(0)
    ) {
      const creditTotal = before.payments
        .filter((p) => p.method === 'STORE_CREDIT')
        .reduce((sum, p) => sum.plus(new Decimal(p.amount.toString())), new Decimal(0));
      const moneyLegs = before.payments.filter((p) => p.method !== 'STORE_CREDIT');
      const previousMoney = previousTotal.minus(creditTotal);
      const targetMoney = nextTotal.minus(creditTotal);

      if (targetMoney.isNegative()) {
        throw new ApiError(
          400,
          'INVALID_DELIVERY_CHARGE',
          'This delivery charge would reduce the total below the store credit already redeemed - void the sale instead',
        );
      }
      if (moneyLegs.length === 0 && targetMoney.greaterThan(0)) {
        throw new ApiError(
          400,
          'INVALID_DELIVERY_CHARGE',
          'This delivery charge cannot be collected on a store-credit-only sale - void the sale instead',
        );
      }

      let allocated = new Decimal(0);
      for (let i = 0; i < moneyLegs.length; i += 1) {
        const leg = moneyLegs[i]!;
        const isLast = i === moneyLegs.length - 1;
        const amount = isLast
          ? targetMoney.minus(allocated)
          : new Decimal(leg.amount.toString())
              .mul(targetMoney)
              .div(previousMoney)
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        if (amount.isNegative()) {
          throw new ApiError(
            400,
            'INVALID_DELIVERY_CHARGE',
            'This delivery charge cannot be applied to the existing payment split',
          );
        }
        allocated = allocated.plus(amount);
        await tx.payment.update({
          where: { id: leg.id },
          data: { amount: amount.toFixed(2) },
        });
      }
    }

    return tx.sale.update({
      where: { id: saleId },
      data,
      include: {
        lines: { include: { returnLines: { where: { return: { status: 'COMPLETED' } }, select: { quantity: true } } } },
        customer: { select: { id: true, name: true, phone: true } },
      },
    });
  });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: 'USER',
    entityType: 'Sale',
    entityId: saleId,
    action: AUDIT_ACTIONS.SALE_DETAILS_UPDATED,
    before: {
      customerId: before.customerId,
      saleDate: before.saleDate?.toISOString() ?? null,
      deliveryCharge: before.deliveryCharge.toString(),
      totalAmount: before.totalAmount.toString(),
    },
    after: {
      customerId: updated.customerId,
      saleDate: updated.saleDate?.toISOString() ?? null,
      deliveryCharge: updated.deliveryCharge.toString(),
      totalAmount: updated.totalAmount.toString(),
    },
  }).catch(() => {});

  return {
    ...updated,
    lines: updated.lines.map((line) => ({
      ...line,
      returnedQuantity: line.returnLines.reduce((sum, rl) => sum + rl.quantity, 0),
    })),
  };
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
