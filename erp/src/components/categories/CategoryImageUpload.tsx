'use client';

import { useRef, useState } from 'react';
import { ImageOff, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CategoryImageUploadProps {
  /** Current image URL (if any). */
  imageUrl: string | null;
  /** Called with the new URL, or null when removed. */
  onChange: (url: string | null) => void;
  /** Disable all interactions. */
  disabled?: boolean | undefined;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_SIZE = 2 * 1024 * 1024;

/**
 * Single-image uploader for a category's storefront image. Uploads immediately
 * to `/api/store/upload/category-image` and reports the resulting URL.
 */
export function CategoryImageUpload({
  imageUrl,
  onChange,
  disabled,
}: CategoryImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so the same file can be picked again
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, WebP, and SVG images are accepted.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('Image must be under 2 MB.');
      return;
    }

    setError(null);
    uploadImage(file);
  }

  function uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setProgress(percent);
      }
    };

    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText) as { url?: string };
        if (data.url) {
          onChange(data.url);
          setBroken(false);
        } else {
          setError('Upload failed. Please try again.');
        }
      } else {
        let message = 'Upload failed. Please try again.';
        try {
          const data = JSON.parse(xhr.responseText) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          /* keep default */
        }
        setError(message);
      }
    };

    xhr.onerror = () => {
      setProgress(null);
      setError('Upload failed. Please try again.');
    };

    setProgress(0);
    xhr.open('POST', '/api/store/upload/category-image');
    xhr.send(formData);
  }

  function handleRemove() {
    onChange(null);
    setBroken(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-sand/50 bg-pearl/40 p-3">
      {/* Preview */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-sand/30 bg-white">
        {imageUrl ? (
          broken ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-sand/20">
              <ImageOff className="h-5 w-5 text-mist" />
              <span className="mt-1 text-[10px] text-mist">Error</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Category image"
              className="h-full w-full object-cover"
              onError={() => setBroken(true)}
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-sand/10 text-[10px] text-mist">
            No image
          </div>
        )}

        {progress !== null && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
            <div className="flex flex-col items-center text-pearl">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="mt-0.5 text-[10px] font-mono">{progress}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || progress !== null}
          onClick={() => fileInputRef.current?.click()}
          className="h-8 border-sand text-espresso"
        >
          <Upload className="mr-1 h-3.5 w-3.5" />
          {imageUrl ? 'Replace' : 'Upload'}
        </Button>
        {imageUrl && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled || progress !== null}
            onClick={handleRemove}
            className="h-8 text-red-700 hover:bg-red-50"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>

      <p className="ml-auto text-xs text-mist">
        JPEG / PNG / WebP / SVG
        <br />
        Max 2 MB
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFileSelect}
      />

      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
