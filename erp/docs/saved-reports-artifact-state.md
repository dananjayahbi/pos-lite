# Saved reports with no artifact

The live saved report stores the legacy path form and has `storageKey = null`.
The card used to show a PDF badge, View and Download even though both download
endpoints return 404 (ARGUS #445).

`hasSavedReportArtifact(report)` considers the artifact ready only when a
`storageKey` or `fileUrl` exists. Without one, View and Download are replaced by
an explicit **Artifact unavailable - view/download disabled** badge. Open in
App, Rename and Delete remain available, so the record can still be opened
against current filters or removed.

## Verification

`savedReportArtifact.core.test.ts` covers storage key, file URL, both-null and
missing-field states.
