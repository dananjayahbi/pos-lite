'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, X, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  tenantId: string;
  currentUrl: string;
  onUploaded: (url: string) => void;
};

export default function LogoUploader({ tenantId, currentUrl, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string>(currentUrl);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('tenantId', tenantId);

        const res = await fetch('/api/upload/logo', {
          method: 'POST',
          body: formData,
        });

        const json = (await res.json()) as { url?: string; error?: string };

        if (!res.ok || !json.url) {
          toast.error(json.error ?? 'Upload failed');
          return;
        }

        setPreview(json.url);
        onUploaded(json.url);
        toast.success('Logo uploaded');
      } catch {
        toast.error('Network error — could not upload logo');
      } finally {
        setUploading(false);
      }
    },
    [tenantId, onUploaded],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  const handleRemove = useCallback(() => {
    setPreview('');
    onUploaded('');
  }, [onUploaded]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-mist bg-linen flex items-center justify-center">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Business logo" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-sand" />
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {uploading ? 'Uploading…' : 'Upload Logo'}
          </Button>
          {preview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-terracotta"
              onClick={handleRemove}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Remove
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-espresso/50">JPEG, PNG, WebP, or SVG. Max 2 MB.</p>
    </div>
  );
}
