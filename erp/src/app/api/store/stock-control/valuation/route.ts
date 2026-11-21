import { type NextRequest, NextResponse } from 'next/server';
import Decimal from 'decimal.js';
import { Prisma } from '@/generated/prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { csvCell } from '@/lib/export';
import {
  readValuationTaxRates,
  summarizeValuationTax,
  valuationMarginPercent,
  type ValuationTaxLineInput,
} from '@/lib/pricing/valuation-tax.core';
import {
  VALUATION_COST_BASIS,
  VALUATION_COST_BASIS_NOTE,
} from '@/lib/pricing/valuationBasis';
import { STOCK_SCOPE_SQL } from '@/lib/inventory/stockScope';
import { sumValuationBreakdown } from '@/lib/pricing/valuationTotals.core';

interface VariantValuationRow {
  category_id: string;
  category_name: string;
  stock_quantity: number;
  retail_price: string;
  cost_price: string;
  tax_rule: string | null;
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

    if (!hasPermission(session.user, PERMISSIONS.STOCK.viewStockValuation)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'COST_PRICE_RESTRICTED', message: 'You do not have permission to view stock valuation data.' },
        },
        { status: 403 },
      );
    }

    const [variants, tenant, rawMaterialTotals] = await Promise.all([
      prisma.$queryRaw<VariantValuationRow[]>`
        SELECT
          c.id as category_id,
          c.name as category_name,
          pv."stockQuantity"::int as stock_quantity,
          pv."retailPrice"::text as retail_price,
          pv."costPrice"::text as cost_price,
          p."taxRule"::text as tax_rule
        FROM product_variants pv
        JOIN products p ON pv."productId" = p.id
        JOIN categories c ON p."categoryId" = c.id
        WHERE pv."tenantId" = ${tenantId}
          AND ${Prisma.raw(STOCK_SCOPE_SQL)}
        ORDER BY c.name, pv.id
      `,
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      }),
      prisma.$queryRaw<Array<{ raw_material_value: string; material_count: bigint }>>`
        SELECT
          COALESCE(SUM(rm.quantity * rm."unitCost"), 0)::text as raw_material_value,
          COUNT(*)::bigint as material_count
        FROM raw_materials rm
        WHERE rm."tenantId" = ${tenantId}
          AND rm."deletedAt" IS NULL
          AND rm."isActive" = true
      `,
    ]);

    const taxRates = readValuationTaxRates(tenant?.settings);
    const categoryMap = new Map<
      string,
      { categoryId: string; categoryName: string; variantCount: number; lines: ValuationTaxLineInput[]; cost: Decimal }
    >();

    for (const variant of variants) {
      const retail = new Decimal(variant.retail_price).times(variant.stock_quantity);
      const cost = new Decimal(variant.cost_price).times(variant.stock_quantity);
      const line: ValuationTaxLineInput = {
        retailValue: retail,
        taxRule: variant.tax_rule,
      };

      const category = categoryMap.get(variant.category_id) ?? {
        categoryId: variant.category_id,
        categoryName: variant.category_name,
        variantCount: 0,
        lines: [],
        cost: new Decimal(0),
      };
      category.variantCount += 1;
      category.lines.push(line);
      category.cost = category.cost.plus(cost);
      categoryMap.set(variant.category_id, category);
    }

    // ARGUS #220: the table is built first; the KPI totals are its column sums,
    // so a concurrent stock change can never leave the cards disagreeing with
    // the rows and CSV.
    const breakdown = [...categoryMap.values()]
      .map((category) => {
        const categoryTotals = summarizeValuationTax(category.lines, taxRates);
        return {
          categoryId: category.categoryId,
          categoryName: category.categoryName,
          variantCount: category.variantCount,
          retailValue: categoryTotals.retailValueExTax.toNumber(),
          vatAmount: categoryTotals.vatAmount.toNumber(),
          ssclAmount: categoryTotals.ssclAmount.toNumber(),
          taxAmount: categoryTotals.taxAmount.toNumber(),
          retailValueInclTax: categoryTotals.retailValueInclTax.toNumber(),
          costValue: category.cost.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
        };
      })
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));

    const breakdownTotals = sumValuationBreakdown(breakdown);
    const costValue = new Decimal(breakdownTotals.costValue);
    const retailValue = new Decimal(breakdownTotals.retailValue);
    const variantCount = breakdownTotals.variantCount;
    // Raw materials live in their own table; include their value so the report
    // covers the whole inventory (ARGUS #243).
    const rawMaterialValue = parseFloat(rawMaterialTotals[0]?.raw_material_value ?? '0');
    const rawMaterialCount = Number(rawMaterialTotals[0]?.material_count ?? 0);
    const totalCostValue = costValue.plus(rawMaterialValue).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const estimatedMargin = retailValue.minus(costValue).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const roundedMarginPercent = valuationMarginPercent(retailValue, costValue);

    const format = request.nextUrl.searchParams.get('format');
    if (format === 'csv') {
      const linesOut: string[] = [];
      linesOut.push('Stock Valuation Summary');
      linesOut.push('Metric,Value');
      linesOut.push(`Total Retail Value (Excl. Tax),${csvCell(retailValue.toFixed(2))}`);
      linesOut.push(`VAT (${taxRates.vatRate}%),${csvCell(breakdownTotals.vatAmount)}`);
      if (taxRates.ssclRate > 0 || Number(breakdownTotals.ssclAmount) > 0) {
        linesOut.push(`SSCL (${taxRates.ssclRate}%),${csvCell(breakdownTotals.ssclAmount)}`);
      }
      linesOut.push(`Total Retail Value (Incl. Tax),${csvCell(breakdownTotals.retailValueInclTax)}`);
      linesOut.push(`Total Cost Value (At Current Cost),${csvCell(costValue.toFixed(2))}`);
      linesOut.push(`Raw Material Value,${csvCell(rawMaterialValue.toFixed(2))}`);
      linesOut.push(`Total Inventory Cost Value,${csvCell(totalCostValue.toFixed(2))}`);
      // ARGUS #218: the figure is a current-cost snapshot, not acquisition cost.
      linesOut.push(`Cost Basis,${csvCell(VALUATION_COST_BASIS_NOTE)}`);
      linesOut.push(`Estimated Margin (Rs.),${csvCell(estimatedMargin.toFixed(2))}`);
      linesOut.push(`Estimated Margin (%),${csvCell(roundedMarginPercent.toFixed(2))}`);
      linesOut.push('');
      linesOut.push('Category Breakdown');
      linesOut.push(
        'Category,Variants in Stock,Retail Value Excl. Tax (Rs.),Tax (Rs.),Retail Value Incl. Tax (Rs.),Cost Value - At Current Cost (Rs.),Margin %,Share of Total',
      );
      for (const cat of breakdown) {
        const catMargin = valuationMarginPercent(cat.retailValue, cat.costValue);
        const share = retailValue.greaterThan(0)
          ? new Decimal(cat.retailValue).div(retailValue).times(100)
          : new Decimal(0);
        linesOut.push(
          [
            csvCell(cat.categoryName),
            csvCell(cat.variantCount),
            csvCell(cat.retailValue.toFixed(2)),
            csvCell(cat.taxAmount.toFixed(2)),
            csvCell(cat.retailValueInclTax.toFixed(2)),
            csvCell(cat.costValue.toFixed(2)),
            csvCell(catMargin.toFixed(2)),
            csvCell(share.toFixed(2)),
          ].join(','),
        );
      }
      // ARGUS #220: the totals row reconciles the exported table to the summary.
      linesOut.push(
        [
          csvCell('Total'),
          csvCell(breakdownTotals.variantCount),
          csvCell(breakdownTotals.retailValue),
          csvCell(breakdownTotals.taxAmount),
          csvCell(breakdownTotals.retailValueInclTax),
          csvCell(breakdownTotals.costValue),
          csvCell(
            valuationMarginPercent(
              breakdownTotals.retailValue,
              breakdownTotals.costValue,
            ).toFixed(2),
          ),
          csvCell(retailValue.greaterThan(0) ? '100.00' : '0.00'),
        ].join(','),
      );

      const csv = linesOut.join('\n');
      const today = new Date().toISOString().split('T')[0];
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="stock-valuation-${today}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        retailValue: retailValue.toNumber(),
        vatAmount: Number(breakdownTotals.vatAmount),
        ssclAmount: Number(breakdownTotals.ssclAmount),
        taxAmount: Number(breakdownTotals.taxAmount),
        retailValueInclTax: Number(breakdownTotals.retailValueInclTax),
        taxRates,
        costValue: costValue.toNumber(),
        // ARGUS #218: explicit contract for consumers that render the figure.
        costBasis: VALUATION_COST_BASIS,
        costBasisNote: VALUATION_COST_BASIS_NOTE,
        rawMaterialValue,
        rawMaterialCount,
        totalCostValue: totalCostValue.toNumber(),
        estimatedMargin: estimatedMargin.toNumber(),
        estimatedMarginPercent: roundedMarginPercent,
        variantCount,
        categoryBreakdown: breakdown,
        calculatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Stock valuation error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to calculate stock valuation' } },
      { status: 500 },
    );
  }
}
