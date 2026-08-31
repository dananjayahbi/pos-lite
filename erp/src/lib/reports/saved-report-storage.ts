// ── Saved Report Object-Storage Path Helpers ───────────────────────────────
// Centralises the R2 `saved_reports/` key convention so the API routes and UI
// share one source of truth for where persisted report files live.

/** The object-storage prefix/folder for saved report artifacts. */
export const SAVED_REPORTS_FOLDER = "saved_reports";

/**
 * Build the S3/R2 object key for a saved report artifact.
 *
 * The key is namespaced by tenant + user so each store's saved reports never
 * collide, and uses a sanitised filename fragment so the file is human-readable
 * in the bucket.
 */
export function buildSavedReportKey(params: {
  tenantId: string;
  userId: string;
  name: string;
  extension: "pdf" | "csv" | "xlsx";
}): string {
  const safeName = sanitizeFilename(params.name);
  const tenantPart = params.tenantId.slice(0, 8);
  const userPart = params.userId.slice(0, 8);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${SAVED_REPORTS_FOLDER}/${tenantPart}/${userPart}/${safeName}-${timestamp}.${params.extension}`;
}

/** Strip characters that are unsafe in object keys / filenames. */
export function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60) || "report";
}

/** Resolve the file extension (without dot) from a storage key. */
export function getExtensionFromKey(key: string): "pdf" | "csv" | "xlsx" {
  const match = key.match(/\.(pdf|csv|xlsx)$/i);
  const ext = match?.[1]?.toLowerCase();
  if (ext === "csv" || ext === "xlsx") return ext;
  return "pdf";
}

/** Derive a display filename (with extension) from a saved report record. */
export function buildDisplayFilename(name: string, extension: "pdf" | "csv" | "xlsx"): string {
  return `${sanitizeFilename(name)}.${extension}`;
}
