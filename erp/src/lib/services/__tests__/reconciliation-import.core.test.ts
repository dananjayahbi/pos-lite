import { describe, expect, it } from 'vitest';

import {
  buildStatementRawRows,
  describeImportResult,
  readUnmatchedRows,
  summarizeStatementImport,
  unmatchedRowFromParsed,
} from '@/lib/services/reconciliation-import.core';

/**
 * ARGUS #512 — an import that matched nothing must be explainable from the
 * stored `StatementImport` row, and legacy imports must still summarise.
 */
describe('summarizeStatementImport', () => {
  it('uses the stored unmatched list for new imports', () => {
    const rawRows = buildStatementRawRows(
      [{ raw: { waybill: 'WB-1' } }],
      [unmatchedRowFromParsed({ waybill: 'WB-404', amount: '1000.00' })],
    );

    expect(
      summarizeStatementImport({
        rowCount: 1,
        matchedCount: 0,
        discrepancyCount: 0,
        rawRows,
      }),
    ).toEqual({ rowCount: 1, matchedCount: 0, discrepancyCount: 0, unmatchedCount: 1 });
  });

  it('derives the remainder for legacy array-shaped rawRows', () => {
    expect(
      summarizeStatementImport({
        rowCount: 31,
        matchedCount: 24,
        discrepancyCount: 3,
        rawRows: [{ waybill: 'WB-1' }],
      }),
    ).toEqual({ rowCount: 31, matchedCount: 24, discrepancyCount: 3, unmatchedCount: 4 });
  });

  it('does not go negative when counts disagree', () => {
    expect(
      summarizeStatementImport({
        rowCount: 1,
        matchedCount: 5,
        discrepancyCount: 5,
        rawRows: [],
      }).unmatchedCount,
    ).toBe(0);
  });

  it('handles a zero-match completed import', () => {
    const summary = summarizeStatementImport({
      rowCount: 2,
      matchedCount: 0,
      discrepancyCount: 0,
      rawRows: buildStatementRawRows(
        [],
        [unmatchedRowFromParsed({ waybill: 'WB-1' }), unmatchedRowFromParsed({ waybill: 'WB-2' })],
      ),
    });
    expect(summary.unmatchedCount).toBe(2);
  });
});

describe('readUnmatchedRows', () => {
  it('returns normalised unmatched rows from the structured payload', () => {
    const rawRows = buildStatementRawRows(
      [],
      [
        unmatchedRowFromParsed({
          waybill: ' WB-9 ',
          orderRef: '',
          amount: '500',
          fees: '25',
        }),
      ],
    );

    expect(readUnmatchedRows(rawRows)).toEqual([
      {
        waybill: 'WB-9',
        orderRef: null,
        barcode: null,
        amount: '500',
        fees: '25',
        status: null,
        date: null,
        payable: null,
      },
    ]);
  });

  it('returns nothing for legacy array-shaped or missing rawRows', () => {
    expect(readUnmatchedRows([{ waybill: 'WB-1' }])).toEqual([]);
    expect(readUnmatchedRows(null)).toEqual([]);
    expect(readUnmatchedRows({})).toEqual([]);
  });
});

describe('describeImportResult', () => {
  it('states the real counts, including zero matches', () => {
    expect(
      describeImportResult({
        rowCount: 1,
        matchedCount: 0,
        discrepancyCount: 0,
        unmatchedCount: 1,
      }),
    ).toBe('Statement imported: 1 row read, 0 matched, 0 discrepancies, 1 unmatched');
  });
});
