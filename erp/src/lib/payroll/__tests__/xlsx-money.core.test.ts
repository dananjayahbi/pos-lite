import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  PAYROLL_MONEY_FORMAT,
  applyMoneyNumberFormat,
} from '@/lib/payroll/xlsx-money.core';

describe('applyMoneyNumberFormat', () => {
  it('applies a two-decimal format to numeric money cells only', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Item', 'Amount (LKR)'],
      ['Basic salaries', 26000],
      ['Net pay', 28380.8],
      ['Zero', 0],
      ['Note', 'not money'],
    ]);

    applyMoneyNumberFormat(sheet, [1], 1, 4);

    expect(sheet['B2']?.z).toBe(PAYROLL_MONEY_FORMAT);
    expect(sheet['B3']?.z).toBe(PAYROLL_MONEY_FORMAT);
    expect(sheet['B4']?.z).toBe(PAYROLL_MONEY_FORMAT);
    expect(sheet['B5']?.z).toBeUndefined();
    expect(sheet['A2']?.z).toBeUndefined();
  });

  it('does not create cells outside the sheet', () => {
    const sheet = XLSX.utils.aoa_to_sheet([['Item', 'Amount']]);
    applyMoneyNumberFormat(sheet, [1], 1, 3);
    expect(sheet['B2']).toBeUndefined();
    expect(sheet['B4']).toBeUndefined();
  });
});
