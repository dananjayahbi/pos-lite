import { describe, expect, it } from 'vitest';

import {
  hasSavedReportArtifact,
  savedReportArtifactLabel,
} from '@/lib/reports/savedReportArtifact.core';

/** ARGUS #445: a legacy row with no artifact must not offer View/Download. */
describe('saved-report artifact state', () => {
  it('requires a storage key or file url', () => {
    expect(hasSavedReportArtifact({ storageKey: 'reports/a.pdf' })).toBe(true);
    expect(hasSavedReportArtifact({ fileUrl: 'https://x/a.pdf' })).toBe(true);
    expect(hasSavedReportArtifact({ storageKey: null, fileUrl: null })).toBe(false);
    expect(hasSavedReportArtifact({})).toBe(false);
  });

  it('labels the state', () => {
    expect(savedReportArtifactLabel({ storageKey: 'x' })).toBe('Artifact ready');
    expect(savedReportArtifactLabel({ storageKey: null })).toBe('Artifact unavailable');
  });
});
