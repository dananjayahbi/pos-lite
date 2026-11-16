import { describe, expect, it } from 'vitest';
import {
  buildDeliveryComparison,
  getStatementDateSpan,
  hasStatementRowInRange,
  normalizeComparisonKey,
  parseMoney,
  parseStatementDate,
  type StatementRowForComparison,
  type SystemDeliveryForComparison,
} from '@/lib/services/reconciliation-compare.core';
import { normalizeRow } from '@/lib/services/reconciliation-parser.service';

function delivery(overrides: Partial<SystemDeliveryForComparison> = {}): SystemDeliveryForComparison {
  return {
    deliveryId: 'del-1',
    waybillId: 'BA818881',
    orderRef: 'AYR-2026-0001',
    expectedCod: 3900,
    deliveredAt: '2026-07-13T10:00:00.000Z',
    deliveryStatus: 'DELIVERED',
    shippingFee: 475,
    settlementStatus: 'PENDING_SETTLEMENT',
    ...overrides,
  };
}

function statement(overrides: Partial<StatementRowForComparison> = {}): StatementRowForComparison {
  return {
    waybill: 'BA818881',
    orderRef: 'AYR-2026-0001',
    amount: 3900,
    fees: 475,
    status: 'Delivered',
    date: '2026-07-13 16:45:03',
    raw: {},
    ...overrides,
  };
}

const RANGE = { from: '2026-07-01', to: '2026-07-31' };

describe('normalizeComparisonKey', () => {
  it('trims, removes inner spaces, and upper-cases references', () => {
    expect(normalizeComparisonKey(' ba 818881 ')).toBe('BA818881');
    expect(normalizeComparisonKey('')).toBeNull();
    expect(normalizeComparisonKey(null)).toBeNull();
  });
});

describe('parseMoney', () => {
  it('accepts formatted currency, numeric cells, and blanks', () => {
    expect(parseMoney('Rs. 3,900.00')).toBe(3900);
    expect(parseMoney('475')).toBe(475);
    expect(parseMoney(3425.5)).toBe(3425.5);
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('-')).toBeNull();
    expect(parseMoney(null)).toBeNull();
  });
});

describe('parseStatementDate', () => {
  it('parses the courier datetime and rejects junk', () => {
    expect(parseStatementDate('2026-07-13 16:45:03')?.toISOString()).toBe(
      '2026-07-13T00:00:00.000Z',
    );
    expect(parseStatementDate('')).toBeNull();
    expect(parseStatementDate('not a date')).toBeNull();
  });
});

describe('statement date coverage', () => {
  it('reports the earliest and latest readable date in the sheet', () => {
    expect(
      getStatementDateSpan([
        statement({ date: '2026-07-31 10:00:00' }),
        statement({ date: '2026-07-01 09:00:00' }),
        statement({ date: 'not a date' }),
        statement({ date: null }),
      ]),
    ).toEqual({ from: '2026-07-01', to: '2026-07-31' });
    expect(getStatementDateSpan([])).toBeNull();
    expect(getStatementDateSpan([statement({ date: null })])).toBeNull();
  });

  it('detects whether any row can belong to the requested range', () => {
    const rows = [
      statement({ date: '2026-07-13 16:45:03' }),
      statement({ date: null }),
    ];
    expect(hasStatementRowInRange(rows, '2026-07-01', '2026-07-31')).toBe(true);
    expect(hasStatementRowInRange(rows, '2026-11-01', '2026-11-30')).toBe(true);
    expect(
      hasStatementRowInRange([statement({ date: '2026-07-13' })], '2026-11-01', '2026-11-30'),
    ).toBe(false);
  });
});

describe('buildDeliveryComparison', () => {
  it('marks a tallied delivery as matched', () => {
    const report = buildDeliveryComparison({
      deliveries: [delivery()],
      statementRows: [statement()],
      ...RANGE,
    });
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.status).toBe('MATCHED');
    expect(report.rows[0]?.severity).toBe('ok');
    expect(report.summary.matched).toBe(1);
    expect(report.summary.differences).toBe(0);
    expect(report.summary.variance).toBe(0);
  });

  it('flags a short COD collection with the exact difference', () => {
    const report = buildDeliveryComparison({
      deliveries: [delivery({ expectedCod: 3900 })],
      statementRows: [statement({ amount: 3425 })],
      ...RANGE,
    });
    const row = report.rows[0]!;
    expect(row.status).toBe('AMOUNT_MISMATCH');
    expect(row.codDifference).toBe(-475);
    expect(row.message).toContain('short by 475.00');
    expect(report.summary.amountMismatches).toBe(1);
    expect(report.summary.variance).toBe(-475);
  });

  it('ignores sub-cent drift within tolerance', () => {
    const report = buildDeliveryComparison({
      deliveries: [delivery({ expectedCod: 100 })],
      statementRows: [statement({ amount: 100.005, fees: 475 })],
      ...RANGE,
    });
    expect(report.rows[0]?.status).toBe('MATCHED');
  });

  it('reports a delivery absent from the statement', () => {
    const report = buildDeliveryComparison({
      deliveries: [delivery()],
      statementRows: [],
      ...RANGE,
    });
    expect(report.rows[0]?.status).toBe('MISSING_IN_STATEMENT');
    expect(report.summary.missingInStatement).toBe(1);
    expect(report.summary.missingInStatementAmount).toBe(3900);
  });

  it('reports a statement waybill absent from our system', () => {
    const report = buildDeliveryComparison({
      deliveries: [],
      statementRows: [statement({ waybill: 'BA999999', orderRef: null })],
      ...RANGE,
    });
    expect(report.rows[0]?.status).toBe('MISSING_IN_SYSTEM');
    expect(report.rows[0]?.message).toContain('BA999999');
    expect(report.summary.missingInSystem).toBe(1);
    expect(report.summary.missingInSystemAmount).toBe(3900);
  });

  it('flags duplicate waybills and keeps one canonical statement row', () => {
    const report = buildDeliveryComparison({
      deliveries: [delivery()],
      statementRows: [statement(), statement({ amount: 3900 })],
      ...RANGE,
    });
    expect(report.summary.duplicates).toBe(1);
    expect(report.rows.some((row) => row.status === 'DUPLICATE_IN_STATEMENT')).toBe(true);
    expect(report.summary.statementRows).toBe(1);
  });

  it('flags a courier charge that differs from the system shipping fee', () => {
    const report = buildDeliveryComparison({
      deliveries: [delivery({ shippingFee: 400 })],
      statementRows: [statement({ fees: 475 })],
      ...RANGE,
    });
    expect(report.rows[0]?.status).toBe('FEE_MISMATCH');
    expect(report.rows[0]?.feeDifference).toBe(75);
    expect(report.summary.feeMismatches).toBe(1);
  });

  it('flags a statement that does not mark the order delivered', () => {
    const report = buildDeliveryComparison({
      deliveries: [delivery()],
      statementRows: [statement({ status: 'Pending' })],
      ...RANGE,
    });
    expect(report.rows[0]?.status).toBe('STATUS_MISMATCH');
    expect(report.summary.statusMismatches).toBe(1);
  });

  it('matches references case-insensitively and with stray spaces', () => {
    const report = buildDeliveryComparison({
      deliveries: [delivery({ waybillId: 'ba 818881' })],
      statementRows: [statement({ waybill: 'BA818881' })],
      ...RANGE,
    });
    expect(report.rows[0]?.status).toBe('MATCHED');
  });

  it('excludes statement rows outside the requested range', () => {
    const report = buildDeliveryComparison({
      deliveries: [delivery({ deliveredAt: '2026-06-30T10:00:00.000Z' })],
      statementRows: [statement({ date: '2026-06-30' })],
      ...RANGE,
    });
    expect(report.rows).toHaveLength(0);
    expect(report.summary.statementRowsOutsideRange).toBe(1);
    // The out-of-range system delivery is excluded from the comparison window.
    expect(report.summary.systemDeliveries).toBe(0);
  });

  it('does not treat repeated generic ORDER NO values as duplicates when waybills differ', () => {
    const report = buildDeliveryComparison({
      deliveries: [],
      statementRows: [
        statement({ waybill: 'BA1', orderRef: 'f' }),
        statement({ waybill: 'BA2', orderRef: 'f' }),
        statement({ waybill: 'BA3', orderRef: 'F' }),
      ],
      ...RANGE,
    });
    expect(report.summary.duplicates).toBe(0);
    expect(report.summary.statementRows).toBe(3);
    expect(report.rows.filter((row) => row.status === 'MISSING_IN_SYSTEM')).toHaveLength(3);
  });

  it('falls back to the order reference when the sheet has no waybill', () => {
    const report = buildDeliveryComparison({
      deliveries: [delivery()],
      statementRows: [statement({ waybill: null, orderRef: 'AYR-2026-0001' })],
      ...RANGE,
    });
    expect(report.rows[0]?.status).toBe('MATCHED');
  });

  it('sorts critical differences before warnings and matches', () => {
    const report = buildDeliveryComparison({
      deliveries: [
        delivery({ orderRef: 'AYR-A' }),
        delivery({ deliveryId: 'del-2', waybillId: 'BA2', orderRef: 'AYR-B' }),
      ],
      statementRows: [
        statement({ waybill: 'BA2', orderRef: 'AYR-B', fees: 400 }),
        statement({ waybill: 'BA3', orderRef: 'AYR-C' }),
      ],
      ...RANGE,
    });
    expect(report.rows[0]?.status).toBe('MISSING_IN_STATEMENT');
    expect(report.rows.at(-1)?.status).not.toBe('MISSING_IN_STATEMENT');
  });

  it('flags an empty statement instead of claiming there is nothing to fix', () => {
    const report = buildDeliveryComparison({
      deliveries: [],
      statementRows: [],
      ...RANGE,
      filename: 'empty.xlsx',
    });
    expect(report.rows).toHaveLength(0);
    expect(report.warnings.map((warning) => warning.code)).toEqual(['NO_STATEMENT_ROWS']);
    expect(report.warnings[0]?.severity).toBe('critical');
    expect(report.warnings[0]?.message).toContain('empty.xlsx');
  });

  it('flags a statement whose every row falls outside the compared range', () => {
    const report = buildDeliveryComparison({
      deliveries: [],
      statementRows: [statement({ date: '2025-01-05' })],
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(report.rows).toHaveLength(0);
    expect(report.summary.statementRowsTotal).toBe(1);
    expect(report.summary.statementRowsInRange).toBe(0);
    expect(report.summary.statementDateFrom).toBe('2025-01-05');
    expect(report.warnings.map((warning) => warning.code)).toEqual(['STATEMENT_OUT_OF_RANGE']);
    expect(report.warnings[0]?.message).toContain('2025-01-05 to 2025-01-05');
  });

  it('warns when the period has no system deliveries at all', () => {
    const report = buildDeliveryComparison({
      deliveries: [],
      statementRows: [statement()],
      ...RANGE,
    });
    expect(report.summary.missingInSystem).toBe(1);
    expect(report.warnings.map((warning) => warning.code)).toEqual(['NO_SYSTEM_DELIVERIES']);
    expect(report.warnings[0]?.severity).toBe('warning');
  });

  it('keeps the requested range beside the statement range that was used', () => {
    const report = buildDeliveryComparison({
      deliveries: [delivery()],
      statementRows: [statement()],
      from: '2026-07-01',
      to: '2026-07-31',
      requestedRange: { from: '2026-11-01', to: '2026-11-30' },
      rangeAdjusted: true,
    });
    expect(report.range).toEqual({ from: '2026-07-01', to: '2026-07-31' });
    expect(report.requestedRange).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(report.rangeAdjusted).toBe(true);
    expect(report.summary.matched).toBe(1);
  });
});

describe('normalizeRow on the real Trans Express Invoice Details header', () => {
  it('maps the collected COD and delivery charge columns, not the order COD/commission', () => {
    const row = normalizeRow({
      'ORDER DATE': '2026-07-13 16:45:03',
      'WAYBILL ID': 'BA818881',
      'INVOICE NO': 'TRA-26-07-596016',
      'ORDER NO': 'f',
      'VAT %': '0',
      COMMISSION: '0',
      COD: '3900',
      'COLLECTED COD': '3900',
      'TOTAL VAT': '0',
      'TOTAL COMMISSION': '0',
      'DELIVERY CHARGE': '475',
      PAYABLE: '3425',
      'WEIGHT (KG)': '1',
      STATUS: 'Delivered',
    });

    expect(row.waybill).toBe('BA818881');
    expect(row.amount).toBe('3900');
    expect(row.fees).toBe('475');
    expect(row.payable).toBe('3425');
    expect(row.status).toBe('Delivered');
    expect(row.date).toBe('2026-07-13 16:45:03');
    expect(row.orderRef).toBe('f');
  });
});
