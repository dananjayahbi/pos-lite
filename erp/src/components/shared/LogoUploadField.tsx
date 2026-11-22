'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ImageOff, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LogoUploadFieldProps {
  /** Current logo URL (if any). */
  logoUrl: string | null;
  /** Called with the stored URL, or null when the logo is removed. */
  onChange: (url: string | null) => void;
  /** Notified when an upload starts and when it settles (success or failure). */
  onUploadingChange?: ((uploading: boolean) => void) | undefined;
  /** Tenant-scoped upload endpoint that returns `{ url }`. */
  uploadUrl: string;
  /** Alt text for the preview (e.g. "Brand logo", "Store logo"). */
  alt: string;
  /** Disable all interactions. */
  disabled?: boolean | undefined;
  /** Extra hint under the control. */
  hint?: ReactNode;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024;

/**
 * Shared logo picker used by brand and store-profile settings.
 *
 * Uploads through the given tenant-scoped endpoint (which stores the file in
 * the configured provider — Cloudflare R2 in production) and reports the
 * resulting public URL. The form still owns persistence, so no tenant field is
 * written until the operator saves.
 */
export function LogoUploadField({
  logoUrl,
  onChange,
  onUploadingChange,
  uploadUrl,
  alt,
  disabled,
  hint,
}: LogoUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so the same file can be picked again.
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG and WebP images are accepted.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('Logo must be under 2 MB.');
      return;
    }

    setError(null);
    setBroken(false);
    upload(file);
  }

  function upload(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      // Settle the parent's gate before reporting the new URL, so a successful
      // upload immediately re-enables Save with the new value (ARGUS #489).
      onUploadingChange?.(false);
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { url: string };
          onChange(data.url);
        } catch {
          setError('Upload succeeded but response was unreadable.');
        }
      } else {
        let message = 'Upload failed. Please try again.';
        try {
          const data = JSON.parse(xhr.responseText) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          /* swallow */
        }
        setError(message);
      }
    };

    xhr.onerror = () => {
      onUploadingChange?.(false);
      setProgress(null);
      setError('Upload failed. Please try again.');
    };

    setProgress(0);
    onUploadingChange?.(true);
    try {
      xhr.open('POST', uploadUrl);
      xhr.send(formData);
    } catch {
      onUploadingChange?.(false);
      setProgress(null);
      setError('Upload failed. Please try again.');
    }
  }

  function handleRemove() {
    onChange(null);
    setBroken(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {/* Preview tile */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-sand bg-linen">
          {logoUrl && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={alt}
              className="h-full w-full object-contain"
              onError={() => setBroken(true)}
            />
          ) : logoUrl && broken ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-sand/30">
              <ImageOff className="h-4 w-4 text-mist-ink" />
              <span className="mt-0.5 text-[9px] text-mist-ink">Error</span>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-mist-ink">
              -
            </div>
          )}

          {progress !== null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-pearl/85">
              <Loader2 className="h-4 w-4 animate-spin text-espresso" />
              <span className="mt-0.5 font-mono text-[10px] text-espresso">
                {progress}%
              </span>
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
            {logoUrl ? 'Replace logo' : 'Upload logo'}
          </Button>
          {logoUrl && (
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

        <p className="ml-auto text-xs text-mist-ink">
          {hint ?? (
            <>
              JPEG / PNG / WebP
              <br />
              Max 2 MB
            </>
          )}
        </p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        data-testid="logo-upload-input"
        onChange={handleFileSelect}
      />
    </div>
  );
}
