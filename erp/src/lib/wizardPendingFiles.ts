/**
 * Module-level staging area for variant image files that are waiting to be uploaded.
 * Files are stored here during wizard Step 2 and uploaded in bulk at Step 3.
 * Keyed by variant combinationKey (e.g. "M|#000000").
 */

export interface PendingFileEntry {
  file: File;
  previewUrl: string;
}

export interface VariantPendingImages {
  pending: PendingFileEntry[];
  primaryIndex: number;
}

const store = new Map<string, VariantPendingImages>();

export function getPendingImages(combinationKey: string): VariantPendingImages {
  return store.get(combinationKey) ?? { pending: [], primaryIndex: 0 };
}

export function setPendingImages(combinationKey: string, data: VariantPendingImages): void {
  store.set(combinationKey, data);
}

export function addPendingFile(combinationKey: string, file: File): void {
  const current = getPendingImages(combinationKey);
  if (current.pending.length >= 3) return;
  const previewUrl = URL.createObjectURL(file);
  store.set(combinationKey, {
    ...current,
    pending: [...current.pending, { file, previewUrl }],
  });
}

export function removePendingFile(combinationKey: string, index: number): void {
  const current = getPendingImages(combinationKey);
  const entry = current.pending[index];
  if (entry) URL.revokeObjectURL(entry.previewUrl);
  const updated = current.pending.filter((_, i) => i !== index);
  let primaryIndex = current.primaryIndex;
  if (primaryIndex >= updated.length) primaryIndex = Math.max(0, updated.length - 1);
  store.set(combinationKey, { pending: updated, primaryIndex });
}

export function setPrimaryIndex(combinationKey: string, index: number): void {
  const current = getPendingImages(combinationKey);
  store.set(combinationKey, { ...current, primaryIndex: index });
}

export function getAllPendingKeys(): string[] {
  return [...store.keys()];
}

export function clearPendingFiles(): void {
  for (const v of store.values()) {
    for (const e of v.pending) URL.revokeObjectURL(e.previewUrl);
  }
  store.clear();
}
