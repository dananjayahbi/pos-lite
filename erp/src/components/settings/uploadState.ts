/**
 * Module-level singleton state for deferred media uploads.
 *
 * Components push pending files and mark URLs for deletion here,
 * and WebsiteSettingsForm processes them on save.
 */

interface PendingEntry {
  file: File;
  objectUrl: string;
}

/** Map of uploadKey → { file, objectUrl } for files awaiting upload. */
export const pendingUploads = new Map<string, PendingEntry>();

/** Set of Cloudflare URLs to delete on save. */
export const removedUrls = new Set<string>();

/**
 * Upload all pending files to Cloudflare R2.
 * Returns a map of uploadKey → real URL.
 */
export async function processPendingUploads(): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  for (const [key, { file }] of pendingUploads.entries()) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload/website-asset', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = (await response.json().catch(() => ({ error: 'Upload failed' }))) as {
        error?: string;
      };
      throw new Error(err.error || `Upload failed (${response.status})`);
    }

    const data = (await response.json()) as { url: string };
    result.set(key, data.url);
  }

  return result;
}

/**
 * Delete the tracked URLs from Cloudflare.
 */
export async function deleteRemovedUrls(): Promise<void> {
  const urls = Array.from(removedUrls);
  if (urls.length === 0) return;

  await fetch('/api/upload/website-asset/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
  });
}

/** Reset all state (call after successful save). */
export function resetUploadState(): void {
  pendingUploads.clear();
  removedUrls.clear();
}
