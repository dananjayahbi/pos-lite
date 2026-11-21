/** Saved-report artifact availability (ARGUS #445). */
export interface SavedReportArtifactLike {
  storageKey?: string | null;
  fileUrl?: string | null;
}

export function hasSavedReportArtifact(report: SavedReportArtifactLike): boolean {
  return Boolean(report.storageKey || report.fileUrl);
}

export function savedReportArtifactLabel(report: SavedReportArtifactLike): string {
  return hasSavedReportArtifact(report) ? 'Artifact ready' : 'Artifact unavailable';
}
