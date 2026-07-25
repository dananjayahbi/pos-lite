'use client';

import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  addPendingFile,
  removePendingFile,
  setPrimaryIndex,
  getPendingImages,
} from '@/lib/wizardPendingFiles';
import { VariantImageThumbnail } from './VariantImageThumbnail';

interface VariantImagesUploadProps {
  /** Stable key identifying this variant (e.g. `${form}|${packSize}`). */
  combinationKey: string;
  /**
   * Maximum number of images allowed per variant.
   * @default 10
   */
  maxImages?: number;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;
/** Delay between sequential file staging so the user sees them appear one-by-one. */
const STAGED_DELAY_MS = 150;

interface ProcessingEntry {
  /** Unique key for this placeholder. */
  key: string;
  /** File name for the in-progress log. */
  name: string;
}

/**
 * Compact image upload widget for a single variant.
 *
 * Uses the module-level pending-files store keyed by `combinationKey`, so the
 * staged files survive until the wizard submits them in step 3. Renders a
 * flexible grid of thumbnails with set-primary / remove controls.
 *
 * Selection flow:
 *   1. User picks one or many files via the file input (multi-select).
 *   2. Each file is validated client-side (type + size).
 *   3. Valid files are added to the pending store sequentially with a small
 *      delay; an in-place spinner placeholder is shown per file as it is
 *      staged so the user perceives a "loading one-by-one" effect.
 *   4. Invalid files surface as per-file toast errors; processing continues
 *      for the remaining valid files.
 *
 * NOTE: Files are kept as in-memory `File` objects until step 3 of the wizard
 * actually uploads them to Cloudflare via `POST /api/upload`. Selecting an
 * image does NOT trigger any network upload.
 */
export function VariantImagesUpload({
  combinationKey,
  maxImages = 10,
}: VariantImagesUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingState, setPendingState] = useState(() =>
    getPendingImages(combinationKey),
  );
  const [processing, setProcessing] = useState<ProcessingEntry[]>([]);
  const isBusyRef = useRef(false);

  function refresh() {
    setPendingState({ ...getPendingImages(combinationKey) });
  }

  async function processFiles(files: File[]) {
    if (files.length === 0) return;

    // Guard against concurrent picks (e.g. user clicks the input twice).
    if (isBusyRef.current) return;
    isBusyRef.current = true;

    try {
      const current = getPendingImages(combinationKey);
      const remaining = maxImages - current.pending.length;

      if (remaining <= 0) {
        toast.error(
          `Maximum ${maxImages} images per variant. Remove one first.`,
        );
        return;
      }

      const toProcess = files.slice(0, remaining);
      const skipped = files.length - toProcess.length;

      // Validate each file up front. Invalid files surface a per-file toast;
      // valid files are queued for sequential staging.
      const validFiles: File[] = [];
      for (const file of toProcess) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          toast.error(
            `"${file.name}" — Only JPEG, PNG, and WebP images are accepted.`,
          );
          continue;
        }
        if (file.size > MAX_BYTES) {
          toast.error(`"${file.name}" — Image must be under 5 MB.`);
          continue;
        }
        validFiles.push(file);
      }

      if (skipped > 0) {
        toast.warning(
          skipped === 1
            ? `1 file skipped (max ${maxImages} images per variant).`
            : `${skipped} files skipped (max ${maxImages} images per variant).`,
        );
      }

      if (validFiles.length === 0) return;

      // Stage files one-by-one with a brief delay so each tile visibly
      // transitions from a spinner placeholder to the real thumbnail.
      for (const [i, file] of validFiles.entries()) {
        const procKey = `${file.name}-${Date.now()}-${i}`;

        // Insert the spinner placeholder.
        setProcessing((prev) => [
          ...prev,
          { key: procKey, name: file.name },
        ]);

        // Brief delay so the user perceives the sequential load.
        await new Promise((resolve) => setTimeout(resolve, STAGED_DELAY_MS));

        // Commit to the pending store; this generates the preview URL.
        addPendingFile(combinationKey, file);
        refresh();

        // Remove the spinner placeholder. The real thumbnail now appears
        // via the next render from `pendingState`.
        setProcessing((prev) => prev.filter((p) => p.key !== procKey));
      }
    } finally {
      isBusyRef.current = false;
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    // Reset so the same file can be picked again later.
    e.target.value = '';
    if (files.length === 0) return;
    void processFiles(files);
  }

  function handleRemove(idx: number) {
    removePendingFile(combinationKey, idx);
    refresh();
  }

  function handleSetPrimary(idx: number) {
    setPrimaryIndex(combinationKey, idx);
    refresh();
  }

  const hasRoom = pendingState.pending.length < maxImages;
  const isStaging = processing.length > 0;
  const showAdd = hasRoom && !isStaging;
  const showMax = !hasRoom;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Sequential-load spinners (one per file currently being staged). */}
        {processing.map((entry) => (
          <VariantImageThumbnail
            key={entry.key}
            src=""
            alt={`Staging ${entry.name}`}
            isPrimary={false}
            isLoading
          />
        ))}

        {/* Confirmed thumbnails backed by the pending store. */}
        {pendingState.pending.map((entry, i) => {
          const isPrimary = i === pendingState.primaryIndex;
          return (
            <VariantImageThumbnail
              key={entry.previewUrl}
              src={entry.previewUrl}
              alt={`Variant image ${i + 1}`}
              isPrimary={isPrimary}
              onSetPrimary={() => handleSetPrimary(i)}
              onRemove={() => handleRemove(i)}
            />
          );
        })}

        {showAdd && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded border-2 border-dashed border-sand bg-linen transition-colors hover:border-terracotta hover:bg-terracotta/5"
            aria-label="Add images"
          >
            <Plus className="h-4 w-4 text-terracotta" />
            <span className="text-[10px] text-mist">Upload</span>
          </button>
        )}

        {showMax && (
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded border border-sand/40 bg-sand/10">
            <span className="text-[10px] font-medium text-mist">Max</span>
            <span className="text-[10px] text-mist">{maxImages}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-mist font-body">
          {pendingState.pending.length} / {maxImages} images · first image is
          the primary
        </p>
        <p className="text-[10px] text-mist">
          JPEG / PNG / WebP · max 5 MB · multi-select
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFile}
      />
    </div>
  );
}