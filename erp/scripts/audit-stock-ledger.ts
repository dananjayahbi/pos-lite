/* eslint-disable no-console -- read-only audit CLI: stdout IS the report */
/**
 * Stock ledger audit (ARGUS #198) — READ ONLY.
 *
 * Every movement records the quantity before and after its own change, so a
 * variant's history should be one unbroken chain ending at the current stock:
 *
 *     movement[i].quantityBefore === movement[i-1].quantityAfter
 *     lastMovement.quantityAfter   === variant.stockQuantity
 *
 * This script walks the ledger per tenant in createdAt/id order and reports:
 *   - chain breaks: a row starting somewhere the previous row did not end;
 *   - arithmetic errors: before + delta !== after;
 *   - current mismatches: variant.stockQuantity !== last row's after;
 *   - a movement-reason coverage summary (sales, returns, stock takes, ...);
 *   - a compact per-variant line and totals.
 *
 * It never writes to the database. Exit code is 0 unless --strict is passed and
 * any chain break / arithmetic error / current mismatch is found.
 *
 *   node --env-file=.env --import tsx scripts/audit-stock-ledger.ts
 *   node --env-file=.env --import tsx scripts/audit-stock-ledger.ts --tenant=<tenantId>
 *   node --env-file=.env --import tsx scripts/audit-stock-ledger.ts --strict
 *   node --env-file=.env --import tsx scripts/audit-stock-ledger.ts --json > ledger-audit.json
 *   node --env-file=.env --import tsx scripts/audit-stock-ledger.ts --all
 *
 * Repair the "current mismatch" class with scripts/repair-stock-ledger.ts.
 * Chain breaks cannot be repaired by appending a row; see docs/stock-ledger-audit.md.
 */
import { prisma } from '@/lib/prisma';
import {
  auditStockLedger,
  hasStockLedgerFindings,
  type LedgerVariantInput,
  type StockLedgerReport,
  type StockLedgerVariantAudit,
} from '@/lib/services/stockLedgerAudit.core';

const argv = process.argv.slice(2);
const tenantId = argv.find((arg) => arg.startsWith('--tenant='))?.slice('--tenant='.length).trim() || undefined;
const jsonOutput = argv.includes('--json');
const strict = argv.includes('--strict');
const showAll = argv.includes('--all');

interface TenantAudit {
  tenantId: string;
  tenantName: string;
  report: StockLedgerReport;
}

function formatGap(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function variantLine(variant: StockLedgerVariantAudit): string {
  const ledger = variant.lastQuantityAfter === null ? 'none' : String(variant.lastQuantityAfter);
  return [
    variant.sku,
    variant.productName ?? '-',
    `qty=${variant.currentQuantity}`,
    `ledger=${ledger}`,
    `gap=${variant.repairDelta === null ? '0' : formatGap(variant.repairDelta)}`,
    `moves=${variant.movementCount}`,
    `breaks=${variant.chainBreaks.length}`,
    `reasons=${variant.reasons.join(',') || '-'}`,
  ].join('  ');
}

function printTenant(audit: TenantAudit): void {
  const { report } = audit;

  console.log('');
  console.log(`Tenant ${audit.tenantName} (${audit.tenantId})`);
  console.log(
    `  variants=${report.totals.variants}  movements=${report.totals.movements}  ` +
      `chainBreaks=${report.totals.chainBreaks} (${report.totals.chainBreakVariants} variants)  ` +
      `currentMismatches=${report.totals.currentMismatches}  ` +
      `arithmeticErrors=${report.totals.arithmeticErrors}  ` +
      `unexplainedOpenings=${report.totals.unexplainedOpenings}`,
  );
  console.log(
    `  repair units: +${report.totals.repairUnitsToAdd} / -${report.totals.repairUnitsToRemove}  ` +
      `(see scripts/repair-stock-ledger.ts)`,
  );

  const reasons = Object.entries(report.reasonCoverage).sort((a, b) => b[1] - a[1]);
  console.log(
    `  reasons: ${reasons.length > 0 ? reasons.map(([reason, count]) => `${reason}=${count}`).join(' ') : 'none'}`,
  );

  const inconsistent = report.variants.filter(
    (variant) =>
      variant.chainBreaks.length > 0 ||
      variant.arithmeticErrors.length > 0 ||
      variant.currentMismatch !== null,
  );
  const listed = showAll ? report.variants : inconsistent;

  if (listed.length === 0) {
    console.log('  every variant chain reconciles to its current stock.');
    return;
  }

  console.log('');
  for (const variant of listed) {
    console.log(`  ${variantLine(variant)}`);
    for (const error of variant.arithmeticErrors.slice(0, 10)) {
      console.log(
        `    ! arithmetic ${error.movementId} ${error.reason} ${error.createdAt}: ` +
          `${error.quantityBefore} + ${error.quantityDelta} != ${error.quantityAfter}`,
      );
    }
    for (const chainBreak of variant.chainBreaks.slice(0, 10)) {
      console.log(
        `    ! chain break ${chainBreak.movementId} ${chainBreak.reason} ${chainBreak.createdAt}: ` +
          `expected before ${chainBreak.expectedBefore}, got ${chainBreak.actualBefore} ` +
          `(${formatGap(chainBreak.gap)})`,
      );
    }
    if (variant.chainBreaks.length > 10) {
      console.log(`    ! … ${variant.chainBreaks.length - 10} more chain break(s)`);
    }
    if (variant.currentMismatch) {
      console.log(
        `    ! current stock ${variant.currentMismatch.currentQuantity} != ledger ` +
          `${variant.currentMismatch.lastQuantityAfter ?? 'no movements'} ` +
          `(repair delta ${formatGap(variant.currentMismatch.gap)})`,
      );
    }
  }
}

async function main(): Promise<void> {
  const tenants = tenantId
    ? await prisma.tenant.findMany({ where: { id: tenantId }, select: { id: true, name: true } })
    : await prisma.tenant.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

  if (tenants.length === 0) {
    console.error(tenantId ? `Tenant not found: ${tenantId}` : 'No active tenants found.');
    process.exitCode = 1;
    return;
  }

  const audits: TenantAudit[] = [];

  for (const tenant of tenants) {
    const variants = await prisma.productVariant.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      select: {
        id: true,
        sku: true,
        stockQuantity: true,
        product: { select: { name: true } },
      },
      orderBy: { sku: 'asc' },
    });

    if (variants.length === 0) {
      audits.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        report: auditStockLedger([]),
      });
      continue;
    }

    const movements = await prisma.stockMovement.findMany({
      where: { tenantId: tenant.id, variantId: { in: variants.map((variant) => variant.id) } },
      select: {
        id: true,
        variantId: true,
        reason: true,
        quantityDelta: true,
        quantityBefore: true,
        quantityAfter: true,
        createdAt: true,
        note: true,
      },
      orderBy: [{ variantId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    const byVariant = new Map<string, typeof movements>();
    for (const movement of movements) {
      const rows = byVariant.get(movement.variantId);
      if (rows) rows.push(movement);
      else byVariant.set(movement.variantId, [movement]);
    }

    const inputs: LedgerVariantInput[] = variants.map((variant) => ({
      variantId: variant.id,
      sku: variant.sku,
      productName: variant.product?.name ?? null,
      currentQuantity: variant.stockQuantity,
      movements: byVariant.get(variant.id) ?? [],
    }));

    audits.push({
      tenantId: tenant.id,
      tenantName: tenant.name,
      report: auditStockLedger(inputs),
    });
  }

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          strict,
          tenants: audits.map((audit) => ({
            tenantId: audit.tenantId,
            tenantName: audit.tenantName,
            totals: audit.report.totals,
            reasonCoverage: audit.report.reasonCoverage,
            variants: audit.report.variants,
          })),
        },
        null,
        2,
      ),
    );
  } else {
    console.log('Stock ledger audit (read-only)');
    for (const audit of audits) printTenant(audit);

    const totals = audits.reduce(
      (sum, audit) => ({
        variants: sum.variants + audit.report.totals.variants,
        movements: sum.movements + audit.report.totals.movements,
        chainBreaks: sum.chainBreaks + audit.report.totals.chainBreaks,
        currentMismatches: sum.currentMismatches + audit.report.totals.currentMismatches,
        arithmeticErrors: sum.arithmeticErrors + audit.report.totals.arithmeticErrors,
      }),
      { variants: 0, movements: 0, chainBreaks: 0, currentMismatches: 0, arithmeticErrors: 0 },
    );

    console.log('');
    console.log(
      `All tenants: variants=${totals.variants} movements=${totals.movements} ` +
        `chainBreaks=${totals.chainBreaks} currentMismatches=${totals.currentMismatches} ` +
        `arithmeticErrors=${totals.arithmeticErrors}`,
    );
    console.log('No rows were written. Repair: scripts/repair-stock-ledger.ts (dry-run by default).');
  }

  if (strict && audits.some((audit) => hasStockLedgerFindings(audit.report))) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('Stock ledger audit failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
