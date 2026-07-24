'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { X, Plus, Lock, ImageOff } from 'lucide-react';
import { toast } from 'sonner';

interface ProductImageUploadProps {
  imageUrls: string[];
  onImagesChange: (urls: string[]) => void;
  maxImages?: number | undefined;
}

export function ProductImageUpload({
  imageUrls,
  onImagesChange,
  maxImages,
}: ProductImageUploadProps) {
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const max = maxImages ?? 5;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
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
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setUploadProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText) as { url: string };
        onImagesChange([...imageUrls, data.url]);
      } else {
        setError('Upload failed. Please try again.');
      }
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      setError('Upload failed. Please try again.');
    };

    setUploadProgress(0);
    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  }

  function handleRemove(url: string) {
    const updated = imageUrls.filter((u) => u !== url);
    onImagesChange(updated);

    toast('Image removed', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          onImagesChange([...updated, url]);
        },
      },
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {/* Existing image tiles */}
        {imageUrls.map((url) => (
          <div
            key={url}
            className="relative group h-20 w-20 rounded border border-sand/30 overflow-hidden"
          >
            {brokenUrls.has(url) ? (
              <div className="flex h-full w-full flex-col items-center justify-center bg-sand/20">
                <ImageOff className="h-4 w-4 text-mist" />
                <span className="text-[9px] text-mist mt-0.5">Error</span>
              </div>
            ) : (
              <Image
                src={url}
                alt=""
                fill
                className="object-cover"
                onError={() =>
                  setBrokenUrls((prev) => new Set(prev).add(url))
                }
              />
            )}
            <button
              type="button"
              onClick={() => handleRemove(url)}
              className="absolute top-0.5 right-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-[#9B2226]/70 text-pearl text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#9B2226]"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}

        {/* Upload progress tile */}
        {uploadProgress !== null && (
          <div className="flex h-20 w-20 flex-col items-center justify-center rounded border border-sand/30 bg-linen">
            <div className="h-1 w-10 rounded-full bg-sand/30 overflow-hidden">
              <div
                className="h-full bg-terracotta transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-xs text-mist font-mono mt-1">
              {uploadProgress}%
            </span>
          </div>
        )}

        {/* Upload button tile */}
        {imageUrls.length < max && uploadProgress === null && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center rounded border-2 border-dashed border-sand bg-linen hover:border-terracotta hover:bg-terracotta/5 transition-colors"
          >
            <Plus className="h-4 w-4 text-terracotta" />
            <span className="text-[10px] text-mist mt-0.5">Upload</span>
          </button>
        )}

        {/* Max reached tile */}
        {imageUrls.length >= max && uploadProgress === null && (
          <div className="flex h-20 w-20 flex-col items-center justify-center rounded border border-sand/30 bg-sand/20">
            <Lock className="h-4 w-4 text-mist" />
            <span className="text-[10px] text-mist mt-0.5">Max {max}</span>
          </div>
        )}
      </div>

      <p className="text-xs text-mist font-body">
        {imageUrls.length} / {max} images
      </p>

      {error && <p className="text-xs text-red-600 font-body">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
      />
    </div>
  );
}
