import { describe, expect, it } from 'vitest';
import {
  PAYROLL_EXPORT_PROVENANCE_CAVEAT,
  buildPayrollExportProvenance,
} from '@/lib/payroll/export-provenance';

describe('buildPayrollExportProvenance', () => {
  it('marks company identity as current profile, not a run snapshot', () => {
    const provenance = buildPayrollExportProvenance({
      companyName: 'Ruhunu Wedagedara',
      employerEpfNumber: 'EPF-EMP-1',
      employerEtfNumber: 'ETF-EMP-1',
      generatedAt: new Date('2026-12-01T08:05:00Z'),
    });
    expect(provenance.snapshotComplete).toBe(false);
    expect(provenance.companyName).toBe('Ruhunu Wedagedara');
    expect(provenance.employerEpfNumber).toBe('EPF-EMP-1');
    expect(provenance.employerEtfNumber).toBe('ETF-EMP-1');
    expect(provenance.label).toContain('not a historical snapshot');
    expect(provenance.caveat).toBe(PAYROLL_EXPORT_PROVENANCE_CAVEAT);
    expect(provenance.caveat).toContain('current company profile');
    expect(provenance.caveat).toContain('regenerated at download time');
    expect(provenance.caveat).toContain('may differ from the originally issued copy');
  });

  it('puts the regeneration timestamp in the export header', () => {
    const provenance = buildPayrollExportProvenance({
      companyName: 'Ruhunu Wedagedara',
      employerEpfNumber: '',
      employerEtfNumber: '',
      generatedAt: new Date('2026-12-01T08:05:00Z'),
    });
    expect(provenance.header).toContain('Regenerated');
    expect(provenance.header).toContain('2026');
    expect(provenance.header).toContain('current company profile');
  });

  it('does not throw on an invalid download date', () => {
    const provenance = buildPayrollExportProvenance({
      companyName: 'Ruhunu Wedagedara',
      employerEpfNumber: '',
      employerEtfNumber: '',
      generatedAt: new Date('invalid'),
    });
    expect(provenance.header).toContain('unknown time');
  });
});
