'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface StaffDocumentDownloadButtonProps {
  href: string;
  label: string;
  /** Suggested filename when the server does not send one. */
  filename: string;
}

/**
 * Download button with loading and error feedback (ARGUS #346).
 *
 * A plain `<a download>` gave no sign that the request was in flight, and a
 * failed payslip/attendance request silently downloaded an error envelope.
 * Fetching as a blob lets us surface both states and only save a real file.
 */
export function StaffDocumentDownloadButton({
  href,
  label,
  filename,
}: StaffDocumentDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(href);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        void handleDownload();
      }}
      disabled={isDownloading}
      aria-busy={isDownloading}
    >
      <Download className="mr-1.5 h-3.5 w-3.5" />
      {isDownloading ? 'Preparing…' : label}
    </Button>
  );
}
