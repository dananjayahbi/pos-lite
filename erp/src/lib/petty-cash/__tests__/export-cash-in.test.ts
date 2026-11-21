import { describe, expect, it } from 'vitest';

import { buildPettyCashCashInCsv } from '@/lib/petty-cash/export-cash-in';

function lines(csv: string): string[] {
  return csv.replace(/^\uFEFF/, '').split('\r\n');
}

describe('petty-cash cash-in export section (ARGUS #412)', () => {
  it('writes date, source, note, operator and amount', () => {
    const csv = buildPettyCashCashInCsv([
      {
        entryDate: '2026-11-06T09:30:00.000Z',
        source: 'Commercial Bank',
        description: 'Monthly float top-up',
        amount: 10000,
        recordedByEmail: 'owner@example.com',
      },
      {
        entryDate: '2026-11-07',
        source: 'External cash',
        description: 'Owner cash',
        amount: 1,
        recordedByEmail: null,
      },
    ]);
    const rows = lines(csv);
    expect(rows[0]).toBe('Date,Source,Note,Recorded By,Amount');
    expect(rows[1]).toBe('2026-11-06,Commercial Bank,Monthly float top-up,owner@example.com,10000.00');
    expect(rows[2]).toBe('2026-11-07,External cash,Owner cash,,1.00');
  });

  it('neutralises spreadsheet formulas in text columns', () => {
    const csv = buildPettyCashCashInCsv([
      {
        entryDate: '2026-11-06',
        source: '+cmd|calc',
        description: '=HYPERLINK("https://evil.example","click")',
        amount: 10,
        recordedByEmail: '@malicious.example',
      },
    ]);
    const row = lines(csv)[1];
    expect(row).toContain("'+cmd|calc");
    expect(row).toContain("'=HYPERLINK");
    expect(row).toContain("'@malicious.example");
  });

  it('still emits the header for a period with no cash-in', () => {
    expect(lines(buildPettyCashCashInCsv([]))).toEqual([
      'Date,Source,Note,Recorded By,Amount',
    ]);
  });
});
