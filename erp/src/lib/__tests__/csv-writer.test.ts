import { describe, it, expect } from 'vitest';

import { csvCell, toCsvLines } from '@/lib/export';

/**
 * M35-01 (BUG-79) — the shared CSV writer.
 *
 * The audit export quoted every cell, header included, producing
 * `"createdAt","entityType",...`. That is RFC-4180-legal but non-idiomatic:
 * Excel/Sheets render the literal quotes in some locales and diffs become
 * noisy. The writer now emits the header unquoted and quotes data cells only
 * when they actually need it.
 */
describe('csvCell (M35-01 / BUG-79)', () => {
  it('leaves plain values unquoted', () => {
    expect(csvCell('SALE_CREATED')).toBe('SALE_CREATED');
    expect(csvCell(42)).toBe('42');
    expect(csvCell('')).toBe('');
  });

  it('renders null and undefined as an empty field', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes values containing a comma', () => {
    expect(csvCell('Office, Stationery')).toBe('"Office, Stationery"');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes values containing CR or LF', () => {
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('line1\r\nline2')).toBe('"line1\r\nline2"');
  });
});

describe('toCsvLines (M35-01 / BUG-79)', () => {
  const headers = ['createdAt', 'entityType', 'entityId', 'action', 'actorId', 'actorRole', 'ipAddress'];

  it('emits the header row UNQUOTED (the F7 pin)', () => {
    const csv = toCsvLines(headers, []);
    expect(csv.split('\r\n')[0]).toBe(
      'createdAt,entityType,entityId,action,actorId,actorRole,ipAddress',
    );
    // The regression that motivated the fix:
    expect(csv).not.toContain('"createdAt"');
  });

  it('writes one line per row plus the header', () => {
    const csv = toCsvLines(headers, [
      ['2026-01-01T00:00:00.000Z', 'Sale', 's1', 'SALE_CREATED', 'u1', 'OWNER', '127.0.0.1'],
    ]);
    expect(csv.split('\r\n')).toHaveLength(2);
  });

  it('keeps a comma-bearing data cell correctly quoted so rows still parse', () => {
    const csv = toCsvLines(['a', 'b'], [['x, y', 'z']]);
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine).toBe('"x, y",z');
  });

  it('does not quote empty fields', () => {
    const csv = toCsvLines(headers, [['t', 'Sale', 's1', 'ACT', '', 'OWNER', '']]);
    expect(csv.split('\r\n')[1]).toBe('t,Sale,s1,ACT,,OWNER,');
  });

  it('produces the same column count on every line (structural validity)', () => {
    const csv = toCsvLines(headers, [
      ['t1', 'Sale', 's1', 'ACT', 'u1', 'OWNER', 'ip'],
      ['t2', 'Product', 'p1', 'UPDATED', 'u2', 'MANAGER', ''],
    ]);
    for (const line of csv.split('\r\n')) {
      expect(line.split(',').length).toBe(headers.length);
    }
  });
});