import { describe, expect, it } from 'vitest';

import {
  buildExpenseRegisterCsv,
  expenseRegisterFilename,
} from '@/lib/expenses/register-export';

function linesOf(csv: string): string[] {
  return csv.replace(/^\uFEFF/, '').split('\r\n');
}

describe('expense register export (ARGUS #396)', () => {
  it('writes the register header and one row per expense', () => {
    const csv = buildExpenseRegisterCsv([
      {
        expenseDate: '2026-09-16T10:30:00.000Z',
        category: 'MISCELLANEOUS',
        description: 'Shop cleaning',
        amount: '1250.5',
        paymentAccountId: 'acct-1',
        paymentAccount: { name: 'Bank' },
        recordedBy: { email: 'owner@example.com' },
      },
      {
        expenseDate: '2026-09-15',
        category: 'TEA_SUGAR',
        description: 'Tea packets',
        amount: 800,
        pettyCashFundId: 'fund-1',
        pettyCashFund: { name: 'Main Petty Cash' },
        recordedBy: { email: 'manager@example.com' },
      },
    ]);

    const lines = linesOf(csv);
    expect(lines[0]).toBe(
      'Date,Category,Description,Account,Amount,Receipt URL,Recorded By',
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(
      '2026-09-16,Miscellaneous,Shop cleaning,Bank,1250.50,,owner@example.com',
    );
    expect(lines[2]).toBe(
      '2026-09-15,Tea & Sugar,Tea packets,Main Petty Cash,800.00,,manager@example.com',
    );
  });

  it('includes bank, cash and unlinked expenses rather than one fund only', () => {
    const csv = buildExpenseRegisterCsv([
      {
        expenseDate: '2026-09-01',
        category: 'RENT',
        description: 'Rent from bank',
        amount: '50000.00',
        paymentAccountId: 'acct-bank',
        paymentAccount: { name: 'Commercial Bank' },
      },
      {
        expenseDate: '2026-09-02',
        category: 'TRAVEL',
        description: 'Fuel from cash',
        amount: '3000.00',
        paymentAccountId: 'acct-cash',
        paymentAccount: { name: 'Cash Drawer' },
      },
      {
        expenseDate: '2026-09-03',
        category: 'OTHER',
        description: 'Unlinked historical row',
        amount: '100.00',
      },
    ]);

    const body = linesOf(csv).slice(1).join('\n');
    expect(body).toContain('Commercial Bank');
    expect(body).toContain('Cash Drawer');
    expect(body).toContain('Unlinked historical row,-,100.00');
  });

  it('neutralises spreadsheet formulas in text columns', () => {
    const csv = buildExpenseRegisterCsv([
      {
        expenseDate: '2026-09-16',
        category: 'OTHER',
        description: '=HYPERLINK("https://evil.example","click")',
        amount: '10.00',
        paymentAccountId: 'acct-1',
        paymentAccount: { name: '+cmd|calc' },
        recordedBy: { email: '@malicious.example' },
      },
    ]);

    const row = linesOf(csv)[1];
    expect(row).toContain("'=HYPERLINK");
    expect(row).toContain("'+cmd|calc");
    expect(row).toContain("'@malicious.example");
    // Data cells that need RFC-4180 quoting are still quoted.
    expect(row).toContain('"\'=HYPERLINK(""https://evil.example"",""click"")"');
  });

  it('keeps commas and quotes parseable', () => {
    const csv = buildExpenseRegisterCsv([
      {
        expenseDate: '2026-09-16',
        category: 'OFFICE_STATIONERY',
        description: 'Paper, pens and "misc"',
        amount: '450.00',
      },
    ]);

    expect(linesOf(csv)[1]).toBe(
      '2026-09-16,Office Stationery,"Paper, pens and ""misc""",-,450.00,,',
    );
  });

  it('names the download after the register', () => {
    expect(expenseRegisterFilename(new Date('2026-09-16T23:00:00.000Z'))).toBe(
      'expense-register-2026-09-16.csv',
    );
  });
});
