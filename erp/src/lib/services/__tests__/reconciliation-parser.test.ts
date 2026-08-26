import { describe, it, expect } from 'vitest';
import {
  detectStatementFileType,
  normalizeRow,
  parseRemittanceCsv,
} from '@/lib/services/reconciliation-parser.service';

describe('detectStatementFileType', () => {
  it('detects csv/xlsx/xls by extension (case-insensitive)', () => {
    expect(detectStatementFileType('stmt.CSV')).toBe('csv');
    expect(detectStatementFileType('stmt.xlsx')).toBe('xlsx');
    expect(detectStatementFileType('stmt.XLS')).toBe('xls');
  });

  it('returns null for unsupported extensions', () => {
    expect(detectStatementFileType('stmt.txt')).toBeNull();
    expect(detectStatementFileType('stmt')).toBeNull();
  });
});

describe('normalizeRow', () => {
  it('maps flexible headers to the statement fields', () => {
    const row = normalizeRow({
      'Order Reference': 'ORD-1',
      'Airway Bill Number': 'WB-42',
      'COD Amount': '1000.00',
      'Deduction': '50.00',
    });
    expect(row.waybill).toBe('WB-42');
    expect(row.orderRef).toBe('ORD-1');
    expect(row.amount).toBe('1000.00');
    expect(row.fees).toBe('50.00');
  });

  it('leaves unmatched fields undefined', () => {
    const row = normalizeRow({ someUnrelated: 'x' });
    expect(row.waybill).toBeUndefined();
    expect(row.amount).toBeUndefined();
    expect(row.raw).toEqual({ someUnrelated: 'x' });
  });
});

describe('parseRemittanceCsv', () => {
  it('parses a header row into normalized rows', () => {
    const csv = 'waybill,amount,status\nWB1,500,delivered\nWB2,700,delivered\n';
    const rows = parseRemittanceCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.waybill).toBe('WB1');
    expect(rows[1]?.amount).toBe('700');
  });
});
