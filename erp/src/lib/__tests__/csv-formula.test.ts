import { describe, expect, it } from 'vitest';

import { csvTextCell, neutralizeCsvFormula, toCsvLines } from '@/lib/export';

/**
 * ARGUS #201 - user-entered CSV cells must not execute as spreadsheet formulas.
 */
describe('CSV formula neutralisation', () => {
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=1', '\r=1'])(
    'prefixes a formula-leading string %j with an apostrophe',
    (value) => {
      expect(neutralizeCsvFormula(value)).toBe(`'${value}`);
    },
  );

  it('leaves ordinary text, empty values and numbers untouched', () => {
    expect(neutralizeCsvFormula('Coconut Oil')).toBe('Coconut Oil');
    expect(neutralizeCsvFormula('')).toBe('');
    expect(neutralizeCsvFormula(null)).toBeNull();
    expect(neutralizeCsvFormula(undefined)).toBeUndefined();
    // A signed stock delta is numeric data, not a formula.
    expect(neutralizeCsvFormula(-3)).toBe(-3);
    expect(neutralizeCsvFormula('3')).toBe('3');
  });

  it('neutralises before RFC-4180 quoting', () => {
    expect(csvTextCell('=HYPERLINK("http://x","click")')).toBe(
      `"'=HYPERLINK(""http://x"",""click"")"`,
    );
    expect(csvTextCell('=cmd,1')).toBe(`"'=cmd,1"`);
  });

  it('keeps the neutralised value quoted inside a generated row', () => {
    const csv = toCsvLines(
      ['Product', 'Note'],
      [[`'=1+1`, `'@cmd, with comma`]],
    );
    expect(csv.split('\r\n')[1]).toBe(`'=1+1,"'@cmd, with comma"`);
  });
});
