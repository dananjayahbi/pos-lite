import { describe, expect, it } from 'vitest';

import { reportArtifactMetaLines } from '@/lib/reports/reportArtifactMeta.core';

/** ARGUS #449: CSV/XLSX artifacts must carry the same title/date metadata as PDF. */
describe('reportArtifactMetaLines', () => {
  it('emits the title and date range in the PDF header shape', () => {
    expect(reportArtifactMetaLines('Sales Report', '2026-10-01 to 2026-10-31')).toEqual([
      'AyurPOS - Sales Report',
      '2026-10-01 to 2026-10-31',
    ]);
  });

  it('omits blank parts instead of emitting empty lines', () => {
    expect(reportArtifactMetaLines('  ', '')).toEqual([]);
    expect(reportArtifactMetaLines('Sales', '  ')).toEqual(['AyurPOS - Sales']);
    expect(reportArtifactMetaLines('', 'Today')).toEqual(['Today']);
  });
});
