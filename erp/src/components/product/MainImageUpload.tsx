'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { ImagePlus, X, Loader2, ImageOff } from 'lucide-react';
import { toast } from 'sonner';

interface MainImageUploadProps {
  /** Current main image URL (empty string if none). */
  value: string;
  /** Called with the uploaded/removed URL ('' to clear). */
  onChange: (url: string) => void;
  label?: string;
}

/**
 * Single-image uploader for a product's main image (shown on storefront cards).
 * Uploads immediately to `/api/upload` and reports the resulting URL.
 */
export function MainImageUpload({
  value,
  onChange,
  label = 'Main Image',
}: MainImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be selected again
    e.target.value = '';

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPEG, PNG, and WebP images are accepted.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.');
      return;
    }

    setError(null);
    uploadImage(file);
  }

  function uploadImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setProgress(percent);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText) as { url: string };
        if (data.url) {
          onChange(data.url);
          setBroken(false);
          toast.success('Main image uploaded');
        } else {
          setError('Upload failed. Please try again.');
        }
      } else {
        setError('Upload failed. Please try again.');
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setProgress(null);
      setError('Upload failed. Please try again.');
    };

    setUploading(true);
    setProgress(0);
    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  }

  function handleRemove() {
    onChange('');
    setBroken(false);
    toast('Main image removed', {
      duration: 5000,
    });
  }

  return (
    <div className="space-y-1.5">
      {label && <p className="text-xs font-medium text-sand">{label}</p>}

      {value ? (
        <div className="relative h-32 w-32 overflow-hidden rounded-lg border border-sand/30">
          {broken ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-sand/20">
              <ImageOff className="h-5 w-5 text-mist" />
              <span className="mt-1 text-[10px] text-mist">Error</span>
            </div>
          ) : (
            <Image
              src={value}
              alt="Main product image"
              fill
              className="object-cover"
              onError={() => setBroken(true)}
            />
          )}
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove main image"
            className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#9B2226]/80 text-pearl hover:bg-[#9B2226]"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex h-32 w-32 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-sand/50 text-sand hover:border-espresso hover:text-espresso disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
          <span className="text-[11px]">
            {uploading && progress !== null ? `Uploading ${progress}%` : 'Upload image'}
          </span>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
