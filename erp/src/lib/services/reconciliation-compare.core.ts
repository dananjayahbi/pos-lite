/**
 * Delivery-vs-courier statement comparison (pure core).
 *
 * The remittance importer settles the expected-receivables ledger; this module
 * answers a different question the operator asks monthly:
 *
 *   "Does the courier's Invoice Details sheet contain exactly the deliveries our
 *    system recorded in this period, with the same COD and the same charges?"
 *
 * Everything here is pure so it can be unit-tested without Prisma; the
 * server-side loader lives in `reconciliation-compare.service.ts`.
 */

export type DeliveryComparisonStatus =
  | 'MATCHED'
  | 'AMOUNT_MISMATCH'
  | 'FEE_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'MISSING_IN_STATEMENT'
  | 'MISSING_IN_SYSTEM'
  | 'DUPLICATE_IN_STATEMENT'
  | 'MISSING_WAYBILL';

export type DeliveryComparisonSeverity = 'ok' | 'warning' | 'critical';

export interface SystemDeliveryForComparison {
  deliveryId: string;
  waybillId: string | null;
  orderRef: string;
  expectedCod: number;
  deliveredAt: string | null;
  deliveryStatus: string;
  shippingFee: number | null;
  settlementStatus: string;
}

export interface StatementRowForComparison {
  waybill: string | null;
  orderRef: string | null;
  amount: number | null;
  fees: number | null;
  status: string | null;
  date: string | null;
  raw: Record<string, string>;
}

export interface ComparisonSide {
  deliveryId?: string;
  waybill: string | null;
  orderRef: string | null;
  cod: number | null;
  fees: number | null;
  status: string | null;
  date: string | null;
  settlementStatus?: string;
}

export interface ComparisonIssue {
  code: DeliveryComparisonStatus;
  message: string;
}

export interface DeliveryComparisonRow {
  id: string;
  status: DeliveryComparisonStatus;
  severity: DeliveryComparisonSeverity;
  waybill: string | null;
  orderRef: string | null;
  system: ComparisonSide | null;
  statement: ComparisonSide | null;
  codDifference: number | null;
  feeDifference: number | null;
  issues: ComparisonIssue[];
  message: string;
}

export interface DeliveryComparisonSummary {
  systemDeliveries: number;
  statementRows: number;
  matched: number;
  differences: number;
  missingInStatement: number;
  missingInSystem: number;
  duplicates: number;
  amountMismatches: number;
  feeMismatches: number;
  statusMismatches: number;
  systemCodTotal: number;
  statementCodTotal: number;
  variance: number;
  missingInStatementAmount: number;
  missingInSystemAmount: number;
  statementRowsOutsideRange: number;
}

export interface DeliveryComparisonReport {
  filename: string;
  range: { from: string; to: string };
  summary: DeliveryComparisonSummary;
  rows: DeliveryComparisonRow[];
}

const DEFAULT_TOLERANCE = 0.01;

const STATUS_PRIORITY: DeliveryComparisonStatus[] = [
  'MISSING_IN_STATEMENT',
  'MISSING_IN_SYSTEM',
  'MISSING_WAYBILL',
  'DUPLICATE_IN_STATEMENT',
  'AMOUNT_MISMATCH',
  'STATUS_MISMATCH',
  'FEE_MISMATCH',
  'MATCHED',
];

const SEVERITY: Record<DeliveryComparisonStatus, DeliveryComparisonSeverity> = {
  MATCHED: 'ok',
  FEE_MISMATCH: 'warning',
  STATUS_MISMATCH: 'warning',
  AMOUNT_MISMATCH: 'critical',
  MISSING_IN_STATEMENT: 'critical',
  MISSING_IN_SYSTEM: 'critical',
  DUPLICATE_IN_STATEMENT: 'warning',
  MISSING_WAYBILL: 'warning',
};

const DELIVERED_LIKE = new Set([
  'delivered',
  'completed',
  'complete',
  'success',
  'successful',
  'paid',
  'settled',
]);

/** Normalizes a waybill/order reference for comparison. */
export function normalizeComparisonKey(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = String(value).trim().replace(/\s+/g, '').toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

/** Parses "3,425.00", "Rs. 3425", "3425" and numeric cells to a number. */
export function parseMoney(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? round2(value) : null;
  // Drop thousands separators, then take the first numeric run. This survives
  // "Rs. 3,900.00", "-500", Excel's "3425" and stray currency symbols.
  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? round2(parsed) : null;
}

/** Parses the date cell from a courier sheet; supports date-only and datetime. */
export function parseStatementDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(value: number): string {
  return value.toFixed(2);
}

function statusOf(issues: ComparisonIssue[]): DeliveryComparisonStatus {
  for (const status of STATUS_PRIORITY) {
    if (issues.some((issue) => issue.code === status)) return status;
  }
  return 'MATCHED';
}

function compareMatchedPair(
  delivery: SystemDeliveryForComparison,
  statement: StatementRowForComparison,
  tolerance: number,
): { issues: ComparisonIssue[]; codDifference: number | null; feeDifference: number | null } {
  const issues: ComparisonIssue[] = [];
  const expected = delivery.expectedCod;
  const collected = statement.amount;
  const codDifference = collected === null ? null : round2(collected - expected);

  if (collected === null) {
    issues.push({
      code: 'AMOUNT_MISMATCH',
      message: `System recorded COD ${money(expected)} but the statement has no collected amount.`,
    });
  } else if (Math.abs(collected - expected) > tolerance) {
    const direction = collected < expected ? 'short' : 'over';
    issues.push({
      code: 'AMOUNT_MISMATCH',
      message: `Collected ${money(collected)} vs system COD ${money(expected)} — ${direction} by ${money(
        Math.abs(round2(collected - expected)),
      )}.`,
    });
  }

  const feeDifference =
    delivery.shippingFee !== null && statement.fees !== null
      ? round2(statement.fees - delivery.shippingFee)
      : null;
  if (feeDifference !== null && Math.abs(feeDifference) > tolerance) {
    issues.push({
      code: 'FEE_MISMATCH',
      message: `Courier charge ${money(statement.fees as number)} vs system shipping fee ${money(
        delivery.shippingFee as number,
      )} — difference ${money(feeDifference)}.`,
    });
  }

  const sheetStatus = statement.status?.trim().toLowerCase() ?? '';
  if (sheetStatus !== '' && !DELIVERED_LIKE.has(sheetStatus)) {
    issues.push({
      code: 'STATUS_MISMATCH',
      message: `Statement status "${statement.status}" but the system marks this delivery as ${delivery.deliveryStatus}.`,
    });
  }

  return { issues, codDifference, feeDifference };
}

export interface BuildDeliveryComparisonInput {
  deliveries: SystemDeliveryForComparison[];
  statementRows: StatementRowForComparison[];
  /** Inclusive, `YYYY-MM-DD`. */
  from: string;
  /** Inclusive, `YYYY-MM-DD`. */
  to: string;
  tolerance?: number;
  filename?: string;
}

/**
 * Builds the two-way comparison report.
 *
 * - Every system delivery in the range is looked up in the statement.
 * - Every statement row in the range is looked up in the system.
 * - Duplicate waybills, amount/fee/status drift, and missing rows are all
 *   surfaced per waybill so the operator can act on each one.
 */
export function buildDeliveryComparison({
  deliveries,
  statementRows,
  from,
  to,
  tolerance = DEFAULT_TOLERANCE,
  filename = 'statement',
}: BuildDeliveryComparisonInput): DeliveryComparisonReport {
  const rangeStart = new Date(`${from}T00:00:00.000Z`).getTime();
  const rangeEnd = new Date(`${to}T23:59:59.999Z`).getTime();

  const rows: DeliveryComparisonRow[] = [];
  const canonical: StatementRowForComparison[] = [];
  const byWaybill = new Map<string, StatementRowForComparison>();
  const byOrderRef = new Map<string, StatementRowForComparison>();
  let statementRowsOutsideRange = 0;
  let duplicateCount = 0;

  for (const statement of statementRows) {
    const date = parseStatementDate(statement.date);
    if (date !== null) {
      const ms = date.getTime();
      if (ms < rangeStart || ms > rangeEnd) {
        statementRowsOutsideRange++;
        continue;
      }
    }

    const waybillKey = normalizeComparisonKey(statement.waybill);
    const orderRefKey = normalizeComparisonKey(statement.orderRef);
    const key = waybillKey ?? orderRefKey;

    // A waybill is authoritative. Only rows without a waybill fall back to the
    // order reference, otherwise repeated generic values (a courier sheet often
    // reuses codes such as "f"/"c") would look like duplicates.
    const existing = waybillKey
      ? byWaybill.get(waybillKey)
      : orderRefKey
        ? byOrderRef.get(orderRefKey)
        : undefined;

    if (existing) {
      duplicateCount++;
      const issues: ComparisonIssue[] = [
        {
          code: 'DUPLICATE_IN_STATEMENT',
          message: `Waybill appears more than once in the statement${
            statement.amount !== null ? ` (duplicate collected ${money(statement.amount)})` : ''
          }.`,
        },
      ];
      rows.push({
        id: `dup-${key}`,
        status: 'DUPLICATE_IN_STATEMENT',
        severity: SEVERITY.DUPLICATE_IN_STATEMENT,
        waybill: statement.waybill,
        orderRef: statement.orderRef,
        system: null,
        statement: {
          waybill: statement.waybill,
          orderRef: statement.orderRef,
          cod: statement.amount,
          fees: statement.fees,
          status: statement.status,
          date: statement.date,
        },
        codDifference: null,
        feeDifference: null,
        issues,
        message: issues[0]!.message,
      });
      continue;
    }

    if (waybillKey === null && orderRefKey === null) {
      const issue: ComparisonIssue = {
        code: 'MISSING_WAYBILL',
        message: 'Statement row has neither a waybill nor an order reference, so it cannot be matched.',
      };
      rows.push({
        id: `nokey-${rows.length}`,
        status: 'MISSING_WAYBILL',
        severity: SEVERITY.MISSING_WAYBILL,
        waybill: statement.waybill,
        orderRef: statement.orderRef,
        system: null,
        statement: {
          waybill: statement.waybill,
          orderRef: statement.orderRef,
          cod: statement.amount,
          fees: statement.fees,
          status: statement.status,
          date: statement.date,
        },
        codDifference: null,
        feeDifference: null,
        issues: [issue],
        message: issue.message,
      });
      continue;
    }

    canonical.push(statement);
    if (waybillKey) byWaybill.set(waybillKey, statement);
    else if (orderRefKey) byOrderRef.set(orderRefKey, statement);
  }

  const matchedStatementKeys = new Set<StatementRowForComparison>();
  const relevantDeliveries = deliveries.filter((delivery) => {
    if (!delivery.deliveredAt) return true;
    const ms = new Date(delivery.deliveredAt).getTime();
    return Number.isNaN(ms) || (ms >= rangeStart && ms <= rangeEnd);
  });
  let systemCodTotal = 0;
  let missingInStatementAmount = 0;

  for (const delivery of relevantDeliveries) {
    systemCodTotal = round2(systemCodTotal + delivery.expectedCod);
    const waybillKey = normalizeComparisonKey(delivery.waybillId);
    const orderRefKey = normalizeComparisonKey(delivery.orderRef);
    const statement =
      (waybillKey ? byWaybill.get(waybillKey) : undefined) ??
      (orderRefKey ? byOrderRef.get(orderRefKey) : undefined);

    const systemSide: ComparisonSide = {
      deliveryId: delivery.deliveryId,
      waybill: delivery.waybillId,
      orderRef: delivery.orderRef,
      cod: delivery.expectedCod,
      fees: delivery.shippingFee,
      status: delivery.deliveryStatus,
      date: delivery.deliveredAt,
      settlementStatus: delivery.settlementStatus,
    };

    if (!statement) {
      missingInStatementAmount = round2(missingInStatementAmount + delivery.expectedCod);
      const issue: ComparisonIssue = {
        code: 'MISSING_IN_STATEMENT',
        message: delivery.waybillId
          ? `System delivery ${delivery.waybillId} is not in the courier statement.`
          : 'System delivery has no waybill recorded, so it cannot be matched to the statement.',
      };
      rows.push({
        id: `sys-${delivery.deliveryId}`,
        status: 'MISSING_IN_STATEMENT',
        severity: SEVERITY.MISSING_IN_STATEMENT,
        waybill: delivery.waybillId,
        orderRef: delivery.orderRef,
        system: systemSide,
        statement: null,
        codDifference: null,
        feeDifference: null,
        issues: [issue],
        message: issue.message,
      });
      continue;
    }

    matchedStatementKeys.add(statement);
    const { issues, codDifference, feeDifference } = compareMatchedPair(
      delivery,
      statement,
      tolerance,
    );
    const status = statusOf(issues);
    rows.push({
      id: `match-${delivery.deliveryId}`,
      status,
      severity: SEVERITY[status],
      waybill: delivery.waybillId ?? statement.waybill,
      orderRef: delivery.orderRef ?? statement.orderRef,
      system: systemSide,
      statement: {
        waybill: statement.waybill,
        orderRef: statement.orderRef,
        cod: statement.amount,
        fees: statement.fees,
        status: statement.status,
        date: statement.date,
      },
      codDifference,
      feeDifference,
      issues,
      message:
        issues.length > 0
          ? issues.map((issue) => issue.message).join(' ')
          : 'System delivery and courier statement agree on COD, charge, and status.',
    });
  }

  let statementCodTotal = 0;
  let missingInSystemAmount = 0;
  for (const statement of canonical) {
    if (matchedStatementKeys.has(statement)) {
      statementCodTotal = round2(statementCodTotal + (statement.amount ?? 0));
      continue;
    }
    statementCodTotal = round2(statementCodTotal + (statement.amount ?? 0));
    missingInSystemAmount = round2(missingInSystemAmount + (statement.amount ?? 0));
    const issue: ComparisonIssue = {
      code: 'MISSING_IN_SYSTEM',
      message: `Statement row ${
        statement.waybill ?? statement.orderRef ?? '(no reference)'
      } has no matching delivery in our system.`,
    };
    rows.push({
      id: `stmt-${normalizeComparisonKey(statement.waybill ?? statement.orderRef) ?? rows.length}`,
      status: 'MISSING_IN_SYSTEM',
      severity: SEVERITY.MISSING_IN_SYSTEM,
      waybill: statement.waybill,
      orderRef: statement.orderRef,
      system: null,
      statement: {
        waybill: statement.waybill,
        orderRef: statement.orderRef,
        cod: statement.amount,
        fees: statement.fees,
        status: statement.status,
        date: statement.date,
      },
      codDifference: null,
      feeDifference: null,
      issues: [issue],
      message: issue.message,
    });
  }

  rows.sort((a, b) => {
    const priority = STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status);
    if (priority !== 0) return priority;
    return (a.waybill ?? a.orderRef ?? '').localeCompare(b.waybill ?? b.orderRef ?? '');
  });

  const count = (status: DeliveryComparisonStatus) =>
    rows.filter((row) => row.status === status).length;

  const summary: DeliveryComparisonSummary = {
    systemDeliveries: relevantDeliveries.length,
    statementRows: canonical.length,
    matched: count('MATCHED'),
    differences: rows.filter((row) => row.status !== 'MATCHED').length,
    missingInStatement: count('MISSING_IN_STATEMENT'),
    missingInSystem: count('MISSING_IN_SYSTEM'),
    duplicates: duplicateCount,
    amountMismatches: count('AMOUNT_MISMATCH'),
    feeMismatches: count('FEE_MISMATCH'),
    statusMismatches: count('STATUS_MISMATCH'),
    systemCodTotal: round2(systemCodTotal),
    statementCodTotal: round2(statementCodTotal),
    variance: round2(statementCodTotal - systemCodTotal),
    missingInStatementAmount: round2(missingInStatementAmount),
    missingInSystemAmount: round2(missingInSystemAmount),
    statementRowsOutsideRange,
  };

  return {
    filename,
    range: { from, to },
    summary,
    rows,
  };
}
