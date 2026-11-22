import { describe, expect, it } from 'vitest';
import { buildPayrollExportAudit } from '@/lib/payroll/export-audit.core';

describe('buildPayrollExportAudit', () => {
  it('captures export type, format, period and row count', () => {
    expect(
      buildPayrollExportAudit({
        exportType: 'bank-sheet',
        format: 'xlsx',
        periodMonth: '2026-11',
        itemCount: 12,
        incompleteOverride: true,
      }),
    ).toEqual({
      exportType: 'bank-sheet',
      format: 'xlsx',
      periodMonth: '2026-11',
      itemCount: 12,
      incompleteOverride: true,
    });
  });

  it('treats a missing override as false and clamps malformed counts', () => {
    expect(
      buildPayrollExportAudit({
        exportType: 'statutory',
        format: 'pdf',
        periodMonth: '2026-09',
        itemCount: Number.NaN,
      }),
    ).toEqual({
      exportType: 'statutory',
      format: 'pdf',
      periodMonth: '2026-09',
      itemCount: 0,
      incompleteOverride: false,
    });
  });
});
