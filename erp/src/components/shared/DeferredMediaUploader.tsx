'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { pendingUploads, removedUrls } from '@/components/settings/uploadState';

export interface DeferredMediaUploaderProps {
  /** Current media URL (from Cloudflare or empty) */
  value: string;
  /** Called when a file is queued for upload or cleared */
  onChange: (url: string) => void;
  /** Unique key for this upload slot (used to track pending uploads) */
  uploadKey: string;
  /** Accepted MIME types */
  accept?: 'image/*' | 'video/*' | 'image/*,video/*';
  /** Max file size in MB */
  maxSizeMB?: number;
  /** Button label */
  label?: string;
  /** Preview height */
  previewHeight?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Current real URL (to detect removals) */
  currentRealUrl?: string | undefined;
}

/**
 * Media uploader that defers the actual Cloudflare upload until the parent
 * triggers it. Uses ObjectURL for local preview.
 */
export function DeferredMediaUploader({
  value,
  onChange,
  uploadKey,
  accept = 'image/*,video/*',
  maxSizeMB = 50,
  label = 'Upload Media',
  previewHeight = 'h-32',
  placeholder = 'Click to upload or drag & drop',
  disabled = false,
  currentRealUrl,
}: DeferredMediaUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = useCallback(
    (file: File): string | null => {
      if (accept.startsWith('image/') && !file.type.startsWith('image/')) {
        return 'Only image files are accepted.';
      }
      if (accept.startsWith('video/') && !file.type.startsWith('video/')) {
        return 'Only video files are accepted.';
      }
      if (accept === 'image/*,video/*') {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) {
          return 'Only image and video files are accepted.';
        }
      }
      if (file.size > maxSizeBytes) {
        return `File must be under ${maxSizeMB} MB.`;
      }
      return null;
    },
    [accept, maxSizeBytes, maxSizeMB],
  );

  const handleFile = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }

      // Revoke previous ObjectURL if any
      if (localPreview) URL.revokeObjectURL(localPreview);

      const objectUrl = URL.createObjectURL(file);
      setLocalPreview(objectUrl);

      // Register pending upload
      pendingUploads.set(uploadKey, { file, objectUrl });
      onChange(objectUrl);
    },
    [onChange, validateFile, localPreview, uploadKey],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
        e.target.value = '';
      }
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleClear = useCallback(() => {
    if (localPreview) {
      URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
    }
    // Unregister pending upload
    pendingUploads.delete(uploadKey);
    // Mark the current real URL for deletion if it exists
    if (currentRealUrl) {
      removedUrls.add(currentRealUrl);
    }
    onChange('');
  }, [onChange, localPreview, uploadKey, currentRealUrl]);

  // Determine what to show
  const displayUrl = localPreview || value;
  const hasPendingUpload = pendingUploads.has(uploadKey);

  return (
    <div className="space-y-2">
      {/* Existing media or local preview */}
      {displayUrl && (
        <div className={`relative ${previewHeight} rounded-lg overflow-hidden border border-mist bg-sand/20`}>
          <img
            src={displayUrl}
            alt="Preview"
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              title="Remove media"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {hasPendingUpload && (
            <div className="absolute top-2 left-2 bg-terracotta/90 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
              Pending
            </div>
          )}
        </div>
      )}

      {/* Upload area */}
      {!displayUrl && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`${previewHeight} border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
            dragOver ? 'border-terracotta bg-terracotta/5' : 'border-mist hover:border-sand'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Upload className="h-5 w-5 text-sand mb-2" />
          <span className="text-xs text-sand">{placeholder}</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}
