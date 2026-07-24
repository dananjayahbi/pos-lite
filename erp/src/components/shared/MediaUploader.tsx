'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileVideo, ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface MediaUploaderProps {
  /** Current media URL */
  value: string;
  /** Called with the uploaded URL */
  onChange: (url: string) => void;
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
}

/**
 * Reusable media uploader that uploads to Cloudflare R2 via the ERP upload API.
 * Supports images and videos. Shows a preview after upload.
 */
export function MediaUploader({
  value,
  onChange,
  accept = 'image/*,video/*',
  maxSizeMB = 50,
  label = 'Upload Media',
  previewHeight = 'h-32',
  placeholder = 'Click to upload or drag & drop',
  disabled = false,
}: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
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

  const upload = useCallback(
    async (file: File) => {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }

      setUploading(true);
      setProgress(0);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        const url = await new Promise<string>((resolve, reject) => {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText) as { url: string };
                resolve(data.url);
              } catch {
                reject(new Error('Invalid server response'));
              }
            } else {
              try {
                const err = JSON.parse(xhr.responseText) as { error?: string };
                reject(new Error(err.error || `Upload failed (${xhr.status})`));
              } catch {
                reject(new Error(`Upload failed (${xhr.status})`));
              }
            }
          };

          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.onabort = () => reject(new Error('Upload cancelled'));

          xhr.open('POST', '/api/upload/website-asset');
          xhr.send(formData);
        });

        onChange(url);
        toast.success('Media uploaded successfully');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        toast.error(message);
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [onChange, validateFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        upload(file);
        // Reset so the same file can be re-selected
        e.target.value = '';
      }
    },
    [upload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) upload(file);
    },
    [upload],
  );

  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  const isImage = value && /\.(jpg|jpeg|png|webp|svg|gif)(\?|$)/i.test(value);
  const isVideo = value && /\.(mp4|webm|mov|avi)(\?|$)/i.test(value);

  return (
    <div className="space-y-2">
      {/* Existing media preview */}
      {value && (
        <div className={`relative ${previewHeight} rounded-lg overflow-hidden border border-mist bg-sand/20`}>
          {isVideo ? (
            <video
              src={value}
              className="w-full h-full object-cover"
              controls
              muted
            />
          ) : (
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
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
        </div>
      )}

      {/* Upload area */}
      {!value && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer ${
            dragOver
              ? 'border-terracotta bg-terracotta/5'
              : 'border-mist bg-linen hover:border-sand hover:bg-sand/10'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 text-terracotta animate-spin" />
              <div className="w-40 h-1.5 rounded-full bg-sand/30 overflow-hidden">
                <div
                  className="h-full bg-terracotta transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-sand">{progress}%</span>
            </>
          ) : (
            <>
              {accept === 'video/*' ? (
                <FileVideo className="h-8 w-8 text-sand" />
              ) : accept === 'image/*' ? (
                <ImageIcon className="h-8 w-8 text-sand" />
              ) : (
                <Upload className="h-8 w-8 text-sand" />
              )}
              <span className="text-sm text-sand text-center">{placeholder}</span>
              <button
                type="button"
                disabled={disabled}
                className="mt-1 px-4 py-1.5 text-xs font-medium rounded-md bg-espresso text-pearl hover:bg-espresso/90 transition-colors"
              >
                {label}
              </button>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleFileSelect}
      />
    </div>
  );
}
