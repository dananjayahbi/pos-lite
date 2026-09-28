/**
 * Storage Metrics for the superadmin System Health page.
 *
 * Computes real usage for the configured object-storage provider. The primary
 * provider is Cloudflare R2 (S3-compatible). We list the bucket objects with
 * pagination and fold the byte sizes + object counts into a single summary so
 * the superadmin can see current usage at a glance.
 *
 * This is intentionally defensive: any provider/bucket misconfiguration or
 * transient network error is surfaced as `available: false` with a message
 * rather than crashing the page.
 */

import { paginateListObjectsV2 } from '@aws-sdk/client-s3';
import { getR2Client } from '@/lib/storage';

export type StorageMetrics = {
  provider: string;
  bucket: string;
  available: boolean;
  error: string | null;
  objectCount: number;
  totalBytes: number;
  /** Grouped by top-level "folder" prefix for a quick breakdown. */
  folders: { prefix: string; count: number; bytes: number }[];
};

const FORMAT_BYTES = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});

/** Human-readable byte size (e.g. "1.2 MB"). */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${FORMAT_BYTES.format(value)} ${units[exponent]}`;
}

/**
 * Return the top-level prefix (first path segment) of an object key.
 * e.g. "saved_reports/abc/report.pdf" -> "saved_reports"
 */
function topLevelPrefix(key: string): string {
  const clean = key.replace(/^\/+/, '');
  const slash = clean.indexOf('/');
  return slash === -1 ? clean : clean.slice(0, slash);
}

/**
 * Fetch live storage usage for the configured provider/bucket.
 * Falls back to a not-available summary on any error.
 */
export async function getStorageMetrics(): Promise<StorageMetrics> {
  const provider = process.env.STORAGE_PROVIDER ?? 'not-configured';
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? process.env.R2_BUCKET ?? 'n/a';

  // Only R2 provides usage introspection via the S3 ListObjectsV2 API we wire up.
  if (provider !== 'cloudflare_r2') {
    return {
      provider,
      bucket,
      available: false,
      error: `Usage metrics are not available for the "${provider}" provider. Configure Cloudflare R2 to view storage usage.`,
      objectCount: 0,
      totalBytes: 0,
      folders: [],
    };
  }

  try {
    const client = getR2Client();
    const paginator = paginateListObjectsV2({ client }, { Bucket: bucket });

    let objectCount = 0;
    let totalBytes = 0;
    const folderMap = new Map<string, { count: number; bytes: number }>();

    for await (const page of paginator) {
      for (const obj of page.Contents ?? []) {
        if (!obj.Key || obj.Key.endsWith('/')) continue;
        const size = obj.Size ?? 0;
        objectCount += 1;
        totalBytes += size;

        const prefix = topLevelPrefix(obj.Key);
        const existing = folderMap.get(prefix) ?? { count: 0, bytes: 0 };
        existing.count += 1;
        existing.bytes += size;
        folderMap.set(prefix, existing);
      }
    }

    const folders = Array.from(folderMap.entries())
      .map(([prefix, { count, bytes }]) => ({ prefix, count, bytes }))
      .sort((a, b) => b.bytes - a.bytes);

    return {
      provider,
      bucket,
      available: true,
      error: null,
      objectCount,
      totalBytes,
      folders,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to retrieve storage metrics from Cloudflare R2';
    return {
      provider,
      bucket,
      available: false,
      error: message,
      objectCount: 0,
      totalBytes: 0,
      folders: [],
    };
  }
}
