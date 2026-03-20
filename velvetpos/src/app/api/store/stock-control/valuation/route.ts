import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';

interface ValuationRow {
  retail_value: string;
  cost_value: string;
  variant_count: bigint;
}

interface CategoryValuationRow {
  category_id: string;
  category_name: string;
  variant_count: bigint;
  retail_value: string;
  cost_value: string;
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

    const [totals, categoryBreakdown] = await Promise.all([
      prisma.$queryRaw<ValuationRow[]>`
        SELECT
          COALESCE(SUM(pv.stock_quantity * pv.retail_price), 0)::text as retail_value,
          COALESCE(SUM(pv.stock_quantity * pv.cost_price), 0)::text as cost_value,
          COUNT(*)::bigint as variant_count
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE pv.tenant_id = ${tenantId}
          AND pv.deleted_at IS NULL
          AND p.is_archived = false
      `,
      prisma.$queryRaw<CategoryValuationRow[]>`
        SELECT
          c.id as category_id,
          c.name as category_name,
          COUNT(pv.id)::bigint as variant_count,
          COALESCE(SUM(pv.stock_quantity * pv.retail_price), 0)::text as retail_value,
          COALESCE(SUM(pv.stock_quantity * pv.cost_price), 0)::text as cost_value
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE pv.tenant_id = ${tenantId}
          AND pv.deleted_at IS NULL
          AND p.is_archived = false
        GROUP BY c.id, c.name
        ORDER BY c.name
      `,
    ]);

    const retailValue = parseFloat(totals[0]?.retail_value ?? '0');
    const costValue = parseFloat(totals[0]?.cost_value ?? '0');
    const variantCount = Number(totals[0]?.variant_count ?? 0);
    const estimatedMargin = retailValue - costValue;
    const estimatedMarginPercent = retailValue > 0 ? (estimatedMargin / retailValue) * 100 : 0;
    const roundedMarginPercent = Math.round(estimatedMarginPercent * 100) / 100;

    const breakdown = categoryBreakdown.map((c) => ({
      categoryId: c.category_id,
      categoryName: c.category_name,
      variantCount: Number(c.variant_count),
      retailValue: parseFloat(c.retail_value),
      costValue: parseFloat(c.cost_value),
    }));

    const format = request.nextUrl.searchParams.get('format');
    if (format === 'csv') {
      const lines: string[] = [];
      lines.push('Stock Valuation Summary');
      lines.push('Metric,Value');
      lines.push(`Total Retail Value,"${retailValue.toFixed(2)}"`);
      lines.push(`Total Cost Value,"${costValue.toFixed(2)}"`);
      lines.push(`Estimated Margin (Rs.),"${estimatedMargin.toFixed(2)}"`);
      lines.push(`Estimated Margin (%),${roundedMarginPercent}`);
      lines.push('');
      lines.push('Category Breakdown');
      lines.push('Category,Variants in Stock,Retail Value (Rs.),Cost Value (Rs.),Margin %,Share of Total');
      for (const cat of breakdown) {
        const catMargin = cat.retailValue > 0 ? ((cat.retailValue - cat.costValue) / cat.retailValue) * 100 : 0;
        const share = retailValue > 0 ? (cat.retailValue / retailValue) * 100 : 0;
        lines.push(
          `"${cat.categoryName}",${cat.variantCount},"${cat.retailValue.toFixed(2)}","${cat.costValue.toFixed(2)}",${catMargin.toFixed(2)},${share.toFixed(2)}`,
        );
      }

      const csv = lines.join('\n');
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
        retailValue,
        costValue,
        estimatedMargin,
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
