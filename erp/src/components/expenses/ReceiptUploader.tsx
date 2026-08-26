'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface ReceiptUploaderProps {
  value: string | undefined;
  onChange: (url?: string) => void;
}

/**
 * Reusable receipt upload control (doc 38). Lets the user pick an image, uploads
 * it to /api/store/upload/receipt, and exposes the resulting URL via onChange.
 * Shows a preview, allows re-upload/replacement, and keeps a manual URL fallback.
 */
export function ReceiptUploader({ value, onChange }: ReceiptUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are accepted');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/store/upload/receipt', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? 'Upload failed');
      }
      onChange(json.url);
      toast.success('Receipt uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-start gap-3 rounded-lg border border-mist bg-linen/30 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Receipt preview"
            className="h-20 w-20 rounded object-cover"
          />
          <div className="flex flex-1 flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-mist text-espresso"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit text-terracotta"
              onClick={() => onChange(undefined)}
            >
              <X className="mr-1 h-4 w-4" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full border-mist text-espresso"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="mr-2 h-4 w-4" />
          )}
          {uploading ? 'Uploading...' : 'Upload Receipt'}
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      <div className="flex items-center gap-2">
        <Label className="shrink-0 text-xs text-sand">Or paste URL</Label>
        <Input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="border-mist"
          placeholder="https://..."
        />
      </div>
    </div>
  );
}
